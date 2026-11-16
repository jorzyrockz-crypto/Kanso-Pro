import { expect, test } from '@playwright/test'

test.use({ reducedMotion: 'no-preference' })

test('touch devices keep the opening splash long enough for its cinematic exit', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeMatchMedia = window.matchMedia.bind(window)
    window.matchMedia = (query: string) => {
      if (query === '(pointer: coarse)' || query === '(prefers-reduced-motion: reduce)') {
        return { matches: query === '(pointer: coarse)', media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }
      }
      return nativeMatchMedia(query)
    }
  })
  await page.goto('/')

  const splash = page.locator('#app-splash')
  await expect(splash).toBeVisible()
  await page.waitForTimeout(500)
  await expect(splash).not.toHaveClass(/is-ready/)
  await expect(splash).toHaveClass(/is-ready/, { timeout: 1_500 })
  await expect(splash).toHaveCount(0, { timeout: 1_000 })
  await expect(page.getByRole('main', { name: 'Journey Stream', exact: true })).toBeVisible()
})
