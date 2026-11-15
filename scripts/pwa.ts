import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import type { Plugin } from 'vite'

/** Small, dependency-free app-shell precache. Hash the actual build, not a manual version. */
export function kansoPwa(): Plugin {
  let root = ''
  let output = ''
  return {
    name: 'kanso-pwa',
    apply: 'build',
    configResolved(config) {
      root = config.root; output = resolve(root, config.build.outDir)
      const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
      const notes = JSON.parse(readFileSync(join(root, 'src/lib/whats-new.json'), 'utf8'))
      if (notes[0]?.version !== version || !notes[0]?.title || !notes[0]?.changes?.length) throw new Error('Add a matching, non-empty What’s new entry when changing the release version.')
    },
    closeBundle() {
      const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name)
        return entry.isDirectory() ? files(path) : [path]
      })
      const assets = files(output).filter((path) => !path.endsWith('/sw.js') && !path.endsWith('.map')).sort()
      const hash = createHash('sha256')
      const urls = assets.map((path) => {
        const url = `/${relative(output, path).split('\\').join('/')}`
        hash.update(url).update(readFileSync(path))
        return url
      })
      const template = readFileSync(join(root, 'src/service-worker.js'), 'utf8')
      hash.update(template)
      const id = hash.digest('hex').slice(0, 16)
      const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
      const appVersion = `${version}+${id}`
      const index = join(output, 'index.html')
      writeFileSync(index, readFileSync(index, 'utf8').replace('__KANSO_APP_VERSION__', appVersion))
      const worker = template.replace('__BUILD_ID__', id)
        .replace('__APP_VERSION__', appVersion)
        .replace('__PRECACHE_URLS__', JSON.stringify(urls))
      writeFileSync(join(output, 'sw.js'), worker)
      console.info(`PWA: ${urls.length} local app-shell assets prepared for offline use.`)
    },
  }
}
