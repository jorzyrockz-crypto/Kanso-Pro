import { defineConfig } from '@playwright/test'
import type { LaunchOptions } from '@playwright/test'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

// The npm-packaged browser also runs in network-restricted Linux sandboxes.
// Keep the package.json Playwright/Chromium pair aligned. The native new-tab
// regression in newer engines is tracked at microsoft/playwright#42142.
// On other platforms, use `npx playwright install chromium` or the path override.
let launchOptions: LaunchOptions = {}
const browserOverride = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
if (browserOverride) {
  launchOptions = { executablePath: browserOverride }
} else if (process.platform === 'linux' && process.arch === 'x64') {
  const { default: chromium, inflate, setupLambdaEnvironment } = await import('@sparticuz/chromium')
  const require = createRequire(import.meta.url)
  const packageRoot = dirname(dirname(require.resolve('@sparticuz/chromium')))
  await inflate(join(packageRoot, 'bin', 'al2023.tar.br'))
  setupLambdaEnvironment(join(tmpdir(), 'al2023', 'lib'))
  launchOptions = {
    executablePath: await chromium.executablePath(),
    // Retain Playwright's browser-specific feature fixes (including RenderDocument)
    // instead of replacing them with Lambda's single-process/isolation defaults.
    args: chromium.args.filter((arg) => ![
      '--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials',
    ].includes(arg) && !/^--(?:enable|disable)-features=/.test(arg)),
  }
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 834, height: 1194 },
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions,
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
