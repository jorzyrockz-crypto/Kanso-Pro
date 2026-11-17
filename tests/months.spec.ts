import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createInitialState, STORAGE_KEY } from '../src/data'
import type { EventCard } from '../src/types'
import { MONTH_SCENES } from '../src/lib/months'
import { CALENDAR_SOURCES_STORAGE_KEY } from '../src/lib/calendarSources'

const background = (page: Page) => page.locator('.month-backdrop')
const navigation = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' })
const selectTimelineFilter = async (page: Page, label: string) => {
  await page.getByRole('button', { name: /^Filter journey cards:/ }).click()
  await page.getByRole('dialog', { name: 'Filter journey cards' }).getByRole('option', { name: label, exact: true }).click()
}
const settle = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

function yearOfPlans() {
  const state = createInitialState()
  const source = state.cards.find((card): card is EventCard => card.type === 'event')!
  state.cards = MONTH_SCENES.map((scene, index): EventCard => ({
    ...source, id: `month-${scene.id}`, date: `2026-${scene.id}-14`, title: `${scene.name} planning day`,
    context: 'A little room for what matters this month.', organization: 'Personal calendar',
    holiday: false, occasion: 'none', side: index % 2 ? 'right' : 'left',
  }))
  return state
}

async function readRow(page: Page, row: Locator) {
  await row.evaluate((element) => {
    const headerBottom = document.querySelector('.stream-header')!.getBoundingClientRect().bottom
    const sidebar = getComputedStyle(document.documentElement).getPropertyValue('--navigation-layout').trim() === 'sidebar'
    const navTop = sidebar ? innerHeight : document.querySelector('.bottom-bar')!.getBoundingClientRect().top
    // Bring the row into the upper part of the reading area, not merely into view.
    const readingArea = headerBottom + Math.max(0, navTop - headerBottom) * .35
    window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - readingArea + 30, behavior: 'instant' })
  })
  await settle(page)
}

async function audit(page: Page) {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(report.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => ({ html: node.html, summary: node.failureSummary })) }))).toEqual([])
}

test('every calendar month gets its own original, local background and matching hero artwork', async ({ page }) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  const external: string[] = []
  const drawings: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:5173/') && !request.url().startsWith('ws://127.0.0.1:5173/')) external.push(request.url()) })
  for (const scene of MONTH_SCENES) {
    await page.goto(`/calendar?month=2026-${scene.id}`)
    await expect(page.getByRole('heading', { name: `${scene.name} 2026 Schedule`, exact: true })).toBeVisible()
    await expect(background(page)).toHaveCount(1)
    await expect(background(page)).toHaveAttribute('data-month-background', `2026-${scene.id}`)
    await expect(background(page)).toHaveAttribute('data-month-scene', scene.id)
    await expect(background(page).locator('svg')).toHaveCount(2)
    await expect(page.locator('.month-hero-artwork')).toHaveAttribute('data-month-art', scene.id)
    for (const artwork of await page.locator('[data-month-art]').all()) {
      await expect(artwork).toHaveAttribute('aria-hidden', 'true')
      await expect(artwork).toHaveAttribute('focusable', 'false')
      await expect(artwork.locator('image, script, foreignObject, a, [tabindex]')).toHaveCount(0)
      expect(await artwork.locator('path').count()).toBeGreaterThan(0)
    }
    drawings.push(await page.locator('.month-backdrop-right').evaluate((svg) => Array.from(svg.querySelectorAll('path'), (path) => path.getAttribute('d')).join('|')))
    const layers = await background(page).evaluate((element) => ({ position: getComputedStyle(element).position, z: getComputedStyle(element).zIndex, pointer: getComputedStyle(element).pointerEvents }))
    expect(layers).toEqual({ position: 'fixed', z: '-1', pointer: 'none' })
  }
  expect(new Set(drawings).size).toBe(12)
  expect(errors).toEqual([])
  expect(external).toEqual([])
})

