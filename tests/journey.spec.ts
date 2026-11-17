import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from '../src/data'
import { CALENDAR_SOURCES_STORAGE_KEY } from '../src/lib/calendarSources'

const navigation = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' })
const filters = (page: Page) => page.getByRole('navigation', { name: 'Filter journey cards' })
const filterTrigger = (page: Page) => page.getByRole('button', { name: /^Filter journey cards:/ })
const selectTimelineFilter = async (page: Page, label: string) => {
  await filterTrigger(page).click()
  await page.getByRole('dialog', { name: 'Filter journey cards' }).getByRole('option', { name: label, exact: true }).click()
}
const content = (page: Page) => page.getByRole('main')
const card = (page: Page, id: string) => page.locator(`[data-card-id="${id}"]`)
// Click the link surface, not a checklist control layered over its center.
const openCard = async (page: Page, id: string) => card(page, id).locator('.card-open').click({ position: { x: 10, y: 10 } })
const timeline = async (page: Page) => {
  await navigation(page).getByRole('link', { name: 'Timeline', exact: true }).click()
  await expect(page).toHaveURL('/')
}
const openNewCard = async (page: Page) => {
  await page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('button', { name: 'New card', exact: true }).click()
}
const audit = async (page: Page) => {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(report.violations.map((violation) => ({
    id: violation.id,
    nodes: violation.nodes.map((node) => ({ html: node.html, summary: node.failureSummary })),
  }))).toEqual([])
}

const settle = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

test.beforeEach(async ({ page }) => {
  // Most journey assertions concern personal cards. Keep this explicit local preference
  // off here; the dedicated test below covers the product default for a new browser.
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ version: 1, depedEnabled: false, legislatedEnabled: false, localSources: [] })), CALENDAR_SOURCES_STORAGE_KEY)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Journey Stream', exact: true })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
})

test('renders the portrait timeline with Kanso Pro branding, local assets, and no runtime errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.reload()
  await expect(page).toHaveTitle('Timeline · Kanso Pro')
  await expect(page.getByRole('link', { name: 'Kanso Pro home', exact: true })).toBeVisible()
  await expect(page.getByRole('contentinfo')).toContainText('Kanso Pro')
  await expect(page.locator('body')).not.toContainText('CHRONOS FLOW')
  await expect(page.locator('.journey-card')).toHaveCount(6)
  await expect(page.locator('.filter-count')).toHaveText('8')
  await expect(card(page, 'evt-holiday')).toContainText('PH HOLIDAY')
  await expect(card(page, 'proj-tos').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
  const node = await page.locator('.date-node').first().boundingBox()
  const spine = await page.locator('.timeline-spine').boundingBox()
  expect(Math.abs((node!.x + node!.width / 2) - (spine!.x + spine!.width / 2))).toBeLessThan(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(834)
  expect(await page.locator('script[src^="http"], link[href^="http"], img[src^="http"]').count()).toBe(0)
  expect(errors).toEqual([])
})

test('timeline boundaries load one month only after an explicit action, never from a fast fling', async ({ page }) => {
  const future = page.locator('.timeline-boundary-future button')
  await future.scrollIntoViewIfNeeded()
  const before = await page.locator('.month-marker').count()
  await page.mouse.wheel(0, 8_000)
  await expect(page.locator('.month-marker')).toHaveCount(before)
  await expect(future).toHaveAccessibleName('Load later dates')
  await future.click()
  await expect(page.locator('.month-marker')).toHaveCount(before + 1)
})

test('Jump to Today stays out of the way until today’s node leaves view, even with no personal cards', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await page.clock.install({ time: new Date('2026-11-15T12:00:00Z') })
    await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ version: 1, cards: [], bezel: false })), STORAGE_KEY)
    await page.goto('/')
    const todayNode = page.locator('.date-node[data-date="2026-11-15"]')
    await expect(todayNode).toBeInViewport()
    await expect(todayNode).toHaveClass(/date-today/)
    await expect(todayNode.locator('.date-node-today')).toHaveText('Today')
    await expect(page.getByRole('button', { name: 'Jump to Today', exact: true })).toHaveCount(0)
    await page.setViewportSize({ width: 375, height: 600 })
    await todayNode.evaluate((node) => node.scrollIntoView({ behavior: 'instant', block: 'center' }))
    await expect(todayNode).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Jump to Today', exact: true })).toHaveCount(0)
    await page.evaluate(() => window.scrollBy({ top: 480, behavior: 'instant' }))
    await expect.poll(() => page.evaluate(() => {
      const node = document.querySelector('.date-node[data-date="2026-11-15"]')?.getBoundingClientRect()
      const header = document.querySelector('.stream-header')?.getBoundingClientRect().bottom ?? 0
      return !!node && node.bottom < header
    })).toBe(true)
    await expect(page.getByRole('button', { name: 'Jump to Today', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Jump to Today', exact: true }).click()
    await expect(todayNode).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Jump to Today', exact: true })).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test('Jump to Today follows the device date instead of the sample focus date', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-12-15T12:00:00Z') })
  await page.reload()
  await expect(page.locator('.month-marker[data-timeline-month="2026-11"]')).toBeVisible()
  await page.getByRole('button', { name: 'Jump to Today', exact: true }).click()
  await expect(page.locator('.month-marker[data-timeline-month="2026-12"]')).toBeInViewport()
})

