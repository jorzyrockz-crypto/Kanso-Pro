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

export default defineConfig({
  plugins: [react(), kansoPwa(), {
    name: 'kanso-appearance-before-paint',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace('<!-- kanso:appearance-before-paint -->', `<script id="kanso-appearance">${appearanceBootstrapScript()}</script>`)
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
