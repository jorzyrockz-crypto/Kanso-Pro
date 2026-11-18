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