test('calendar month navigation, year changes, day links, history, and refresh keep the background in sync', async ({ page }) => {
  await page.goto('/calendar?month=2026-12')
  await page.getByRole('button', { name: 'Next month', exact: true }).click()
  await expect(page).toHaveURL('/calendar?month=2027-01')
  await expect(background(page)).toHaveAttribute('data-month-background', '2027-01')
  await expect(page.locator('.month-hero-artwork')).toHaveAttribute('data-month-art', '01')
  await page.goBack()
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-12')
  await page.goForward()
  await expect(background(page)).toHaveAttribute('data-month-background', '2027-01')
  await page.reload()
  await expect(background(page)).toHaveAttribute('data-month-background', '2027-01')
  await page.getByRole('button', { name: 'Previous month', exact: true }).click()
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-12')
  await page.goto('/calendar?date=2028-02-29&month=2026-12')
  await expect(background(page)).toHaveAttribute('data-month-background', '2028-02')
  await expect(page.getByRole('heading', { name: 'February 2028 Schedule', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Focus date', exact: true }).click()
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-11')
  await page.goto('/calendar?month=2026-99&date=2026-02-30')
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-11')
  await expect(page.getByRole('heading', { name: 'November 2026 Schedule', exact: true })).toBeVisible()
})

test('a direct event link uses that event’s month while unrelated pages and missing cards keep their normal backgrounds', async ({ page }) => {
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state: yearOfPlans() })
  await page.goto('/calendar/month-04')
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-04')
  await expect(page.getByRole('heading', { name: 'April 2026 Schedule', exact: true })).toBeVisible()
  await page.reload()
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-04')
  for (const path of ['/tasks', '/projects', '/journal', '/new', '/missing-page', '/calendar/missing-event', '/calendar/a/b']) {
    await page.goto(path)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(background(page)).toHaveCount(0)
    await expect(page.locator('[data-month-art]')).toHaveCount(0)
  }
})

test('timeline backgrounds and the month badge follow the reading position across all twelve months', async ({ page }) => {
  test.setTimeout(60_000)
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state: yearOfPlans() })
  await page.goto('/')
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-01')
  for (const scene of MONTH_SCENES) {
    await readRow(page, page.locator(`[data-timeline-month="2026-${scene.id}"]`))
    await expect(background(page)).toHaveAttribute('data-month-background', `2026-${scene.id}`)
    await expect(page.locator('.month-icon')).toHaveAttribute('aria-label', `${scene.name} 2026`)
    await expect(background(page).locator('svg')).toHaveCount(2)
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-01')
  await readRow(page, page.locator('[data-timeline-month="2026-09"]'))
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-09')
  const position = await page.evaluate(() => Math.round(window.scrollY))
  await navigation(page).getByRole('link', { name: 'Calendar', exact: true }).click()
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-11')
  await page.goBack()
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-09')
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(position)
})

test('filters, empty timelines, and newly created events choose a safe month without changing occasion backgrounds', async ({ page }) => {
  const state = createInitialState()
  state.cards = state.cards.filter((card) => card.type === 'task' || card.type === 'event')
  state.cards.find((card) => card.id === 'task-grades')!.date = '2026-06-14'
  await page.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)) }, { key: STORAGE_KEY, state })
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ version: 1, depedEnabled: false, legislatedEnabled: false, localSources: [] })), CALENDAR_SOURCES_STORAGE_KEY)
  await page.goto('/')
  await selectTimelineFilter(page, 'Events')
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-11')
  await selectTimelineFilter(page, 'Tasks')
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-06')
  await selectTimelineFilter(page, 'Journal Notes')
  await expect(page.locator('.timeline-month-empty')).toHaveCount(6)
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-06')
  await page.goto('/new?type=event&date=2026-04-12')
  await page.getByLabel('Card title', { exact: false }).fill('Mia’s birthday')
  await page.getByRole('button', { name: 'Add to Timeline', exact: true }).click()
  const card = page.locator('.journey-card').filter({ has: page.getByRole('heading', { name: 'Mia’s birthday', exact: true }) })
  await expect(card).toHaveAttribute('data-occasion', 'birthday')
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-04')
  await expect(page.locator('.month-icon')).toHaveAttribute('aria-label', 'April 2026')
  await card.locator('.card-open').click({ position: { x: 10, y: 10 } })
  await page.getByRole('link', { name: 'View schedule', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'April 2026 Schedule', exact: true })).toBeVisible()
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-04')
  await expect(page.getByRole('button', { name: 'Preview Mia’s birthday details', exact: true })).toBeVisible()
  await page.reload()
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-04')
  await expect(page.getByRole('button', { name: 'Preview Mia’s birthday details', exact: true })).toBeVisible()
})

