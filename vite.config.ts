import { execFileSync } from 'node:child_process'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Link help to the branch being previewed, not to files that may not be on main yet.
// This is public build metadata only; no credentials or runtime network lookup.
function sourceRef() {
  if (process.env.VERCEL_GIT_COMMIT_REF) return process.env.VERCEL_GIT_COMMIT_REF
  try { return execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'main' }
  catch { return 'main' }
}

export default defineConfig({
  plugins: [react()],
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
