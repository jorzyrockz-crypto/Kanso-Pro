import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from '../src/data'
import { CALENDAR_SOURCES_STORAGE_KEY } from '../src/lib/calendarSources'

const navigation = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' })
const filters = (page: Page) => page.getByRole('navigation', { name: 'Filter journey cards' })
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

test('mobile condenses Timeline filters while Calendar sources remains its own dropdown at every size', async ({ page }) => {
  const sourceSelect = page.getByLabel('Calendar sources', { exact: true })
  await expect(filters(page)).toBeVisible()
  await expect(sourceSelect).toHaveValue('shown')
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(filters(page)).toBeHidden()
  const filterSelect = page.getByRole('combobox', { name: 'Filter journey cards', exact: true })
  await expect(filterSelect).toHaveValue('all')
  const [filterBox, sourceBox] = await Promise.all([filterSelect.boundingBox(), sourceSelect.boundingBox()])
  expect(filterBox).not.toBeNull()
  expect(sourceBox).not.toBeNull()
  expect(Math.abs(filterBox!.y - sourceBox!.y)).toBeLessThanOrEqual(1)
  expect(filterBox!.x + filterBox!.width).toBeLessThanOrEqual(sourceBox!.x)
  await filterSelect.selectOption('task')
  await expect(filterSelect).toHaveValue('task')
  await sourceSelect.selectOption('hidden')
  await expect(sourceSelect).toHaveValue('hidden')
  await sourceSelect.selectOption('shown')
  await expect(sourceSelect).toHaveValue('shown')
})

