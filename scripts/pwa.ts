import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import type { Plugin } from 'vite'

/** Small, dependency-free app-shell precache. Hash the actual build, not a manual version. */
function scopedCacheNamespace(base: string) {
  if (base === '/') return 'root'
  // A readable directory name alone can collide (for example /team-a/ and /team/a/).
  // Retain it for diagnostics and append a path hash so two project sites never reuse caches.
  const label = base.slice(1, -1).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'site'
  const identity = createHash('sha256').update(base).digest('hex').slice(0, 12)
  return `${label}-${identity}`
}

function appUrl(base: string, path: string) {
  return `${base}${path.replace(/^\/+/, '')}`
}

function writeManifestForBase(output: string, base: string) {
  const manifestPath = join(output, 'manifest.webmanifest')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    id?: string
    start_url?: string
    scope?: string
    icons?: Array<{ src: string }>
    shortcuts?: Array<{ url: string }>
  }
  manifest.id = base
  manifest.start_url = base
  manifest.scope = base
  manifest.icons = manifest.icons?.map((icon) => ({ ...icon, src: appUrl(base, icon.src) }))
  manifest.shortcuts = manifest.shortcuts?.map((shortcut) => ({ ...shortcut, url: appUrl(base, shortcut.url) }))
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

/** GitHub Pages serves this document for unmatched project-site routes instead of an SPA rewrite. */
function writeProjectSite404(output: string, base: string) {
  if (base === '/') return
  const fallback = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Opening Kanso Pro…</title></head>
<body><p>Opening Kanso Pro…</p><script>
(() => {
  const base = ${JSON.stringify(base)}
  const current = new URL(window.location.href)
  if (current.pathname === base.slice(0, -1)) { window.location.replace(new URL(base + current.search + current.hash, current.origin).href); return }
  if (!current.pathname.startsWith(base)) return
  const route = current.pathname.slice(base.length - 1) + current.search + current.hash
  const target = new URL(base, current.origin)
  target.searchParams.set('__kanso_route', route)
  window.location.replace(target.href)
})()
</script></body></html>
`
  writeFileSync(join(output, '404.html'), fallback)
}

export function kansoPwa(): Plugin {
  let root = ''
  let output = ''
  let base = '/'
  return {
    name: 'kanso-pwa',
    apply: 'build',
    configResolved(config) {
      root = config.root; output = resolve(root, config.build.outDir); base = config.base.endsWith('/') ? config.base : `${config.base}/`
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
      hash.update(base)
      const urls = assets.map((path) => {
        const url = appUrl(base, relative(output, path).split('\\').join('/'))
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
      writeManifestForBase(output, base)
      writeProjectSite404(output, base)
      const worker = template.replace('__CACHE_PREFIX__', `kanso-pro-shell-${scopedCacheNamespace(base)}-`)
        .replace('__APP_BASE_PATH__', base)
        .replace('__APP_INDEX_URL__', appUrl(base, 'index.html'))
        .replace('__BUILD_ID__', id)
        .replace('__APP_VERSION__', appVersion)
        .replace('__PRECACHE_URLS__', JSON.stringify(urls))
      writeFileSync(join(output, 'sw.js'), worker)
      console.info(`PWA: ${urls.length} local app-shell assets prepared for offline use at ${base}.`)
    },
  }
}
