import { expect, test } from '@playwright/test'
import { createInitialState, STORAGE_KEY } from '../src/data'
import { CALENDAR_SOURCES_STORAGE_KEY } from '../src/lib/calendarSources'

const localObservanceSource = {
  version: 1,
  depedEnabled: false,
  legislatedEnabled: false,
  localSources: [{
    id: 'local-november-observance',
    label: 'November reference',
    sourceFileName: 'November reference.pdf',
    enabled: true,
    importedAt: '2026-11-01T00:00:00.000Z',
    entries: [{
      id: 'local-november-observance-1',
      sourceId: 'local-november-observance',
      title: 'November planning observance',
      date: '2026-11-01',
      endDate: '2026-11-30',
    }],
  }],
}

test('selected dates keep direct agenda entries first and place month observances in a collapsed section', async ({ page }) => {
  const state = createInitialState()
  state.cards = state.cards.map((card) => card.id === 'evt-oquendo' ? { ...card, date: '2026-11-14' } : card)
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: JSON.stringify(state) })
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: CALENDAR_SOURCES_STORAGE_KEY, value: localObservanceSource })
  await page.goto('/calendar?date=2026-11-14')

  const agenda = page.getByRole('region', { name: 'Saturday, Nov 14 agenda', exact: true })
  await expect(agenda.getByRole('heading', { name: 'Saturday, Nov 14', exact: true })).toBeVisible()
  await expect(agenda.locator(':scope > .agenda-list')).toContainText('Faculty Alignment & Curriculum Sync')
  const observances = agenda.getByRole('button', { name: /Month Observances/ })
  await expect(observances).toHaveAttribute('aria-expanded', 'false')
  await expect(agenda.locator('#month-observances-list')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Sunday, November 1, 1 calendar-source entry/ }).locator('.dot-source')).toHaveCount(1)
  await expect(page.getByRole('button', { name: /Saturday, November 14, 1 personal card/ }).locator('.dot-source')).toHaveCount(0)

  await observances.click()
  await expect(agenda.locator('#month-observances-list')).toContainText('November planning observance')
})

test('Calendar legend pills filter selected-date dots and agenda entries', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ version: 1, depedEnabled: false, legislatedEnabled: false, localSources: [] })), CALENDAR_SOURCES_STORAGE_KEY)
  await page.goto('/calendar?date=2026-11-11')

  const selectedDay = page.getByRole('button', { name: /Wednesday, November 11/ })
  const agenda = page.getByRole('region', { name: 'Wednesday, Nov 11 agenda', exact: true })
  await expect(selectedDay.locator('.dot-task')).toHaveCount(1)
  await expect(agenda).toContainText('Finalize Advisory Class Record & Parent Slips')
  await expect(agenda).toContainText('Classroom Observation Reflections & Peer Feedback')

  const tasks = page.getByRole('button', { name: 'Task lists', exact: true })
  await tasks.click()
  await expect(tasks).toHaveAttribute('aria-pressed', 'false')
  await expect(selectedDay.locator('.dot-task')).toHaveCount(0)
  await expect(agenda).not.toContainText('Finalize Advisory Class Record & Parent Slips')
  await expect(agenda).toContainText('Classroom Observation Reflections & Peer Feedback')

  const sources = page.getByRole('button', { name: 'Calendar source', exact: true })
  await sources.click()
  await expect(sources).toHaveAttribute('aria-pressed', 'false')
})

test('Calendar routes task and project agenda entries directly while events retain a detail preview', async ({ page }) => {
  const state = createInitialState()
  state.cards = state.cards.map((card) => card.id === 'proj-tos' || card.id === 'evt-oquendo' ? { ...card, date: '2026-11-11' } : card)
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: JSON.stringify(state) })
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ version: 1, depedEnabled: false, legislatedEnabled: false, localSources: [] })), CALENDAR_SOURCES_STORAGE_KEY)
  await page.goto('/calendar?date=2026-11-11')

  await page.getByRole('button', { name: 'Open Finalize Advisory Class Record & Parent Slips details', exact: true }).click()
  await expect(page).toHaveURL('/tasks/task-grades')

  await page.goto('/calendar?date=2026-11-11')
  await page.getByRole('button', { name: 'Open Quarterly Assessment Test & Table of Specifications (TOS) details', exact: true }).click()
  await expect(page).toHaveURL('/projects/proj-tos')

  await page.goto('/calendar?date=2026-11-11')
  await page.getByRole('button', { name: 'Preview Faculty Alignment & Curriculum Sync details', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('Calendar Today and Add controls use the real selected date for quick creation on a dark phone layout', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T12:00:00Z') })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/calendar?date=2026-11-10')

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(page).toHaveURL('/calendar?date=2026-11-15')
  const agenda = page.getByRole('region', { name: 'Sunday, Nov 15 agenda', exact: true })
  await expect(agenda.getByRole('heading', { name: 'Sunday, Nov 15', exact: true })).toBeVisible()
  await agenda.getByRole('button', { name: 'Add', exact: true }).click()
  const choices = agenda.getByRole('group', { name: 'Add a card on Sunday, November 15' })
  await expect(choices.getByRole('button', { name: 'Event', exact: true })).toBeVisible()
  await expect(choices.getByRole('button', { name: 'Task list', exact: true })).toBeVisible()
  await expect(choices.getByRole('button', { name: 'Project', exact: true })).toBeVisible()
  await expect(choices.getByRole('button', { name: 'Journal note', exact: true })).toBeVisible()
  await choices.getByRole('button', { name: 'Task list', exact: true }).click()
  await expect(page).toHaveURL('/new?type=task&date=2026-11-15')
})
