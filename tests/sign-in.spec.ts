import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { MONTH_SCENES } from '../src/lib/months'
import { STORAGE_KEY } from '../src/data'
import { mockFirebase } from './helpers/firebase'
import type { FirebaseHarness } from './helpers/firebase'

test.use({ timezoneId: 'UTC' })

const background = (page: Page) => page.locator('.month-backdrop-sign-in')
const email = (page: Page) => page.getByLabel('Email address', { exact: true })
const password = (page: Page) => page.getByLabel('Password', { exact: true })
const saved = (page: Page) => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
const settle = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
const audit = async (page: Page) => {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(result.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => ({ html: node.html, summary: node.failureSummary })) }))).toEqual([])
}
let firebase: FirebaseHarness
let errors: string[]
test.beforeEach(async ({ context, page }) => {
  firebase = await mockFirebase(context)
  errors = []
  page.on('pageerror', (error) => errors.push(error.message))
})
test.afterEach(() => {
  expect(errors).toEqual([])
  expect(firebase.unexpectedRequests).toEqual([])
})

test('the dedicated sign-in page uses all twelve existing scenes from the actual clock', async ({ page }) => {
  test.setTimeout(60_000)
  let before: string | null = null
  for (const scene of MONTH_SCENES) {
    // Noon UTC on the 15th is the same month in every browser timezone.
    await page.clock.setFixedTime(new Date(`2029-${scene.id}-15T12:00:00Z`))
    await page.goto('/sign-in')
    await expect(email(page)).toBeEnabled()
    await expect(page).toHaveTitle('Sign in · Kanso Pro')
    await expect(background(page)).toHaveAttribute('data-month-background', `2029-${scene.id}`)
    await expect(background(page)).toHaveAttribute('data-month-scene', scene.id)
    await expect(page.locator('.sign-in-month')).toHaveText(`${scene.name} 2029`)
    await expect(page.locator('.sign-in-season-title')).toHaveText(`${scene.title}.`)
    await expect(page.locator('.sign-in-hero-art')).toHaveAttribute('data-month-art', scene.id)
    const canvas = await background(page).evaluate((element) => getComputedStyle(element).getPropertyValue('--month-canvas'))
    expect(canvas.trim()).toBe(scene.canvas)
    await expect(page.locator('.bottom-bar, .topbar, .global-create')).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('main')).toHaveCount(1)
    if (!before) before = await saved(page)
    expect(await saved(page)).toBe(before)
  }
  expect(firebase.requests).toHaveLength(0)
})

test('an open sign-in page rolls into the next month without reload or lost form input', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-30T23:59:00Z') })
  await page.goto('/sign-in')
  await expect(email(page)).toBeEnabled()
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-11')
  await email(page).fill('ada@example.test')
  await password(page).fill('test-only-unsent-passphrase')
  const before = await saved(page)
  await page.clock.fastForward(62_000)
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-12')
  await expect(page.locator('.sign-in-season-title')).toHaveText('Small wonders.')
  await expect(email(page)).toHaveValue('ada@example.test')
  await expect(password(page)).toHaveValue('test-only-unsent-passphrase')
  expect(await saved(page)).toBe(before)
  expect(firebase.requests).toHaveLength(0)
})

