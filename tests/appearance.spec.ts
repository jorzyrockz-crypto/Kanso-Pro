import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { APPEARANCE_STORAGE_KEY, serializeColorMode } from '../src/lib/appearance'
import type { ColorMode } from '../src/lib/appearance'
import { LEGACY_STORAGE_KEY, STORAGE_KEY, createInitialState } from '../src/data'
import { MONTH_SCENES } from '../src/lib/months'
import { mockFirebase } from './helpers/firebase'
import type { FirebaseHarness } from './helpers/firebase'

test.use({ timezoneId: 'UTC', colorScheme: 'light' })
const root = (page: Page) => page.locator('html')
const mode = (page: Page, label: 'Light' | 'Dark' | 'Auto') => page.getByRole('radio', { name: label, exact: true })
const saved = (page: Page) => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
const audit = async (page: Page) => {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ html: n.html, summary: n.failureSummary })) }))).toEqual([])
}
async function seedMode(page: Page, value: ColorMode) {
  await page.addInitScript(({ key, raw }) => { localStorage.setItem(key, raw) }, { key: APPEARANCE_STORAGE_KEY, raw: serializeColorMode(value) })
}
async function expectScheme(page: Page, scheme: 'light' | 'dark', preference?: ColorMode) {
  await expect(root(page)).toHaveAttribute('data-theme', scheme)
  if (preference) await expect(root(page)).toHaveAttribute('data-color-mode', preference)
  await expect.poll(() => root(page).evaluate((element) => getComputedStyle(element).colorScheme)).toBe(scheme)
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', scheme === 'dark' ? '#0c1724' : '#eaf5fc')
}
async function expectSurface(page: Page, selector: string, scheme: 'light' | 'dark') {
  const colors = await page.locator(selector).evaluateAll((elements) => elements.flatMap((element) => {
    const style = getComputedStyle(element)
    const background = style.backgroundColor === 'rgba(0, 0, 0, 0)' ? style.backgroundImage : style.backgroundColor
    return Array.from(background.matchAll(/rgba?\(([^)]+)\)/g), (match) => {
      const values = match[1].match(/[\d.]+/g)!.map(Number)
      return values.slice(0, 3).reduce((sum, value) => sum + value, 0) / 3
    })
  }))
  expect(colors.length).toBeGreaterThan(0)
  for (const average of colors) {
    if (scheme === 'dark') expect(average, selector).toBeLessThan(95)
    else expect(average, selector).toBeGreaterThan(215)
  }
}
let firebase: FirebaseHarness
let errors: string[]
test.beforeEach(async ({ page, context }) => {
  firebase = await mockFirebase(context)
  errors = []
  page.on('pageerror', (error) => errors.push(error.message))
})
test.afterEach(() => {
  expect(errors).toEqual([])
  expect(firebase.unexpectedRequests).toEqual([])
})

for (const system of ['light', 'dark'] as const) {
  test(`a fresh workspace defaults to Auto with a ${system} device preference`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: system })
    await page.goto('/settings#appearance')
    await expect(mode(page, 'Auto')).toBeChecked()
    await expectScheme(page, system, 'auto')
    await expectSurface(page, '.settings-section, .topbar, .bottom-navigation', system)
    await expect(page.getByRole('group', { name: 'Color mode', exact: true })).toContainText('including when it changes')
    await expect(page.getByRole('switch')).toHaveCount(0)
    await expect(page.locator('.appearance-status')).toHaveText(`Auto · ${system === 'dark' ? 'Dark' : 'Light'} appearance on this device`)
    expect(JSON.parse((await saved(page))!).cards).toHaveLength(8)
    expect(Object.keys(JSON.parse((await saved(page))!)).sort()).toEqual(['bezel', 'cards', 'version'])
    expect(firebase.requests).toHaveLength(0)
  })
}

