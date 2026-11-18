import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createInitialState, LEGACY_STORAGE_KEY, STORAGE_KEY } from '../src/data'
import type { EventCard, OccasionTheme } from '../src/types'

const picker = (page: Page) => page.getByRole('group', { name: 'Occasion background', exact: true })
const preview = (page: Page) => page.locator('.occasion-preview')
const event = (page: Page, id: string) => page.locator(`[data-event-id="${id}"]`)
const navigation = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' })
const savedChoice = (page: Page, id: string) => page.evaluate(({ key, id }) => {
  return JSON.parse(localStorage.getItem(key)!).cards.find((card: { id: string }) => card.id === id)?.occasion
}, { key: STORAGE_KEY, id })
const settle = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

const themes: OccasionTheme[] = ['birthday', 'celebration', 'holiday', 'remembrance']
function illustratedState(longText = false) {
  const state = createInitialState()
  const source = state.cards.find((card): card is EventCard => card.type === 'event')!
  state.cards.push(...themes.map((occasion, index): EventCard => ({
    ...source, id: `occasion-${occasion}`, title: longText ? `${occasion}: ${'A'.repeat(140)}` : `${occasion[0].toUpperCase()}${occasion.slice(1)} with friends`,
    context: longText ? 'B'.repeat(240) : 'A moment worth making room for.', organization: longText ? 'C'.repeat(240) : 'Personal calendar',
    occasion, holiday: false, date: `2026-11-${14 + index}`, side: index % 2 ? 'right' : 'left',
  })))
  return state
}

async function audit(page: Page) {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(report.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => ({ html: node.html, summary: node.failureSummary })) }))).toEqual([])
}

test('automatic title suggestions update the live creation preview and respect manual overrides', async ({ page }) => {
  await page.goto('/new?type=event')
  await expect(picker(page).getByRole('radio')).toHaveCount(6)
  await expect(picker(page).getByRole('radio', { name: 'Automatic', exact: true })).toBeChecked()
  await expect(preview(page)).toHaveAttribute('data-occasion', 'none')
  const title = page.getByLabel('Card title', { exact: false })
  for (const [text, theme] of [['Mia’s birthday', 'birthday'], ['Graduation celebration', 'celebration'], ['Family vacation', 'holiday'], ['All Souls’ Day', 'remembrance'], ['Faculty meeting', 'none']]) {
    await title.fill(text)
    await expect(preview(page)).toHaveAttribute('data-occasion', theme)
  }
  await picker(page).getByRole('radio', { name: 'Holiday', exact: true }).check()
  await title.fill('Mia’s birthday')
  await expect(preview(page)).toHaveAttribute('data-occasion', 'holiday')
  await picker(page).getByRole('radio', { name: 'No illustration', exact: true }).check()
  await title.fill('Graduation celebration')
  await expect(preview(page)).toHaveAttribute('data-occasion', 'none')
  await expect(preview(page).locator('svg')).toHaveCount(0)
  await picker(page).getByRole('radio', { name: 'Automatic', exact: true }).check()
  await expect(preview(page)).toHaveAttribute('data-occasion', 'celebration')
  // Other card types do not acquire an event-only picker.
  await page.getByRole('radio', { name: 'Task list', exact: true }).check()
  await expect(picker(page)).toHaveCount(0)
  await page.getByRole('radio', { name: 'Event', exact: true }).check()
  await expect(preview(page)).toHaveAttribute('data-occasion', 'celebration')
})