test('a suspended page refreshes on focus, visibility, and pageshow, including a new year and leap day', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-12-15T12:00:00Z'))
  await page.goto('/sign-in?mode=create')
  await expect(email(page)).toBeEnabled()
  await page.getByLabel('Display name', { exact: true }).fill('Ada Reyes')
  await page.clock.setFixedTime(new Date('2027-01-01T12:00:00Z'))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(background(page)).toHaveAttribute('data-month-background', '2027-01')
  await page.clock.setFixedTime(new Date('2028-02-29T12:00:00Z'))
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow')))
  await expect(background(page)).toHaveAttribute('data-month-background', '2028-02')
  await page.clock.setFixedTime(new Date('2028-03-01T12:00:00Z'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(background(page)).toHaveAttribute('data-month-background', '2028-03')
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Ada Reyes')
  expect(firebase.requests).toHaveLength(0)
})

test('the month is local to the device, even when Manila and Los Angeles are on different months', async ({ browser }) => {
  for (const [timezoneId, expected] of [['Asia/Manila', '2027-02'], ['America/Los_Angeles', '2027-01']]) {
    const context = await browser.newContext({ timezoneId })
    const mock = await mockFirebase(context)
    const page = await context.newPage()
    await page.clock.setFixedTime(new Date('2027-01-31T16:30:00Z'))
    await page.goto('http://127.0.0.1:5173/sign-in')
    await expect(email(page)).toBeEnabled()
    await expect(background(page)).toHaveAttribute('data-month-background', expected)
    expect(mock.requests).toHaveLength(0)
    expect(mock.unexpectedRequests).toEqual([])
    await context.close()
  }
})

test('registration, recovery, refresh, legacy links, and history retain the real monthly scene', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2028-05-15T12:00:00Z'))
  await page.goto('/calendar?month=2026-03')
  await expect(page.locator('[data-month-background]')).toHaveAttribute('data-month-background', '2026-03')
  await page.locator('.personal-workspace').click()
  await expect(page).toHaveURL('/sign-in')
  await expect(background(page)).toHaveAttribute('data-month-background', '2028-05')
  await page.getByRole('link', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveTitle('Create account · Kanso Pro')
  await expect(background(page)).toHaveAttribute('data-month-background', '2028-05')
  await page.reload()
  await expect(background(page)).toHaveAttribute('data-month-background', '2028-05')
  await page.goBack()
  await expect(page).toHaveURL('/sign-in')
  await page.getByRole('link', { name: 'Forgot your password?', exact: true }).click()
  await expect(page).toHaveTitle('Reset password · Kanso Pro')
  await expect(background(page)).toHaveAttribute('data-month-background', '2028-05')
  await page.goto('/account?mode=reset&month=2026-12')
  await expect(page).toHaveURL('/sign-in?mode=reset')
  await expect(background(page)).toHaveAttribute('data-month-background', '2028-05')
  await page.getByRole('link', { name: 'Continue as guest', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link')).toHaveCount(5)
  // The sample timeline still derives its own month from its cards, not the clock.
  await expect(page.locator('[data-month-background]')).toHaveAttribute('data-month-background', '2026-11')
  expect(firebase.requests).toHaveLength(0)
})

test('the responsive entry page fits narrow phones, tablet split views, landscape, and keyboard-height windows', async ({ page }) => {
  test.setTimeout(60_000)
  for (const [width, height] of [[320, 812], [375, 812], [600, 900], [760, 1024], [834, 1194], [1194, 834], [1440, 1000], [375, 420]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/sign-in?mode=create')
    await expect(email(page)).toBeEnabled()
    await page.evaluate(() => document.fonts.ready)
    await settle(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    const targets = await page.locator('.sign-in-header a, .sign-in-card button, .sign-in-card input, .account-modes a, .sign-in-guest a, .sign-in-device > summary').evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }))
    for (const target of targets) { expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44) }
    await password(page).focus()
    await page.getByRole('button', { name: 'Create account', exact: true }).scrollIntoViewIfNeeded()
    const submit = await page.getByRole('button', { name: 'Create account', exact: true }).boundingBox()
    expect(submit!.y).toBeGreaterThanOrEqual(0)
    expect(submit!.y + submit!.height).toBeLessThanOrEqual(height)
    await expect(page.locator('.bottom-bar')).toHaveCount(0)
  }
  await page.setViewportSize({ width: 375, height: 812 })
  await page.evaluate(() => {
    const root = document.documentElement
    root.style.setProperty('--safe-area-bottom', '34px')
    root.style.setProperty('--safe-area-left', '24px')
    root.style.setProperty('--safe-area-right', '24px')
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })
  })
  await settle(page)
  const footer = page.getByRole('contentinfo')
  expect(await footer.evaluate((element) => getComputedStyle(element).paddingBottom)).toBe('34px')
  const lastText = await footer.locator(':scope > span').boundingBox()
  // Document scrolling is integer-rounded while text geometry can be fractional.
  expect(lastText!.y + lastText!.height).toBeLessThanOrEqual(812 - 34 + .5)
})

test('all twelve sign-in palettes and the expanded guest backup remain accessible', async ({ page }) => {
  test.setTimeout(90_000)
  for (const width of [834, 375]) {
    await page.setViewportSize({ width, height: 1100 })
    for (const scene of MONTH_SCENES) {
      await page.clock.setFixedTime(new Date(`2027-${scene.id}-15T12:00:00Z`))
      await page.goto('/sign-in')
      await expect(email(page)).toBeEnabled()
      await page.evaluate(() => document.fonts.ready)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      await audit(page)
    }
  }
  await page.locator('.sign-in-device > summary').click()
  await expect(page.getByRole('button', { name: 'Export device backup', exact: true })).toBeVisible()
  await audit(page)
  // Guest export is still available without making authentication a prerequisite.
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export device backup', exact: true }).click()
  expect((await download).suggestedFilename()).toMatch(/^kanso-pro-journey-/)
  await expect(page.locator('.account-feedback')).toContainText('backup is ready')
  expect(firebase.requests).toHaveLength(0)
})

test('monthly decoration is static and non-interactive, supports contrast/print, and never traps focus', async ({ page }) => {
  await page.goto('/sign-in')
  await expect(email(page)).toBeEnabled()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to page content', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  for (const art of await page.locator('[data-month-art]').all()) {
    await expect(art).toHaveAttribute('aria-hidden', 'true')
    await expect(art).toHaveAttribute('focusable', 'false')
    expect(await art.evaluate((element) => ({ pointer: getComputedStyle(element).pointerEvents, animation: getComputedStyle(element).animationName }))).toEqual({ pointer: 'none', animation: 'none' })
  }
  await page.emulateMedia({ contrast: 'more' })
  await expect(page.locator('.sign-in-illustration')).toBeHidden()
  await expect(email(page)).toBeVisible()
  await page.emulateMedia({ contrast: 'no-preference', forcedColors: 'active' })
  await expect(page.locator('.sign-in-hero-art')).toBeHidden()
  await page.emulateMedia({ forcedColors: 'none', media: 'print' })
  await expect(background(page)).toBeHidden()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