test('Auto responds live while explicit modes ignore device changes and restore correctly after reload', async ({ page }) => {
  await page.goto('/settings#appearance')
  const before = await saved(page)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expectScheme(page, 'dark', 'auto')
  await mode(page, 'Light').check()
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await expectScheme(page, 'light', 'light')
  }
  await page.reload()
  await expect(mode(page, 'Light')).toBeChecked()
  await expectScheme(page, 'light', 'light')
  await mode(page, 'Dark').check()
  await page.emulateMedia({ colorScheme: 'light' })
  await expectScheme(page, 'dark', 'dark')
  await page.reload()
  await expect(mode(page, 'Dark')).toBeChecked()
  await expectScheme(page, 'dark', 'dark')
  await mode(page, 'Auto').check()
  await expectScheme(page, 'light', 'auto')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expectScheme(page, 'dark', 'auto')
  await page.reload()
  await expect(mode(page, 'Auto')).toBeChecked()
  await expectScheme(page, 'dark', 'auto')
  expect(await saved(page)).toBe(before)
})

test('the saved scheme is applied in the head before React, with no light-first render', async ({ page }) => {
  await seedMode(page, 'dark')
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/src/main.tsx*', async (route) => { await gate; await route.continue() })
  try {
    await page.goto('/sign-in', { waitUntil: 'commit' })
    await expect(root(page)).toHaveAttribute('data-theme', 'dark')
    await expect(root(page)).toHaveAttribute('data-color-mode', 'dark')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0c1724')
    await expect(page.locator('#root')).toBeEmpty()
    // Wait for body parsing; Vite can append an HMR cache-busting query to src.
    await expect(page.locator('script[type="module"][src^="/src/main.tsx"]')).toHaveCount(1)
    const order = await page.evaluate(() => {
      const script = document.querySelector('#kanso-appearance')!
      return !!(script.compareDocumentPosition(document.querySelector('script[type="module"][src^="/src/main.tsx"]')!) & Node.DOCUMENT_POSITION_FOLLOWING)
    })
    expect(order).toBe(true)
  } finally { release() }
  await expect(page.getByRole('heading', { name: 'Welcome back.', exact: true })).toBeVisible()
  await expectScheme(page, 'dark', 'dark')
})

test('same-origin tabs update open composer, journal, and sign-in fields without remounting or losing input', async ({ page, context }) => {
  await page.goto('/new?type=note')
  await page.getByLabel('Card title', { exact: false }).fill('An unfinished thought')
  await page.getByLabel('Your words', { exact: false }).fill('Keep this draft while the light changes.')
  const before = await saved(page)
  const other = await context.newPage()
  await other.goto('/settings#appearance')
  await page.getByLabel('Your words', { exact: false }).focus()
  for (const label of ['Dark', 'Light', 'Auto'] as const) {
    await mode(other, label).check()
    await expectScheme(page, label === 'Dark' ? 'dark' : 'light', label.toLowerCase() as ColorMode)
    await expect(page.getByLabel('Card title', { exact: false })).toHaveValue('An unfinished thought')
    await expect(page.getByLabel('Your words', { exact: false })).toHaveValue('Keep this draft while the light changes.')
    await expect(page.getByLabel('Your words', { exact: false })).toBeFocused()
  }
  expect(await saved(page)).toBe(before)
  await page.goto('/journal/note-lesson')
  await page.locator('#journal-body').fill('A saved reflection with its own place.')
  const edited = await saved(page)
  await mode(other, 'Dark').check()
  await expectScheme(page, 'dark', 'dark')
  await expect(page.locator('#journal-body')).toHaveValue('A saved reflection with its own place.')
  expect(await saved(page)).toBe(edited)
  await page.goto('/sign-in?mode=create')
  await page.getByLabel('Display name', { exact: true }).fill('Night planner')
  await page.getByLabel('Email address', { exact: true }).fill('draft@example.test')
  await page.getByLabel('Password', { exact: true }).fill('not-submitted-passphrase')
  await mode(other, 'Light').check()
  await expectScheme(page, 'light', 'light')
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Night planner')
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue('draft@example.test')
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('not-submitted-passphrase')
  expect(await saved(page)).toBe(edited)
  const setting = await page.evaluate((key) => localStorage.getItem(key), APPEARANCE_STORAGE_KEY)
  expect(JSON.parse(setting!)).toEqual({ version: 1, mode: 'light' })
  expect(setting).not.toMatch(/draft@example|Night planner|passphrase/)
  expect(firebase.requests).toHaveLength(0)
  await other.close()
})