test('the verified school calendar starts on, while the Timeline keeps only its useful controls', async ({ page }) => {
  await expect(page.locator('.stream-reference-controls')).not.toContainText('All your pages, connected')
  await page.evaluate((key) => localStorage.removeItem(key), CALENDAR_SOURCES_STORAGE_KEY)
  const fresh = await page.context().newPage()
  try {
    await fresh.goto('/settings#calendar')
    await expect(fresh.getByRole('switch', { name: 'Hide DepEd Calendar in Calendar', exact: true })).toHaveAttribute('aria-checked', 'true')
    await expect(fresh.getByRole('switch', { name: 'Show Legislated activities & celebrations in Calendar', exact: true })).toHaveAttribute('aria-checked', 'false')
  } finally {
    await fresh.close()
  }
})

test('responsive Timeline menus provide the streamlined filter, scope, and source controls on tablet and phone', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 })
  const sourceTrigger = page.getByRole('button', { name: /^Calendar sources, \d+ shown$/ })
  const filterTrigger = page.getByRole('button', { name: /^Filter journey cards:/ })
  await expect(filters(page)).toBeHidden()
  await expect(filterTrigger).toHaveAccessibleName('Filter journey cards: All Stream')
  await expect(sourceTrigger).toBeVisible()
  await expect(page.getByRole('group', { name: 'Team workload scope', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768)

  await page.setViewportSize({ width: 375, height: 812 })
  await expect(filters(page)).toBeHidden()
  await expect(filterTrigger).toHaveAccessibleName('Filter journey cards: All Stream')
  const [filterBox, sourceBox] = await Promise.all([filterTrigger.boundingBox(), sourceTrigger.boundingBox()])
  expect(filterBox).not.toBeNull()
  expect(sourceBox).not.toBeNull()
  expect(Math.abs(filterBox!.y - sourceBox!.y)).toBeLessThanOrEqual(1)
  expect(filterBox!.x + filterBox!.width).toBeLessThanOrEqual(sourceBox!.x)
  await filterTrigger.click()
  const filterMenu = page.getByRole('dialog', { name: 'Filter journey cards' })
  const filterMenuBox = await filterMenu.boundingBox()
  expect(filterMenuBox!.width).toBeLessThanOrEqual(190)
  await filterMenu.getByRole('option', { name: 'Tasks', exact: true }).click()
  await expect(filterTrigger).toHaveAccessibleName('Filter journey cards: Tasks')
  await sourceTrigger.click()
  const sourcesMenu = page.getByRole('dialog', { name: 'Calendar sources' })
  const sourcesMenuBox = await sourcesMenu.boundingBox()
  expect(sourcesMenuBox!.width).toBeLessThanOrEqual(304)
  const depEdSource = sourcesMenu.getByRole('checkbox', { name: 'Show DepEd Calendar in Calendar and Timeline', exact: true })
  await expect(depEdSource).toHaveAttribute('aria-checked', 'false')
  await depEdSource.click()
  await expect(sourcesMenu.getByRole('checkbox', { name: 'Hide DepEd Calendar in Calendar and Timeline', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(sourceTrigger).toHaveAccessibleName('Calendar sources, 1 shown')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await page.keyboard.press('Escape')
  await expect(sourcesMenu).not.toBeVisible()
})

test('the mobile stream header compacts after scrolling while keeping its controls readable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const header = page.locator('.stream-header')
  await expect(header).not.toHaveClass(/is-condensed/)
  await page.evaluate(() => window.scrollTo(0, 180))
  await expect(header).toHaveClass(/is-condensed/)
  await expect(page.locator('.stream-sources-menu .source-summary-label-compact')).toBeVisible()
  await expect(page.locator('.stream-sources-menu .source-summary-label-compact')).toHaveText('Sources')
  const create = navigation(page).getByRole('button', { name: 'New card', exact: true })
  await expect(create).toBeVisible()
  const createBox = await create.boundingBox()
  expect(createBox).not.toBeNull()
  expect(Math.abs(createBox!.width - createBox!.height)).toBeLessThanOrEqual(1)
  expect(createBox!.height).toBeGreaterThanOrEqual(44)
  const jump = page.getByRole('button', { name: 'Jump to Today', exact: true })
  await expect(jump).toBeVisible()
  await expect(jump.locator('span')).toBeHidden()
  const jumpBox = await jump.boundingBox()
  expect(jumpBox).not.toBeNull()
  expect(Math.abs(jumpBox!.width - jumpBox!.height)).toBeLessThanOrEqual(1)
  expect(jumpBox!.height).toBeGreaterThanOrEqual(44)
})

test('What’s new opens the update overview over the Timeline instead of a standalone page', async ({ page }) => {
  await page.goto('/whats-new')
  await expect(page).toHaveURL('/')
  const overview = page.getByRole('dialog', { name: 'Kanso Pro · Planning Space', exact: true })
  await expect(overview).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Journey Stream', exact: true })).toBeVisible()
  await overview.getByRole('button', { name: 'Close About and what’s new', exact: true }).click()
  await expect(overview).not.toBeVisible()
  await expect(page.getByRole('heading', { name: 'Journey Stream', exact: true })).toBeVisible()
})

test('Calendar keeps its monthly schedule hero clear of duplicate page chrome', async ({ page }) => {
  await navigation(page).getByRole('link', { name: 'Calendar', exact: true }).click()
  const hero = page.locator('.month-calendar-hero')
  await expect(page.getByRole('main', { name: 'Calendar', exact: true })).toBeVisible()
  await expect(page.locator('.workspace-calendar > .page-header')).toHaveCount(0)
  await expect(hero.getByRole('heading', { name: 'Calendar', exact: true })).toHaveCount(0)
  await expect(hero.getByRole('heading', { level: 2, name: 'November 2026 Schedule', exact: true })).toBeVisible()
  await expect(hero.getByRole('button', { name: 'New event', exact: true })).toHaveCount(0)
  await expect(navigation(page).getByRole('button', { name: 'New event', exact: true })).toBeVisible()
})

test('the bottom create action follows the active workspace', async ({ page }) => {
  for (const [tab, action] of [['Timeline', 'New card'], ['Calendar', 'New event'], ['Tasks', 'New task list'], ['Projects', 'New project'], ['Journal', 'New note']] as const) {
    await navigation(page).getByRole('link', { name: tab, exact: true }).click()
    await expect(navigation(page).getByRole('button', { name: action, exact: true })).toBeVisible()
  }
})

test('preview dialogs browse nearby timeline entries with desktop buttons and touch swipes', async ({ page }) => {
  await card(page, 'evt-holiday').getByRole('button', { name: /Preview details for/ }).click()
  const dialog = page.getByRole('dialog')
  const title = dialog.getByRole('heading', { level: 2 })
  const firstTitle = await title.textContent()
  await expect(dialog.getByRole('button', { name: 'Next preview', exact: true })).toBeEnabled()
  await dialog.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 280, clientY: 360 })
  await dialog.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 1, clientX: 120, clientY: 360 })
  await expect(title).not.toHaveText(firstTitle!)
  await dialog.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 2, clientX: 120, clientY: 360 })
  await dialog.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 2, clientX: 280, clientY: 360 })
  await expect(title).toHaveText(firstTitle!)
  await dialog.getByRole('button', { name: 'Next preview', exact: true }).click()
  await expect(title).not.toHaveText(firstTitle!)
  await dialog.getByRole('button', { name: 'Previous preview', exact: true }).click()
  await expect(title).toHaveText(firstTitle!)
})

