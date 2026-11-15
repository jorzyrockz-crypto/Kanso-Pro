import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// Three focused production checks, deliberately separate from the full app regression.
export default defineConfig({
  ...base,
  testDir: './tests/pwa',
  testIgnore: [],
  use: { ...base.use, baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