test('invalid appearance data and old journey saves recover to Auto without resetting cards or the Timeline frame', async ({ page }) => {
  const original = createInitialState()
  original.cards[0].title = 'A real pre-theme edit'
  original.bezel = true
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.addInitScript(({ key, raw, legacy, journey }) => {
    localStorage.setItem(key, raw)
    localStorage.setItem(legacy, JSON.stringify(journey))
  }, { key: APPEARANCE_STORAGE_KEY, raw: '{"version":9,"mode":"dark"}', legacy: LEGACY_STORAGE_KEY, journey: original })
  await page.goto('/settings#appearance')
  await expect(mode(page, 'Auto')).toBeChecked()
  await expectScheme(page, 'dark', 'auto')
  expect(JSON.parse((await saved(page))!)).toEqual(original)
  await page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('link', { name: 'Timeline', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tablet frame', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(JSON.parse((await saved(page))!)).toEqual(original)
})

for (const failure of ['read', 'write'] as const) {
  test(`blocked appearance ${failure} keeps session-only choices usable without harming journey storage`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.addInitScript(({ key, failure }) => {
      const get = Storage.prototype.getItem
      const set = Storage.prototype.setItem
      if (failure === 'read') Storage.prototype.getItem = function (name) { if (name === key) throw new DOMException('Blocked', 'SecurityError'); return get.call(this, name) }
      else Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('Full', 'QuotaExceededError'); return set.call(this, name, value) }
    }, { key: APPEARANCE_STORAGE_KEY, failure })
    await page.goto('/settings#appearance')
    await expectScheme(page, 'dark', 'auto')
    await expect(page.locator('.appearance-control .save-warning')).toContainText('Not saved')
    const before = await saved(page)
    await mode(page, 'Light').check()
    await expectScheme(page, 'light', 'light')
    await page.getByRole('link', { name: 'Sign in', exact: true }).click()
    await expectScheme(page, 'light', 'light')
    await page.reload()
    await expectScheme(page, 'dark', 'auto')
    expect(await saved(page)).toBe(before)
    expect(firebase.requests).toHaveLength(0)
  })
}

test('cross-tab removal restores Auto, malformed or sessionStorage events are ignored, and unrelated data stays intact', async ({ page, context }) => {
  await page.goto('/settings#appearance')
  await mode(page, 'Dark').check()
  const before = await saved(page)
  const other = await context.newPage()
  await other.goto('/sign-in')
  await page.evaluate((key) => {
    for (const value of ['{oops', '{"version":1,"mode":"sepia"}']) window.dispatchEvent(new StorageEvent('storage', { key, newValue: value, storageArea: localStorage }))
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: '{"version":1,"mode":"light"}', storageArea: sessionStorage }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'another-app', newValue: '{"version":1,"mode":"light"}', storageArea: localStorage }))
  }, APPEARANCE_STORAGE_KEY)
  await expectScheme(page, 'dark', 'dark')
  await other.evaluate((key) => localStorage.removeItem(key), APPEARANCE_STORAGE_KEY)
  await expect(mode(page, 'Auto')).toBeChecked()
  await expectScheme(page, 'light', 'auto')
  expect(await saved(page)).toBe(before)
  await other.close()
})