test('the bottom navigation opens ordinary pages with URLs, active links, titles, and a single main landmark', async ({ page }) => {
  for (const [name, path, mainName] of [
    ['Calendar', '/calendar', 'Calendar'], ['Tasks', '/tasks', 'Personal Tasks'], ['Projects', '/projects', 'Projects'], ['Journal', '/journal', 'Journal'],
    ['Timeline', '/', 'Journey Stream'],
  ]) {
    const link = navigation(page).getByRole('link', { name, exact: true })
    await expect(link).toHaveAttribute('href', path)
    await link.click()
    await expect(page).toHaveURL(path)
    await expect(page).toHaveTitle(`${name} · Kanso Pro`)
    await expect(link).toHaveAttribute('aria-current', 'page')
    await expect(navigation(page).locator('[aria-current="page"]')).toHaveCount(1)
    await expect(content(page)).toHaveCount(1)
    await expect(content(page)).toHaveAccessibleName(mainName)
    await expect(content(page)).toBeFocused()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  }
  await expect(page.locator('header.topbar nav')).toHaveCount(0)
  await expect(page.locator('.bottom-bar')).toHaveCount(1)
  await expect(page.locator('.status-bar')).toHaveCount(0)
})

test('card-specific URLs work on direct visits and refresh', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const [path, active] of [
    ['/calendar/evt-oquendo', 'Calendar'], ['/tasks/task-prep', 'Tasks'],
    ['/projects/proj-reading', 'Projects'], ['/journal/note-lesson', 'Journal'],
  ]) {
    await page.goto(path)
    await page.reload()
    await expect(page).toHaveURL(path)
    await expect(navigation(page).getByRole('link', { name: active, exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(content(page)).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    if (active === 'Calendar') await expect(content(page).getByRole('heading', { name: 'Faculty Alignment & Curriculum Sync', exact: true })).toBeVisible()
    if (active === 'Tasks') await expect(page.getByLabel('Your task list', { exact: true })).toHaveValue('task-prep')
    if (active === 'Projects') await expect(content(page).getByRole('checkbox')).toHaveCount(8)
    if (active === 'Journal') await expect(page.getByLabel('Note title', { exact: true })).toHaveValue('Q2 Reading Comprehension Rubric Ideas')
  }
  expect(errors).toEqual([])
})

test('Back and Forward restore the selected task list and calendar state', async ({ page }) => {
  await navigation(page).getByRole('link', { name: 'Tasks', exact: true }).click()
  await page.getByLabel('Your task list', { exact: true }).selectOption('task-prep')
  await expect(page).toHaveURL('/tasks/task-prep')
  await page.goBack()
  await expect(page).toHaveURL('/tasks')
  await expect(page.getByLabel('Your task list', { exact: true })).toHaveValue('task-grades')
  await page.goForward()
  await expect(page.getByLabel('Your task list', { exact: true })).toHaveValue('task-prep')
  await navigation(page).getByRole('link', { name: 'Calendar', exact: true }).click()
  await page.getByRole('button', { name: 'Next month', exact: true }).click()
  await expect(page).toHaveURL('/calendar?month=2026-12')
  await page.getByRole('button', { name: 'Tuesday, December 8, no entries', exact: true }).click()
  await expect(page).toHaveURL('/calendar?date=2026-12-08')
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'December 2026 Schedule', exact: true })).toBeVisible()
  await expect(page.locator('.calendar-day.is-selected')).toHaveCount(0)
  await page.goForward()
  await expect(page.getByRole('button', { name: 'Tuesday, December 8, no entries', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Tuesday, Dec 8', exact: true })).toBeVisible()
})

test('keyboard users can skip the navigation and open pages without a focus trap', async ({ page }) => {
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to page content', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(content(page)).toBeFocused()
  const projects = navigation(page).getByRole('link', { name: 'Projects', exact: true })
  await projects.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/projects')
  await expect(content(page)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL('/projects')
  await navigation(page).getByRole('link', { name: 'Journal', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/journal')
})

test('Back restores timeline scroll and its glow continues working after a page change', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 800 })
  await page.evaluate(() => window.scrollTo(0, 400))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400)
  await navigation(page).getByRole('link', { name: 'Journal', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await page.goBack()
  await expect(page).toHaveURL('/')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400)
  const before = await page.locator('.timeline').evaluate((element) => element.style.getPropertyValue('--scroll-progress'))
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(() => page.locator('.timeline').evaluate((element) => element.style.getPropertyValue('--scroll-progress'))).not.toBe(before)
})

test('Back restores scroll instead of replaying a stale card-focus request', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 800 })
  await page.goto('/projects/proj-reading')
  await page.getByRole('link', { name: 'View your timeline', exact: true }).click()
  await expect(card(page, 'proj-reading')).toHaveClass(/is-highlighted/)
  await page.evaluate(() => window.scrollTo(0, 150))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(150)
  await navigation(page).getByRole('link', { name: 'Journal', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await page.goBack()
  await expect(page).toHaveURL('/')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(150)
})

