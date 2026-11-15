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
    configResolved(config) { root = config.root; output = resolve(root, config.build.outDir) },
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
      const worker = template.replace('__BUILD_ID__', hash.digest('hex').slice(0, 16))
        .replace('__PRECACHE_URLS__', JSON.stringify(urls))
      writeFileSync(join(output, 'sw.js'), worker)
      console.info(`PWA: ${urls.length} local app-shell assets prepared for offline use.`)
    },
  }
}