test('automatic, manually illustrated, and unillustrated events persist on the timeline and calendar', async ({ page }) => {
  for (const [title, selection, theme, stored] of [
    ['Mia’s birthday', 'Automatic', 'birthday', 'auto'],
    ['Quiet planning session', 'Celebration', 'celebration', 'celebration'],
    ['A birthday without artwork', 'No illustration', 'none', 'none'],
  ]) {
    await page.goto('/new?type=event&date=2026-11-14')
    await page.getByLabel('Card title', { exact: false }).fill(title)
    await picker(page).getByRole('radio', { name: selection, exact: true }).check()
    await page.getByRole('button', { name: 'Add to Timeline', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Timeline', exact: true })).toBeVisible()
    const card = page.locator('.journey-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    await expect(card).toHaveAttribute('data-occasion', theme)
    await expect(card).not.toContainText('PH HOLIDAY')
    await expect(card.locator('[data-occasion-art]')).toHaveCount(theme === 'none' ? 0 : 1)
    const id = (await card.getAttribute('data-card-id'))!
    await expect.poll(() => savedChoice(page, id)).toBe(stored)
    await page.reload()
    await expect(card).toHaveAttribute('data-occasion', theme)
    await card.getByRole('button', { name: `Event actions for ${title}`, exact: true }).click()
    await page.getByRole('link', { name: 'View Calendar details', exact: true }).click()
    await expect(page).toHaveURL(`/calendar/${id}`)
    await expect(event(page, id)).toHaveAttribute('data-occasion', theme)
    await event(page, id).locator('summary').click()
    await expect(picker(page).getByRole('radio', { name: selection, exact: true })).toBeChecked()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
})

test('existing events have inline customization, reversible automatic detection, and saved choices', async ({ page }) => {
  await page.goto('/calendar/evt-holiday')
  const card = event(page, 'evt-holiday')
  await expect(card).toHaveAttribute('data-occasion', 'remembrance')
  await card.locator('summary').click()
  for (const theme of ['Birthday', 'Celebration', 'Holiday', 'Remembrance']) {
    await picker(page).getByRole('radio', { name: theme, exact: true }).check()
    await expect(card).toHaveAttribute('data-occasion', theme.toLowerCase())
    await expect(card.locator('.calendar-event-surface > svg')).toHaveAttribute('data-occasion-art', theme.toLowerCase())
    await expect.poll(() => savedChoice(page, 'evt-holiday')).toBe(theme.toLowerCase())
  }
  await picker(page).getByRole('radio', { name: 'No illustration', exact: true }).check()
  await expect(card.locator('.calendar-event-surface > svg')).toHaveCount(0)
  await navigation(page).getByRole('link', { name: 'Timeline', exact: true }).click()
  const timelineCard = page.locator('[data-card-id="evt-holiday"]')
  await expect(timelineCard).toHaveAttribute('data-occasion', 'none')
  await expect(timelineCard).toContainText('PH HOLIDAY')
  await expect(timelineCard.locator('[data-occasion-art]')).toHaveCount(0)
  await page.reload()
  await expect(timelineCard).toHaveAttribute('data-occasion', 'none')
  await timelineCard.getByRole('button', { name: 'Event actions for All Souls’ Day (Additional Special Non-Working Holiday)', exact: true }).click()
  await page.getByRole('link', { name: 'View Calendar details', exact: true }).click()
  await expect(page).toHaveURL('/calendar/evt-holiday')
  await card.locator('summary').click()
  await expect(picker(page).getByRole('radio', { name: 'No illustration', exact: true })).toBeChecked()
  await picker(page).getByRole('radio', { name: 'Automatic', exact: true }).check()
  await expect(card).toHaveAttribute('data-occasion', 'remembrance')
  await expect.poll(() => savedChoice(page, 'evt-holiday')).toBe('auto')
})

test('background edits sync across open tabs without changing unrelated event metadata', async ({ page, context }) => {
  await page.goto('/calendar/evt-oquendo')
  const second = await context.newPage()
  await second.goto('/')
  await expect(second.locator('[data-card-id="evt-oquendo"]')).toHaveAttribute('data-occasion', 'none')
  const original = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).cards.find((card: { id: string }) => card.id === 'evt-oquendo'), STORAGE_KEY)
  await event(page, 'evt-oquendo').locator('summary').click()
  await picker(page).getByRole('radio', { name: 'Birthday', exact: true }).check()
  await expect(second.locator('[data-card-id="evt-oquendo"]')).toHaveAttribute('data-occasion', 'birthday')
  await expect(second.locator('[data-card-id="evt-oquendo"]')).not.toContainText('PH HOLIDAY')
  await second.goto('/calendar/evt-oquendo')
  await event(second, 'evt-oquendo').locator('summary').click()
  await picker(second).getByRole('radio', { name: 'No illustration', exact: true }).check()
  await expect(event(page, 'evt-oquendo')).toHaveAttribute('data-occasion', 'none')
  const updated = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).cards.find((card: { id: string }) => card.id === 'evt-oquendo'), STORAGE_KEY)
  expect(updated).toEqual({ ...original, occasion: 'none' })
  await second.close()
})