test('filters individual cards, not entire mixed-type days, and retains the filter across page changes', async ({ page }) => {
  await selectTimelineFilter(page, 'Journal Notes')
  await expect(page.locator('.journey-card')).toHaveCount(1)
  await expect(page.locator('.journey-card')).toHaveAttribute('data-card-type', 'note')
  await expect(card(page, 'task-grades')).toHaveCount(0)
  await expect(page.locator('.quiet-badge')).toHaveText('Peek 1 card')
  await selectTimelineFilter(page, 'Tasks')
  await expect(page.locator('.journey-card')).toHaveCount(1)
  await expect(page.locator('.journey-card')).toHaveAttribute('data-card-type', 'task')
  await expect(card(page, 'evt-oquendo')).toHaveCount(0)
  await selectTimelineFilter(page, 'Events')
  await expect(page.locator('.journey-card')).toHaveCount(2)
  await expect(page.locator('.journey-card:not([data-card-type="event"])')).toHaveCount(0)
  await selectTimelineFilter(page, 'Projects')
  await expect(page.locator('.journey-card')).toHaveCount(2)
  await expect(page.locator('.journey-card:not([data-card-type="project"])')).toHaveCount(0)
  await navigation(page).getByRole('link', { name: 'Calendar', exact: true }).click()
  await timeline(page)
  await expect(filterTrigger(page)).toHaveAccessibleName('Filter journey cards: Projects')
  await expect(page.locator('.journey-card')).toHaveCount(2)
})

test('quiet-day links open their own item and the new-card page uses the gap date', async ({ page }) => {
  const quiet = page.getByRole('button', { name: /Nov 03 – 09/ })
  await quiet.click()
  await expect(quiet).toHaveAttribute('aria-expanded', 'true')
  await page.locator('.quiet-item-note').click()
  await expect(page).toHaveURL('/journal/note-lesson')
  await expect(page.getByLabel('Note title', { exact: true })).toHaveValue('Q2 Reading Comprehension Rubric Ideas')
  await page.goBack()
  await expect(quiet).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'Insert card here', exact: true }).click()
  await expect(page).toHaveURL('/new?type=event&date=2026-11-05')
  await expect(page.getByLabel('Journey date', { exact: false })).toHaveValue('2026-11-05')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page).toHaveURL('/')
  await quiet.click()
  await expect(quiet).toHaveAttribute('aria-expanded', 'false')
})