test('the color radio group supports native keyboard navigation and a visible selected/focus state', async ({ page }) => {
  await page.goto('/settings#appearance')
  await mode(page, 'Auto').focus()
  await page.keyboard.press('ArrowLeft')
  await expect(mode(page, 'Dark')).toBeChecked()
  await expect(mode(page, 'Dark')).toBeFocused()
  await expectScheme(page, 'dark', 'dark')
  expect(await page.locator('.appearance-option-dark').evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid')
  await expect(page.locator('.appearance-option-dark .appearance-selected')).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await expect(mode(page, 'Light')).toBeChecked()
  await expectScheme(page, 'light', 'light')
  await page.keyboard.press('ArrowLeft')
  await expect(mode(page, 'Auto')).toBeChecked()
  await page.keyboard.press('Tab')
  await expect(mode(page, 'Auto')).not.toBeFocused()
  expect(firebase.requests).toHaveLength(0)
})

for (const scheme of ['light', 'dark'] as const) {
  test(`all planner, creation, auth, Settings, and recovery pages use readable ${scheme} surfaces`, async ({ page }) => {
    test.setTimeout(120_000)
    await seedMode(page, scheme)
    for (const [path, surface] of [
      ['/', '.journey-card:not(.holiday-card):not(.illustrated-event-card):not(.card-note), .stream-header'],
      ['/calendar?month=2026-11', '.workspace-panel, .calendar-event, .calendar-event-surface:not(.occasion-surface):not(.holiday-card)'],
      ['/tasks', '.workspace-panel, .workspace-check, .quick-add-form > input, .workspace-selector > select'],
      ['/projects', '.workspace-panel, .team-panel, .workspace-selector > select'],
      ['/journal', '.journal-editor'],
      ['/new', '.composer-card, #card-title, .occasion-picker'],
      ['/new?type=task', '.composer-card, #card-details'],
      ['/new?type=project', '.composer-card, #card-title'],
      ['/new?type=note', '.composer-card, #card-details'],
      ['/settings', '.settings-section'],
      ['/sign-in', '.sign-in-card, #account-email, #account-password'],
      ['/sign-in?mode=create', '.sign-in-card, #signup-name'],
      ['/sign-in?mode=reset', '.sign-in-card, #account-email'],
      ['/not-a-page', '.not-found-icon'],
    ]) {
      await test.step(path, async () => {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expectScheme(page, scheme, scheme)
        await expectSurface(page, surface, scheme)
        await audit(page)
      })
    }
  })
}

test('dark mode preserves the four card-type marker colors and keeps workspace accents distinct', async ({ page, context }) => {
  await page.goto('/')
  const markers = () => page.locator('.filter-dot').evaluateAll((elements) => elements.map((element) => getComputedStyle(element).backgroundColor))
  const lightMarkers = await markers()
  expect(lightMarkers).toEqual(['rgb(59, 130, 246)', 'rgb(16, 185, 129)', 'rgb(242, 180, 64)', 'rgb(244, 124, 153)'])
  const other = await context.newPage()
  await other.goto('/settings#appearance')
  await mode(other, 'Dark').check()
  await expectScheme(page, 'dark', 'dark')
  expect(await markers()).toEqual(lightMarkers)
  const heroes: string[] = []
  for (const path of ['/tasks', '/projects', '/journal']) {
    await page.goto(path)
    heroes.push(await page.locator('.workspace-hero').evaluate((element) => getComputedStyle(element).backgroundImage))
  }
  expect(new Set(heroes).size).toBe(3)
  await other.close()
})

test('all twelve monthly dark palettes retain their scenes and readable sign-in/calendar/Settings copy', async ({ page }) => {
  test.setTimeout(150_000)
  await seedMode(page, 'dark')
  await page.clock.install({ time: new Date('2028-01-15T12:00:00Z') })
  for (const scene of MONTH_SCENES) {
    await page.clock.setFixedTime(new Date(`2028-${scene.id}-15T12:00:00Z`))
    await page.goto('/sign-in')
    await expect(page.locator('[data-month-background]')).toHaveAttribute('data-month-background', `2028-${scene.id}`)
    await expect(page.locator('.sign-in-season-title')).toContainText(scene.title)
    await expectScheme(page, 'dark', 'dark')
    await audit(page)
    await page.goto(`/calendar?month=2028-${scene.id}`)
    await expect(page.locator('[data-month-background]')).toHaveAttribute('data-month-background', `2028-${scene.id}`)
    await audit(page)
    await page.goto('/settings#appearance')
    await expect(page.locator('[data-settings-month]')).toHaveAttribute('data-settings-month', `2028-${scene.id}`)
    await audit(page)
  }
  expect(firebase.requests).toHaveLength(0)
})

test('dark occasion editing, authentication feedback, account controls, and Profile pass WCAG A/AA', async ({ page }) => {
  test.setTimeout(60_000)
  await seedMode(page, 'dark')
  await page.goto('/calendar?month=2026-11')
  const editor = page.locator('.event-background-editor').first()
  await editor.locator('summary').click()
  for (const label of ['Birthday', 'Celebration', 'Holiday', 'Remembrance', 'No illustration', 'Automatic']) {
    await editor.getByRole('radio', { name: label, exact: true }).check()
    await audit(page)
  }
  await page.goto('/sign-in')
  firebase.failures.signInWithPassword = 'INVALID_LOGIN_CREDENTIALS'
  await page.getByLabel('Email address', { exact: true }).fill('ada@example.test')
  await page.getByLabel('Password', { exact: true }).fill('test-passphrase-2026')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.locator('.account-feedback.is-error')).toBeVisible()
  await audit(page)
  delete firebase.failures.signInWithPassword
  // The existing auth flow deliberately clears passwords after every attempt.
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  await page.getByLabel('Password', { exact: true }).fill('test-passphrase-2026')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/account')
  await expectScheme(page, 'dark', 'dark')
  await expectSurface(page, '.account-card, .account-device-panel, #profile-name, .account-device-stats > div', 'dark')
  await audit(page)
  await page.getByRole('button', { name: 'Profile menu', exact: true }).click()
  await expectSurface(page, '.profile-panel', 'dark')
  await audit(page)
})

