/**
 * Vite exposes this at build time. It is `/` on Vercel and can be a project-site
 * directory such as `/Kanso-Pro/` for GitHub Pages.
 */
export function appBasePath() {
  const base = import.meta.env.BASE_URL || '/'
  return base.endsWith('/') ? base : `${base}/`
}

/** Public assets must stay inside the deployed app directory, never the site root. */
export function appAssetPath(path: string) {
  return `${appBasePath()}${path.replace(/^\/+/, '')}`
}

const PROJECT_SITE_ROUTE_QUERY = '__kanso_route'

/** Restore a GitHub Pages 404 redirect before BrowserRouter reads the URL. */
export function restoreProjectSiteRoute() {
  const base = appBasePath()
  if (base === '/') return
  const current = new URL(window.location.href)
  const route = current.searchParams.get(PROJECT_SITE_ROUTE_QUERY)
  if (!route || route.length > 8_192 || !route.startsWith('/') || route.startsWith('//') || route.includes('\\')) return
  const destination = new URL(route, window.location.origin)
  if (destination.origin !== window.location.origin || destination.pathname.startsWith(base)) return
  window.history.replaceState(window.history.state, '', `${base.slice(0, -1)}${destination.pathname}${destination.search}${destination.hash}`)
}