test('monthly decoration does not add stored preferences, alter cards, or require working device storage', async ({ page }) => {
  await page.goto('/')
  const original = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
  await navigation(page).getByRole('link', { name: 'Calendar', exact: true }).click()
  for (let index = 0; index < 3; index++) await page.getByRole('button', { name: 'Next month', exact: true }).click()
  await expect(background(page)).toHaveAttribute('data-month-background', '2027-02')
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(original)
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage disabled', 'QuotaExceededError') } })
  await page.goto('/calendar?month=2026-07')
  await expect(page.getByRole('alert')).toContainText('Device storage is unavailable')
  await expect(background(page)).toHaveAttribute('data-month-background', '2026-07')
})

test('backgrounds stay subtle, static, non-interactive, and within the viewport at phone and tablet sizes', async ({ page }) => {
  test.setTimeout(90_000)
  for (const path of ['/', '/calendar?month=2026-12', '/calendar?month=2026-06']) {
    await page.goto(path)
    for (const [width, height] of [[320, 640], [375, 812], [600, 900], [768, 1024], [834, 1194], [1194, 834], [1600, 1000]]) {
      await page.setViewportSize({ width, height })
      await settle(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} at ${width}`).toBeLessThanOrEqual(width)
      const bounds = await background(page).boundingBox()
      expect(bounds).toEqual({ x: 0, y: 0, width, height })
      for (const artwork of await page.locator('.month-artwork').all()) {
        const styles = await artwork.evaluate((element) => ({ opacity: Number(getComputedStyle(element).opacity), pointer: getComputedStyle(element).pointerEvents, animations: element.getAnimations({ subtree: true }).length }))
        expect(styles.opacity).toBeLessThanOrEqual(.5)
        expect(styles.pointer).toBe('none')
        expect(styles.animations).toBe(0)
      }
      const overflow = await page.locator('.workspace-hero, .workspace-panel, .journey-card').evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.className))
      expect(overflow).toEqual([])
      for (const link of await navigation(page).getByRole('link').all()) {
        const canReach = await link.evaluate((element) => {
          const box = element.getBoundingClientRect()
          return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
        })
        expect(canReach).toBe(true)
      }
    }
  }
  await page.goto('/')
  await page.getByRole('button', { name: 'Tablet frame', exact: true }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/ipad-frame-active/)
  await expect(background(page)).toBeVisible()
  await page.keyboard.press('Tab')
  await navigation(page).getByRole('link', { name: 'Calendar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Next month', exact: true })).toBeVisible()
})

test('monthly decoration respects reduced motion, higher contrast, forced colors, and printing', async ({ page }) => {
  await page.goto('/calendar?month=2026-04')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await background(page).evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
  await page.emulateMedia({ contrast: 'more' })
  await expect(page.locator('.month-artwork:visible')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'April 2026 Schedule', exact: true })).toBeVisible()
  await page.emulateMedia({ contrast: 'no-preference', forcedColors: 'active' })
  await expect(page.locator('.month-artwork:visible')).toHaveCount(0)
  await page.emulateMedia({ forcedColors: 'none', media: 'print' })
  await expect(background(page)).not.toBeVisible()
  await expect(page.locator('.month-artwork:visible')).toHaveCount(0)
})

test('all twelve month palettes pass automated WCAG A and AA checks on tablet and phone', async ({ page }) => {
  test.setTimeout(180_000)
  for (const width of [834, 375]) {
    await page.setViewportSize({ width, height: 1194 })
    for (const scene of MONTH_SCENES) {
      await page.goto(`/calendar?month=2026-${scene.id}`)
      await expect(page.getByRole('heading', { name: `${scene.name} 2026 Schedule`, exact: true })).toBeVisible()
      await audit(page)
    }
    await page.goto('/')
    await audit(page)
  }
})

test.describe('touch with monthly backgrounds', () => {
  test.use({ hasTouch: true })
  test('calendar days, month arrows, and bottom tabs remain reachable through the decoration', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/calendar?month=2026-12')
    await page.getByRole('button', { name: 'Next month', exact: true }).tap()
    await expect(background(page)).toHaveAttribute('data-month-background', '2027-01')
    await page.getByRole('button', { name: 'Thursday, January 14, 0 cards', exact: true }).tap()
    await expect(page).toHaveURL('/calendar?date=2027-01-14')
    await expect(background(page)).toHaveAttribute('data-month-background', '2027-01')
    await navigation(page).getByRole('link', { name: 'Timeline', exact: true }).tap()
    await expect(background(page)).toHaveAttribute('data-month-background', '2026-11')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