test('dark mode retains responsive touch targets, motion/contrast preferences, forced colors, and light printing', async ({ page }) => {
  test.setTimeout(60_000)
  await seedMode(page, 'dark')
  await page.goto('/settings#appearance')
  for (const [width, height] of [[320, 812], [375, 420], [600, 900], [834, 1194], [1194, 834], [1440, 1000], [812, 320]]) {
    await page.setViewportSize({ width, height })
    await expect(mode(page, 'Dark')).toBeChecked()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    for (const input of await page.locator('.appearance-option > input').all()) {
      const box = (await input.boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
  }
  await page.setViewportSize({ width: 375, height: 812 })
  await audit(page)
  await expect(page.locator('.settings-month-art')).toHaveAttribute('aria-hidden', 'true')
  expect(await page.locator('.settings-month-art').evaluate((element) => ({ pointer: getComputedStyle(element).pointerEvents, animation: getComputedStyle(element).animationName }))).toEqual({ pointer: 'none', animation: 'none' })
  await page.emulateMedia({ contrast: 'more' })
  await expect(page.locator('.settings-month-art')).toBeHidden()
  await expect(mode(page, 'Dark')).toBeChecked()
  await audit(page)
  await page.emulateMedia({ contrast: 'no-preference', forcedColors: 'active' })
  await expect(page.locator('.settings-month-art')).toBeHidden()
  await mode(page, 'Light').check()
  await mode(page, 'Dark').focus()
  await page.keyboard.press('Space')
  await expect(mode(page, 'Dark')).toBeChecked()
  await page.emulateMedia({ forcedColors: 'none', media: 'print' })
  await expect(page.locator('.topbar:visible, .bottom-bar:visible')).toHaveCount(0)
  await expect(page.locator('.appearance-options')).toBeHidden()
  expect(await root(page).evaluate((element) => getComputedStyle(element).colorScheme)).toBe('light')
  expect(await page.locator('.settings-section').first().evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 255, 255)')
  await page.emulateMedia({ media: 'screen' })
  await expectScheme(page, 'dark', 'dark')
})