test('older saves without theme fields migrate without losing their cards or prior edits', async ({ page }) => {
  const state = createInitialState()
  state.cards.find((card) => card.id === 'note-observation')!.title = 'An older saved thought'
  await page.addInitScript(({ state, legacy }) => localStorage.setItem(legacy, JSON.stringify(state)), { state, legacy: LEGACY_STORAGE_KEY })
  await page.goto('/calendar/evt-holiday')
  await expect(event(page, 'evt-holiday')).toHaveAttribute('data-occasion', 'remembrance')
  await event(page, 'evt-holiday').locator('summary').click()
  await expect(picker(page).getByRole('radio', { name: 'Automatic', exact: true })).toBeChecked()
  await picker(page).getByRole('radio', { name: 'Holiday', exact: true }).check()
  await expect.poll(() => savedChoice(page, 'evt-holiday')).toBe('holiday')
  await page.goto('/journal/note-observation')
  await expect(page.getByLabel('Note title', { exact: true })).toHaveValue('An older saved thought')
  const saved = await page.evaluate(({ key, legacy }) => ({ current: JSON.parse(localStorage.getItem(key)!), legacy: JSON.parse(localStorage.getItem(legacy)!) }), { key: STORAGE_KEY, legacy: LEGACY_STORAGE_KEY })
  expect(saved.current.cards).toHaveLength(8)
  expect(saved.legacy.cards.find((card: { id: string }) => card.id === 'evt-holiday')).not.toHaveProperty('occasion')
})

test('background controls keep working in memory when device storage is blocked', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage disabled', 'QuotaExceededError') } })
  await page.goto('/calendar/evt-oquendo')
  await expect(page.getByRole('alert')).toContainText('Device storage is unavailable')
  await event(page, 'evt-oquendo').locator('summary').click()
  await picker(page).getByRole('radio', { name: 'Celebration', exact: true }).check()
  await expect(event(page, 'evt-oquendo')).toHaveAttribute('data-occasion', 'celebration')
  await navigation(page).getByRole('link', { name: 'Timeline', exact: true }).click()
  await expect(page.locator('[data-card-id="evt-oquendo"]')).toHaveAttribute('data-occasion', 'celebration')
})