test('the bottom navigation opens ordinary pages with URLs, active links, titles, and a single main landmark', async ({ page }) => {
  for (const [name, path, heading] of [
    ['Calendar', '/calendar', 'Calendar'], ['Tasks', '/tasks', 'Personal Tasks'],
    ['Projects', '/projects', 'Projects'], ['Journal', '/journal', 'Journal'],
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
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible()
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
    if (active === 'Calendar') await expect(page.locator('.selected-event h4')).toHaveText('Faculty Alignment & Curriculum Sync')
    if (active === 'Tasks') await expect(page.getByLabel('Your task list', { exact: true })).toHaveValue('task-prep')
    if (active === 'Projects') await expect(content(page).getByRole('checkbox')).toHaveCount(8)
    if (active === 'Journal') await expect(page.getByLabel('Open reflection', { exact: true })).toHaveValue('note-lesson')
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
  await page.getByRole('button', { name: 'Tuesday, December 8, 0 cards', exact: true }).click()
  await expect(page).toHaveURL('/calendar?date=2026-12-08')
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'December 2026 Schedule', exact: true })).toBeVisible()
  await expect(page.locator('.calendar-day.is-selected')).toHaveCount(0)
  await page.goForward()
  await expect(page.getByRole('button', { name: 'Tuesday, December 8, 0 cards', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dec 8 · Connected agenda', exact: true })).toBeVisible()
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
  await filters(page).getByRole('button', { name: 'Journal Notes', exact: true }).click()
  await expect(page.locator('.journey-card')).toHaveCount(1)
  await expect(page.locator('.journey-card')).toHaveAttribute('data-card-type', 'note')
  await expect(card(page, 'task-grades')).toHaveCount(0)
  await expect(page.locator('.quiet-badge')).toHaveText('Peek 1 card')
  await filters(page).getByRole('button', { name: 'Tasks', exact: true }).click()
  await expect(page.locator('.journey-card')).toHaveCount(1)
  await expect(page.locator('.journey-card')).toHaveAttribute('data-card-type', 'task')
  await expect(card(page, 'evt-oquendo')).toHaveCount(0)
  await filters(page).getByRole('button', { name: 'Events', exact: true }).click()
  await expect(page.locator('.journey-card')).toHaveCount(2)
  await expect(page.locator('.journey-card:not([data-card-type="event"])')).toHaveCount(0)
  await filters(page).getByRole('button', { name: 'Projects', exact: true }).click()
  await expect(page.locator('.journey-card')).toHaveCount(2)
  await expect(page.locator('.journey-card:not([data-card-type="project"])')).toHaveCount(0)
  await navigation(page).getByRole('link', { name: 'Calendar', exact: true }).click()
  await timeline(page)
  await expect(filters(page).getByRole('button', { name: 'Projects', exact: true })).toHaveAttribute('aria-pressed', 'true')
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
  await page.getByPlaceholder('Add a personal task…').fill('Print the parent conference agenda')
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
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
  await openCard(page, 'note-observation')
  const title = '<img src=x onerror=alert(1)> A good teaching day'
  const body = 'A small win: every student shared an idea today.'
  await page.getByLabel('Note title', { exact: true }).fill(title)
  await page.getByLabel('Your reflection', { exact: true }).fill(body)
  await expect(page.locator('.journal-editor-footer')).toContainText('9 words')
  await timeline(page)
  await expect(card(page, 'note-observation').locator('h3')).toHaveText(title)
  await expect(card(page, 'note-observation').locator('.note-excerpt')).toHaveText(body)
  await expect(card(page, 'note-observation').locator('img')).toHaveCount(0)
  await page.reload()
  await openCard(page, 'note-observation')
  await expect(page.getByLabel('Note title', { exact: true })).toHaveValue(title)
  await expect(page.getByLabel('Your reflection', { exact: true })).toHaveValue(body)
})

for (const type of ['event', 'task', 'project', 'note'] as const) {
  test(`new ${type} cards are dated, persistent and connected to their own page`, async ({ page }) => {
    await openNewCard(page)
    const composer = page.locator('.composer-card')
    await composer.locator(`.option-${type}`).click()
    await composer.getByLabel('Card title', { exact: false }).fill(`My new ${type} card`)
    await composer.getByLabel('Journey date', { exact: false }).fill('2026-11-05')
    if (type === 'project') await composer.getByLabel('Due date', { exact: false }).fill('2026-11-15')
    await composer.getByLabel('A little context', { exact: false }).fill('Made just for this journey')
    if (type !== 'event') await composer.locator('#card-details').fill(type === 'note' ? 'An idea worth keeping.' : 'First step\nSecond step')
    await composer.getByRole('button', { name: 'Add to Timeline', exact: true }).click()
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
    if (type === 'note') await expect(content(page).getByLabel('Your reflection', { exact: true })).toHaveValue('An idea worth keeping.')
    await timeline(page)
    await expect(page.locator('.filter-count')).toHaveText('9')
    await expect(page.getByRole('heading', { name: `My new ${type} card`, exact: true })).toBeVisible()
  })
}

test('the new-card page validates whitespace titles, focuses the form, and never traps navigation', async ({ page }) => {
  await navigation(page).getByRole('link', { name: 'Projects', exact: true }).click()
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await expect(page).toHaveURL('/new?type=project&date=2026-11-14')
  await expect(page.getByLabel('Card title', { exact: false })).toBeFocused()
  await expect(page.getByRole('radio', { name: 'Project', exact: true })).toBeChecked()
  await page.getByLabel('Card title', { exact: false }).fill('   ')
  await page.getByRole('button', { name: 'Add to Timeline', exact: true }).click()
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
  await page.getByRole('button', { name: 'Wednesday, November 11, 2 cards', exact: true }).click()
  await expect(page).toHaveURL('/calendar?date=2026-11-11')
  await expect(page.locator('.agenda-item')).toHaveCount(2)
  await page.locator('.agenda-item-note').click()
  await expect(page).toHaveURL('/journal/note-observation')
  await expect(page.getByLabel('Note title', { exact: true })).toHaveValue('Classroom Observation Reflections & Peer Feedback')
  await page.goBack()
  await expect(page.getByRole('button', { name: 'Wednesday, November 11, 2 cards', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Next month', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'December 2026 Schedule', exact: true })).toBeVisible()
  await expect(page.locator('.calendar-day')).toHaveCount(31)
  await expect(page.locator('.hero-stat strong')).toHaveText('0')
  await page.getByRole('button', { name: 'Tuesday, December 8, 0 cards', exact: true }).click()
  await page.getByRole('button', { name: 'New event', exact: true }).click()
  await expect(page).toHaveURL('/new?type=event&date=2026-12-08')
})

test('jump to today finds the current due project and the tablet frame preference is saved', async ({ page }) => {
  await filters(page).getByRole('button', { name: 'Events', exact: true }).click()
  await page.getByRole('button', { name: 'Jump to Today', exact: true }).click()
  await expect(card(page, 'proj-tos')).toHaveClass(/is-highlighted/)
  await expect(filters(page).getByRole('button', { name: /All Stream/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Tablet frame', exact: true }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/ipad-frame-active/)
  await navigation(page).getByRole('link', { name: 'Projects', exact: true }).click()
  await expect(navigation(page)).toBeVisible()
  await timeline(page)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Tablet frame', exact: true })).toHaveAttribute('aria-pressed', 'true')
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
  }, { current: STORAGE_KEY, legacy: LEGACY_STORAGE_KEY })
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
  test.setTimeout(90_000)
  await audit(page)
  for (const name of ['Calendar', 'Tasks', 'Projects', 'Journal']) {
    const link = navigation(page).getByRole('link', { name, exact: true })
    await link.click()
    await expect(link).toHaveAttribute('aria-current', 'page')
    await expect(content(page)).toBeVisible()
    await audit(page)
  }
  await openNewCard(page)
  await expect(page.getByRole('heading', { level: 1, name: 'New card', exact: true })).toBeVisible()
  await audit(page)
  await page.goto('/missing-page')
  await audit(page)
})

test('an empty new project can grow from zero to its first completed milestone', async ({ page }) => {
  await openNewCard(page)
  await page.locator('.option-project').click()
  await page.getByLabel('Card title', { exact: false }).fill('Start small')
  await page.getByRole('button', { name: 'Add to Timeline', exact: true }).click()
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
  await openNewCard(page)
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
    await expect(content(page).getByRole('heading', { level: 1 })).not.toHaveText('We couldn’t find that card.')
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
