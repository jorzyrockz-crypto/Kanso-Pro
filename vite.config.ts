import { execFileSync } from 'node:child_process'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { appearanceBootstrapScript } from './src/lib/appearance'
import { kansoPwa } from './scripts/pwa'

// Link help to the branch being previewed, not to files that may not be on main yet.
// This is public build metadata only; no credentials or runtime network lookup.
function sourceRef() {
  if (process.env.VERCEL_GIT_COMMIT_REF) return process.env.VERCEL_GIT_COMMIT_REF
  try { return execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'main' }
  catch { return 'main' }
}

/** Keep a project-site build inside its own GitHub Pages directory and worker scope. */
function appBasePath() {
  const requested = process.env.VITE_APP_BASE_PATH?.trim()
  if (!requested || requested === '/') return '/'
  if (!requested.startsWith('/') || requested.startsWith('//') || /[\\?#]/.test(requested)) throw new Error('VITE_APP_BASE_PATH must be a path such as /Kanso-Pro/.')
  const segments = requested.split('/').filter(Boolean)
  if (!segments.length || segments.some((segment) => !/^[a-z0-9._~-]+$/i.test(segment) || segment === '.' || segment === '..')) throw new Error('VITE_APP_BASE_PATH must be a URL-safe absolute path.')
  return `/${segments.join('/')}/`
}

export default defineConfig({
  base: appBasePath(),
  plugins: [react(), kansoPwa(), {
    name: 'kanso-appearance-before-paint',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        return html.replace('<!-- kanso:appearance-before-paint -->', `<script id="kanso-appearance">${appearanceBootstrapScript()}</script>`).replace('__KANSO_APP_VERSION__', context.server ? 'development' : '__KANSO_APP_VERSION__')
      },
    },
  }],
  define: { __APP_SOURCE_REF__: JSON.stringify(sourceRef()) },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app', 'localhost'],
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app', 'localhost'],
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