test('native background radios support keyboard arrows and inline editing without a modal', async ({ page }) => {
  await page.goto('/new?type=event')
  const automatic = picker(page).getByRole('radio', { name: 'Automatic', exact: true })
  await automatic.focus()
  await page.keyboard.press('ArrowRight')
  await expect(picker(page).getByRole('radio', { name: 'No illustration', exact: true })).toBeChecked()
  await page.keyboard.press('ArrowRight')
  await expect(picker(page).getByRole('radio', { name: 'Birthday', exact: true })).toBeFocused()
  await expect(preview(page)).toHaveAttribute('data-occasion', 'birthday')
  await expect(page.locator('.occasion-option:has(input:focus-visible)')).toHaveCount(1)
  await page.goto('/calendar/evt-oquendo')
  const summary = event(page, 'evt-oquendo').locator('summary')
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(event(page, 'evt-oquendo').locator('details')).toHaveAttribute('open', '')
  await page.keyboard.press('Tab')
  await expect(picker(page).getByRole('radio', { name: 'Automatic', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(picker(page).getByRole('radio', { name: 'Remembrance', exact: true })).toBeChecked()
  await expect(event(page, 'evt-oquendo')).toHaveAttribute('data-occasion', 'remembrance')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('all illustrations are local decorative SVGs with unique definition ids and literal event text', async ({ page }) => {
  const errors: string[] = []
  const external: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:5173/') && !request.url().startsWith('ws://127.0.0.1:5173/')) external.push(request.url()) })
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state: illustratedState() })
  await page.goto('/calendar')
  await event(page, 'occasion-birthday').locator('summary').click()
  const artworks = page.locator('[data-occasion-art]')
  await expect(page.locator('.calendar-event-surface > [data-occasion-art]')).toHaveCount(5)
  await expect(page.locator('[data-occasion-art]:visible')).toHaveCount(9) // five event scenes plus the four swatches in the open picker
  for (const artwork of await artworks.all()) {
    await expect(artwork).toHaveAttribute('aria-hidden', 'true')
    await expect(artwork).toHaveAttribute('focusable', 'false')
    await expect(artwork.locator('script, image, foreignObject')).toHaveCount(0)
  }
  const ids = await artworks.locator('[id]').evaluateAll((elements) => elements.map((element) => element.id))
  expect(new Set(ids).size).toBe(ids.length)
  await page.goto('/new?type=event')
  const literal = '<img src=x onerror=alert(1)> birthday'
  await page.getByLabel('Card title', { exact: false }).fill(literal)
  await expect(preview(page).getByRole('heading')).toHaveText(literal)
  await expect(preview(page).locator('img, script')).toHaveCount(0)
  expect(errors).toEqual([])
  expect(external).toEqual([])
})

test('illustrated cards and pickers fit phone, split-width, and tablet layouts with long text', async ({ page }) => {
  test.setTimeout(90_000)
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state: illustratedState(true) })
  for (const path of ['/', '/calendar', '/new?type=event']) {
    await page.goto(path)
    await expect(page.getByRole('main')).toBeVisible()
    if (path === '/calendar') await event(page, 'occasion-holiday').locator('summary').click()
    if (path.startsWith('/new')) await page.getByLabel('Card title', { exact: false }).fill('Birthday ' + 'A'.repeat(150))
    for (const [width, height] of [[320, 640], [375, 812], [600, 900], [680, 900], [681, 900], [834, 1194], [1194, 834], [1366, 1024]]) {
      await page.setViewportSize({ width, height })
      await settle(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} at ${width}px`).toBeLessThanOrEqual(width)
      const copies = page.locator('.occasion-event-copy, .calendar-event-copy, .occasion-preview-copy, .occasion-options')
      for (const copy of await copies.all()) {
        expect(await copy.evaluate((element) => element.scrollWidth - element.clientWidth), `${path} copy at ${width}px`).toBeLessThanOrEqual(1)
      }
      const options = page.locator('.occasion-option')
      for (const option of await options.all()) {
        const bounds = await option.boundingBox()
        expect(bounds!.width).toBeGreaterThanOrEqual(44)
        expect(bounds!.height).toBeGreaterThanOrEqual(44)
      }
    }
  }
})

test('occasion previews and open inline pickers pass automated WCAG A and AA checks', async ({ page }) => {
  test.setTimeout(180_000)
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state: illustratedState() })
  for (const width of [834, 375]) {
    await page.setViewportSize({ width, height: 1194 })
    await page.goto('/')
    await audit(page)
    await page.goto('/calendar')
    await event(page, 'occasion-celebration').locator('summary').click()
    await audit(page)
    await page.goto('/new?type=event')
    await page.getByLabel('Card title', { exact: false }).fill('A very special day')
    for (const theme of ['Birthday', 'Celebration', 'Holiday', 'Remembrance', 'No illustration']) {
      await picker(page).getByRole('radio', { name: theme, exact: true }).check()
      await audit(page)
    }
  }
})

test.describe('touch background selection', () => {
  test.use({ hasTouch: true })

  test('theme tiles and the inline background expander are reachable by touch', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/calendar/evt-oquendo')
    const summary = event(page, 'evt-oquendo').locator('summary')
    const bounds = await summary.boundingBox()
    expect(bounds!.height).toBeGreaterThanOrEqual(44)
    await summary.tap()
    await picker(page).getByRole('radio', { name: 'Birthday', exact: true }).tap()
    await expect(event(page, 'evt-oquendo')).toHaveAttribute('data-occasion', 'birthday')
    await picker(page).getByRole('radio', { name: 'No illustration', exact: true }).tap()
    await expect(event(page, 'evt-oquendo')).toHaveAttribute('data-occasion', 'none')
  })
})