test('View on timeline can reveal and focus a reflection inside a closed quiet buffer', async ({ page }) => {
  await page.goto('/journal/note-lesson')
  await page.getByRole('link', { name: 'View on timeline', exact: true }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('button', { name: /Nov 03 – 09/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#card-note-lesson')).toBeVisible()
  await expect(page.locator('#card-note-lesson')).toHaveClass(/is-highlighted/)
})

test('task checks sync both ways, added actions join the card, and changes survive reload', async ({ page }) => {
  const timelineTask = card(page, 'task-grades')
  await timelineTask.getByRole('checkbox', { name: 'Send reminder SMS to 4 parents', exact: true }).check()
  await expect(timelineTask).toContainText('2 of 2 completed')
  await navigation(page).getByRole('link', { name: 'Tasks', exact: true }).click()
  await expect(page.locator('.hero-stat strong')).toHaveText('100%')
  await content(page).getByRole('checkbox', { name: /Export Q1 attendance sheet/ }).uncheck()
  await expect(page.locator('.hero-stat strong')).toHaveText('50%')
  const taskCard = content(page).locator('.checklist-panel')
  await taskCard.getByPlaceholder('Add a checklist item…').fill('Print the parent conference agenda')
  await taskCard.getByRole('button', { name: 'Add item', exact: true }).click()
  await expect(page.locator('.hero-stat strong')).toHaveText('33%')
  await timeline(page)
  await expect(timelineTask).toContainText('1 of 3 completed')
  await expect(timelineTask).toContainText('Print the parent conference agenda')
  await page.reload()
  await expect(timelineTask).toContainText('1 of 3 completed')
  await expect(timelineTask.getByRole('checkbox', { name: 'Export Q1 attendance sheet', exact: true })).not.toBeChecked()
})

test('project milestones update progress and reset the completed status correctly', async ({ page }) => {
  await openCard(page, 'proj-tos')
  await expect(page).toHaveURL('/projects/proj-tos')
  await expect(content(page).getByRole('checkbox')).toHaveCount(4)
  for (const checkbox of await content(page).getByRole('checkbox').all()) await checkbox.check()
  await expect(page.locator('.hero-stat strong')).toHaveText('100%')
  await timeline(page)
  await expect(card(page, 'proj-tos').locator('.project-status')).toHaveText('Completed')
  await expect(card(page, 'proj-tos').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  await openCard(page, 'proj-tos')
  await expect(page).toHaveURL('/projects/proj-tos')
  await expect(content(page).getByRole('checkbox')).toHaveCount(4)
  await expect(page.locator('.hero-stat strong')).toHaveText('100%')
  for (const checkbox of await content(page).getByRole('checkbox').all()) await checkbox.uncheck()
  await expect(page.locator('.hero-stat strong')).toHaveText('0%')
  await timeline(page)
  await expect(card(page, 'proj-tos').locator('.project-status')).toHaveText('Pending')
  await expect(card(page, 'proj-tos').locator('.project-status')).not.toHaveClass(/is-complete/)
  await page.reload()
  await expect(card(page, 'proj-tos').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
})

test('the reading festival opens its own eight milestones, not the assessment project', async ({ page }) => {
  await openCard(page, 'proj-reading')
  await expect(page).toHaveURL('/projects/proj-reading')
  await expect(content(page).getByRole('heading', { name: 'School-Wide Reading Festival & Literacy Booths', exact: true })).toBeVisible()
  await expect(content(page).getByRole('checkbox')).toHaveCount(8)
  await expect(page.locator('.hero-stat strong')).toHaveText('75%')
  await content(page).getByRole('checkbox', { name: /Set up literacy booths/ }).check()
  await timeline(page)
  await expect(card(page, 'proj-reading').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '88')
  await expect(card(page, 'proj-tos').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
})

test('journal editing is live, local, and safely renders entered markup as text', async ({ page }) => {
  await page.goto('/journal/note-observation')
  const title = '<img src=x onerror=alert(1)> A good teaching day'
  const body = 'A small win: every student shared an idea today.'
  await page.getByLabel('Note title', { exact: true }).fill(title)
  await page.getByLabel('Your reflection', { exact: true }).fill(body)
  await expect(page.locator('.journal-editor-footer')).toContainText('9 words')
  await timeline(page)
  await expect(card(page, 'note-observation').locator('h3')).toHaveText(title)
  await expect(card(page, 'note-observation').locator('.note-excerpt')).toHaveText(body)
  await expect(card(page, 'note-observation').locator('img')).toHaveCount(0)
  await page.goto('/journal/note-observation')
  await expect(page.getByLabel('Note title', { exact: true })).toHaveValue(title)
  await expect(page.getByLabel('Your reflection', { exact: true })).toHaveText(body)
})

for (const type of ['event', 'task', 'project', 'note'] as const) {
  test(`new ${type} cards are dated, persistent and connected to their own page`, async ({ page }) => {
    await openNewCard(page)
    const composer = page.locator('.composer-card')
    await composer.locator(`.option-${type}`).click()
    if (type === 'event') {
      await expect(composer.getByLabel('Calendar or organization', { exact: false })).toHaveValue('Personal Calendar')
      await expect(composer.getByLabel('Organizer', { exact: false })).toHaveValue('You')
    }
    await composer.getByLabel(type === 'project' ? 'Project title' : 'Card title', { exact: false }).fill(`My new ${type} card`)
    await composer.getByLabel(type === 'project' ? 'Start date' : 'Journey date', { exact: false }).fill('2026-11-05')
    if (type === 'project') await composer.getByLabel('Due date', { exact: false }).fill('2026-11-15')
    await composer.getByLabel(type === 'event' ? 'Notes and context' : type === 'task' ? 'Task-list context' : type === 'project' ? 'Project purpose' : 'A little context', { exact: false }).fill('Made just for this journey')
    if (type !== 'event') await composer.locator('#card-details').fill(type === 'note' ? 'An idea worth keeping.' : 'First step\nSecond step')
    await composer.getByRole('button', { name: type === 'task' ? 'Create task list' : type === 'project' ? 'Create project' : 'Add to Timeline', exact: true }).click()
    await expect(page).toHaveURL('/')
    await expect(page.locator('.filter-count')).toHaveText('9')
    const custom = page.locator('.journey-card').filter({ has: page.getByRole('heading', { name: `My new ${type} card`, exact: true }) })
    await expect(custom).toHaveCount(1)
    const dates = await page.locator('.day-row').evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label')))
    expect(dates[1]).toBe('Thursday, November 5, 2026')
    await custom.locator('.card-open').click({ position: { x: 10, y: 10 } })
    const path = { event: 'calendar', task: 'tasks', project: 'projects', note: 'journal' }[type]
    await expect(page).toHaveURL(new RegExp(`/${path}/${type}-[^/]+$`))
    await page.reload()
    if (type === 'event') await expect(content(page).getByRole('heading', { name: 'My new event card', exact: true })).toBeVisible()
    if (type === 'task' || type === 'project') await expect(content(page).getByRole('checkbox')).toHaveCount(2)
    if (type === 'note') await expect(content(page).getByLabel('Your reflection', { exact: true })).toHaveText('An idea worth keeping.')
    await timeline(page)
    await expect(page.locator('.filter-count')).toHaveText('9')
    await expect(page.getByRole('heading', { name: `My new ${type} card`, exact: true })).toBeVisible()
  })
}

test('the new-card page validates whitespace titles, focuses the form, and never traps navigation', async ({ page }) => {
  await navigation(page).getByRole('link', { name: 'Projects', exact: true }).click()
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await expect(page).toHaveURL('/new?type=project&date=2026-11-14')
  await expect(page.getByLabel('Project title', { exact: false })).toBeFocused()
  await expect(page.getByRole('radio', { name: 'Project', exact: true })).toBeChecked()
  await page.getByLabel('Project title', { exact: false }).fill('   ')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('title between 1 and 160 characters')
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL('/new?type=project&date=2026-11-14')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await navigation(page).getByRole('link', { name: 'Calendar', exact: true }).focus()
  await expect(navigation(page).getByRole('link', { name: 'Calendar', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page).toHaveURL('/projects')
  await page.goto('/new?type=note&date=2026-11-05')
  await expect(page.getByLabel('Journey date', { exact: false })).toHaveValue('2026-11-05')
  await expect(page.getByRole('radio', { name: 'Note', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page).toHaveURL('/')
})

test('the connected calendar uses real dates and opens same-day pages', async ({ page }) => {
  await navigation(page).getByRole('link', { name: 'Calendar', exact: true }).click()
  await expect(page.locator('.hero-stat strong')).toHaveText('2')
  await expect(page.locator('.calendar-day')).toHaveCount(30)
  await page.getByRole('button', { name: 'Wednesday, November 11, 2 personal cards', exact: true }).click()
  await expect(page).toHaveURL('/calendar?date=2026-11-11')
  await expect(page.locator('.agenda-item')).toHaveCount(2)
  await page.locator('.agenda-item-note').click()
  const preview = page.getByRole('dialog')
  await expect(preview.getByRole('heading', { name: 'Classroom Observation Reflections & Peer Feedback', exact: true })).toBeVisible()
  await preview.getByRole('button', { name: 'Close card preview', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Wednesday, November 11, 2 personal cards', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Next month', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'December 2026 Schedule', exact: true })).toBeVisible()
  await expect(page.locator('.calendar-day')).toHaveCount(31)
  await expect(page.locator('.hero-stat strong')).toHaveText('0')
  await page.getByRole('button', { name: 'Tuesday, December 8, no entries', exact: true }).click()
  await page.getByRole('button', { name: 'New event', exact: true }).click()
  await expect(page).toHaveURL('/new?type=event&date=2026-12-08')
})

test('Jump to Today finds a due project on the device date', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-14T12:00:00Z') })
  await selectTimelineFilter(page, 'Events')
  await page.getByRole('button', { name: 'Jump to Today', exact: true }).click()
  await expect(card(page, 'proj-tos')).toHaveClass(/is-highlighted/)
  await expect(filterTrigger(page)).toHaveAccessibleName('Filter journey cards: All Stream')
})

test('Jump to Today floats above bottom navigation and moves into the content canvas in landscape side-rail mode', async ({ page }) => {
  const jump = page.getByRole('button', { name: 'Jump to Today', exact: true })
  await expect(page.locator('.stream-header').getByRole('button', { name: 'Jump to Today', exact: true })).toHaveCount(0)
  await page.setViewportSize({ width: 812, height: 375 })
  await settle(page)
  const mobile = await page.evaluate(() => {
    const jump = document.querySelector<HTMLElement>('.timeline-jump-today')!.getBoundingClientRect()
    const navigation = document.querySelector<HTMLElement>('.bottom-bar')!.getBoundingClientRect()
    return { jump: { bottom: jump.bottom }, navigation: { top: navigation.top } }
  })
  expect(mobile.jump.bottom).toBeLessThanOrEqual(mobile.navigation.top)
  await page.setViewportSize({ width: 1194, height: 834 })
  await settle(page)
  const landscape = await page.evaluate(() => {
    const jump = document.querySelector<HTMLElement>('.timeline-jump-today')!.getBoundingClientRect()
    const navigation = document.querySelector<HTMLElement>('.bottom-bar')!.getBoundingClientRect()
    return { jump: { left: jump.left, bottom: jump.bottom }, navigation: { right: navigation.right }, viewport: innerHeight }
  })
  expect(landscape.jump.left).toBeGreaterThanOrEqual(landscape.navigation.right)
  expect(landscape.jump.bottom).toBeLessThanOrEqual(landscape.viewport)
  await expect(jump).toBeVisible()
})

test('every page and all five navigation links fit from narrow phones through desktop', async ({ page }) => {
  test.setTimeout(90_000)
  for (const path of ['/', '/calendar', '/tasks', '/projects', '/journal', '/new?type=project']) {
    await page.goto(path)
    for (const width of [320, 375, 600, 680, 681, 768, 834, 960, 961, 1024, 1180, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1024 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} viewport ${width}`).toBeLessThanOrEqual(width)
      for (const link of await navigation(page).getByRole('link').all()) {
        await expect(link).toBeVisible()
        const bounds = await link.boundingBox()
        expect(bounds!.x, `nav left at ${width}`).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width, `nav right at ${width}`).toBeLessThanOrEqual(width)
      }
      const overflow = await page.locator('.journey-card, .workspace-hero, .workspace-panel, .composer-card, .journal-editor').evaluateAll((elements) => elements
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => element.className))
      expect(overflow, `content overflow at ${path}, ${width}`).toEqual([])
    }
  }
})

test('handles corrupted or blocked storage without losing the working interface', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '{not valid JSON'), STORAGE_KEY)
  await page.reload()
  await expect(page.locator('.journey-card')).toHaveCount(6)
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage disabled', 'QuotaExceededError') } })
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Device storage is unavailable')
  await card(page, 'task-grades').getByRole('checkbox', { name: 'Send reminder SMS to 4 parents', exact: true }).check()
  await expect(card(page, 'task-grades')).toContainText('2 of 2 completed')
  await navigation(page).getByRole('link', { name: 'Tasks', exact: true }).click()
  await expect(page.locator('.hero-stat strong')).toHaveText('100%')
  await expect(page.locator('.save-warning')).toBeVisible()
})

test('the rebrand migrates existing Chronos Flow data without discarding saved edits or preferences', async ({ page }) => {
  await page.evaluate(({ current, legacy }) => {
    const state = JSON.parse(localStorage.getItem(current)!)
    state.cards.find((entry: { id: string }) => entry.id === 'note-observation').title = 'My saved reflection'
    state.bezel = true
    localStorage.setItem(legacy, JSON.stringify(state))
    localStorage.removeItem(current)
    localStorage.removeItem('kanso-pro:spaces:v1')
  }, { current: STORAGE_KEY, legacy: LEGACY_STORAGE_KEY })
  await page.reload()
  await page.goto('/journal/note-observation')
  await expect(page.getByLabel('Note title', { exact: true })).toHaveValue('My saved reflection')
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).bezel, STORAGE_KEY)).toBe(true)
  await page.getByLabel('Note title', { exact: true }).fill('A newer Kanso reflection')
  await page.reload()
  await expect(page.getByLabel('Note title', { exact: true })).toHaveValue('A newer Kanso reflection')
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).cards.find((entry: { id: string }) => entry.id === 'note-observation').title, LEGACY_STORAGE_KEY)).toBe('My saved reflection')
  await timeline(page)
  await expect(page.locator('.app-shell')).toHaveClass(/ipad-frame-active/)
})

test('shares local changes between tabs on different pages', async ({ page, context }) => {
  const second = await context.newPage()
  await second.goto('/tasks/task-grades')
  await expect(second.locator('.hero-stat strong')).toHaveText('50%')
  await card(page, 'task-grades').getByRole('checkbox', { name: 'Send reminder SMS to 4 parents', exact: true }).check()
  await expect(second.locator('.hero-stat strong')).toHaveText('100%')
  await second.getByRole('checkbox', { name: /Export Q1 attendance sheet/ }).uncheck()
  await expect(card(page, 'task-grades').getByRole('checkbox', { name: 'Export Q1 attendance sheet', exact: true })).not.toBeChecked()
  await second.close()
})

test('has no automated WCAG A/AA violations on the timeline, four pages, new-card page, or not-found page', async ({ page }) => {
  test.setTimeout(150_000)
  await audit(page)
  for (const name of ['Calendar', 'Tasks', 'Projects', 'Journal']) {
    const link = navigation(page).getByRole('link', { name, exact: true })
    await link.click()
    await expect(link).toHaveAttribute('aria-current', 'page')
    await expect(content(page)).toBeVisible()
    await audit(page)
  }
  // Contextual create actions intentionally use labels such as “New note” in their
  // workspace. Navigate directly so this audit covers the neutral new-card page.
  await page.goto('/new')
  await expect(page.getByRole('heading', { level: 1, name: 'New card', exact: true })).toBeVisible()
  await audit(page)
  await page.goto('/missing-page')
  await audit(page)
})

test('an empty new project can grow from zero to its first completed milestone', async ({ page }) => {
  await openNewCard(page)
  await page.locator('.option-project').click()
  await page.getByLabel('Project title', { exact: false }).fill('Start small')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  const project = page.locator('.journey-card').filter({ has: page.getByRole('heading', { name: 'Start small', exact: true }) })
  await expect(project.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  await project.locator('.card-open').click({ position: { x: 10, y: 10 } })
  await expect(content(page).getByRole('checkbox')).toHaveCount(0)
  await page.getByPlaceholder('Add a project milestone…').fill('Take the first step')
  await page.getByRole('button', { name: 'Add milestone', exact: true }).click()
  await content(page).getByRole('checkbox', { name: /Take the first step/ }).check()
  await expect(page.locator('.hero-stat strong')).toHaveText('100%')
  await timeline(page)
  await expect(project.locator('.project-status')).toHaveText('Completed')
  await expect(project.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
})

test('full pages stay usable and accessible on a narrow phone with persistent bottom navigation', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 375, height: 812 })
  await audit(page)
  for (const name of ['Calendar', 'Tasks', 'Projects', 'Journal']) {
    const link = navigation(page).getByRole('link', { name, exact: true })
    await link.click()
    await expect(link).toHaveAttribute('aria-current', 'page')
    await expect(content(page)).toBeVisible()
    const bounds = await content(page).boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375)
    expect(await content(page).evaluate((main) => main.scrollWidth <= main.clientWidth + 1)).toBe(true)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const navBounds = await navigation(page).boundingBox()
    expect(navBounds!.y).toBeGreaterThan(812 - 150)
    expect(navBounds!.y + navBounds!.height).toBeLessThanOrEqual(812)
    await audit(page)
  }
  // Journal’s contextual action opens a rich team note, so use the neutral card composer here.
  await page.goto('/new')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await audit(page)
})

test('unknown routes and wrong-type or missing cards have a useful recovery page', async ({ page }) => {
  for (const path of ['/not-a-page', '/projects/a/b']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page isn’t here.')
    await expect(page).toHaveTitle('Page not found · Kanso Pro')
    await page.getByRole('link', { name: 'Back to timeline', exact: true }).click()
    await expect(page).toHaveURL('/')
  }
  for (const path of ['/projects/missing-card', '/tasks/proj-reading', '/calendar/note-lesson', '/journal/missing']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('We couldn’t find that card.')
    await page.getByRole('link', { name: 'Back to workspace', exact: true }).click()
    await expect(page.locator('.not-found-page')).toHaveCount(0)
  }
  await page.goto('/calendar?date=bad&month=2026-99')
  await expect(page.getByRole('heading', { name: 'November 2026 Schedule', exact: true })).toBeVisible()
  await page.goto('/new?type=bad&date=not-a-date')
  await expect(page.getByRole('radio', { name: 'Event', exact: true })).toBeChecked()
  await expect(page.getByLabel('Journey date', { exact: false })).toHaveValue('2026-11-14')
})

test('card links can open in a separate tab while keeping the original timeline intact', async ({ page, context }) => {
  const link = card(page, 'proj-reading').locator('.card-open')
  await expect(link).toHaveAttribute('href', '/projects/proj-reading')
  const opened = context.waitForEvent('page')
  await link.click({ position: { x: 10, y: 10 }, modifiers: ['ControlOrMeta'] })
  const second = await opened
  await expect(second).toHaveURL('/projects/proj-reading')
  await expect(second.getByRole('checkbox')).toHaveCount(8)
  await expect(page).toHaveURL('/')
  await second.close()
})
