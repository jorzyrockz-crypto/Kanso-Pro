import { expect, test } from '@playwright/test'
import { createInitialState, STORAGE_KEY } from '../src/data'
import { CALENDAR_SOURCES_STORAGE_KEY } from '../src/lib/calendarSources'

test('desktop Timeline keeps a planning desk beside the Journey Stream', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  const stream = page.locator('#journey-stream')
  const rail = page.getByRole('complementary', { name: 'Desktop planning summary', exact: true })
  await expect(rail).toBeVisible()
  await expect(rail.getByRole('heading', { name: 'At a glance', exact: true })).toBeVisible()
  await expect(rail.getByRole('heading', { name: 'Task lists to finish', exact: true })).toBeVisible()
  await expect(rail.getByRole('heading', { name: 'Carry forward', exact: true })).toBeVisible()
  await expect(rail.getByRole('button', { name: 'Task list', exact: true })).toBeVisible()

  const [headerBox, streamBox, railBox, viewport] = await Promise.all([
    page.locator('.stream-header').boundingBox(), stream.boundingBox(), rail.boundingBox(), page.evaluate(() => document.documentElement.scrollWidth),
  ])
  expect(headerBox!.x + headerBox!.width).toBeLessThanOrEqual(railBox!.x)
  expect(Math.abs(headerBox!.y - railBox!.y)).toBeLessThanOrEqual(1)
  expect(streamBox!.x + streamBox!.width).toBeLessThanOrEqual(railBox!.x)
  expect(viewport).toBeLessThanOrEqual(1280)

  const moveToToday = rail.getByRole('button', { name: /Move .* to today/ }).first()
  const moveActionName = await moveToToday.getAttribute('aria-label')
  expect(moveActionName).not.toBeNull()
  await moveToToday.click()
  await expect(rail.getByRole('button', { name: moveActionName! })).toHaveCount(0)

  await rail.getByRole('button', { name: 'Task list', exact: true }).click()
  await expect(page).toHaveURL(/\/new\?type=task&date=/)
})

test('Planning Desk keeps Today task lists out of the separate focus list', async ({ page }) => {
  const state = createInitialState()
  state.cards = state.cards.map((card) => card.id === 'task-grades' ? { ...card, date: '2026-11-15' } : card.id === 'task-prep' ? { ...card, quiet: false, date: '2026-11-16' } : card)
  await page.clock.install({ time: new Date('2026-11-15T12:00:00Z') })
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: JSON.stringify(state) })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  const rail = page.getByRole('complementary', { name: 'Desktop planning summary', exact: true })
  const today = rail.locator('section[aria-labelledby="desktop-today-title"]')
  const focus = rail.locator('section[aria-labelledby="desktop-focus-title"]')
  await expect(today.getByRole('link', { name: /Finalize Advisory Class Record/ })).toHaveCount(1)
  await expect(focus.getByRole('link', { name: /Finalize Advisory Class Record/ })).toHaveCount(0)
  await expect(focus.getByRole('link', { name: /Weekly Classroom Supply Inventory/ })).toHaveCount(1)
})

test('Timeline project cards keep progress, next milestone, due state, and an open-project link together', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-12T12:00:00Z') })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const project = page.locator('[data-card-id="proj-tos"]')
  await expect(project.getByRole('progressbar', { name: 'Quarterly Assessment Test & Table of Specifications (TOS) progress', exact: true })).toHaveAttribute('aria-valuenow', '25')
  await expect(project.locator('.project-next-milestone')).toContainText('Next: Draft 40-item multiple choice questionnaire & answer key')
  await expect(project.locator('.timeline-project-due')).toHaveText('2d left')
  const openProject = project.getByRole('link', { name: 'Open project', exact: true })
  await expect(openProject).toHaveAttribute('href', '/projects/proj-tos')
  await openProject.click()
  await expect(page).toHaveURL('/projects/proj-tos')
})

test('DepEd reference cards keep Annex details on their source badge and use one compact footer', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T12:00:00Z') })
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ version: 1, depedEnabled: true, legislatedEnabled: true, localSources: [] })), CALENDAR_SOURCES_STORAGE_KEY)
  await page.goto('/')

  const depEd = page.locator('.timeline-source-card[data-source-id="deped-sy-2026-2027"]').first()
  await expect(depEd).toContainText('DO 009, s. 2026 · Reference only')
  await expect(depEd).not.toContainText('Verified from DepEd Order')
  await expect(depEd.locator('.source-reference-badge')).toHaveAttribute('title', /Annex B \(pp\. 20–27\)/)

  const observance = page.locator('.timeline-source-card[data-source-id="deped-legislated-activities"]').first()
  await expect(observance).toContainText('DO 009, s. 2026 · Reference only')
  await expect(observance).not.toContainText('Legislated annual observance')
  await expect(observance.locator('.source-reference-badge')).toHaveAttribute('title', /Annex D \(pp\. 29–55\)/)
})

test('desktop workspaces keep active work beside its planning context', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })

  await page.goto('/tasks/task-grades')
  const taskPanel = page.locator('.task-workspace .checklist-panel')
  const taskContext = page.getByRole('complementary', { name: 'Task list context', exact: true })
  await expect(taskContext.getByRole('heading', { name: 'At a glance', exact: true })).toBeVisible()
  expect((await taskPanel.boundingBox())!.x + (await taskPanel.boundingBox())!.width).toBeLessThanOrEqual((await taskContext.boundingBox())!.x)

  await page.goto('/projects/proj-tos')
  const projectPanel = page.locator('.project-workspace .checklist-panel')
  const projectContext = page.getByRole('complementary', { name: 'Project context', exact: true })
  await expect(projectContext.getByRole('heading', { name: 'At a glance', exact: true })).toBeVisible()
  expect((await projectPanel.boundingBox())!.x + (await projectPanel.boundingBox())!.width).toBeLessThanOrEqual((await projectContext.boundingBox())!.x)

  await page.goto('/calendar')
  const [scopeToggle, calendarPanel, agendaPanel] = await Promise.all([page.locator('.calendar-workspace > .team-scope-toggle').boundingBox(), page.locator('.calendar-panel').boundingBox(), page.locator('.agenda-panel').boundingBox()])
  expect(scopeToggle!.y + scopeToggle!.height).toBeLessThanOrEqual(calendarPanel!.y)
  expect(calendarPanel!.x + calendarPanel!.width).toBeLessThanOrEqual(agendaPanel!.x)
  expect(Math.abs(calendarPanel!.y - agendaPanel!.y)).toBeLessThanOrEqual(1)

  await page.goto('/journal')
  await expect(page.locator('.journal-workspace-split')).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Journal context', exact: true })).toBeVisible()
  await expect(page.locator('.journal-hub, .journal-studio')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280)
})
