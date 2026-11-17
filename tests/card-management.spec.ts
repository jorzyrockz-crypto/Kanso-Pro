import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createInitialState, STORAGE_KEY } from '../src/data'

async function seedJourney(page: Page, state = createInitialState()) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: JSON.stringify(state) })
}

type SavedChecklistCard = {
  id: string
  type: string
  date: string
  subtasks: Array<{ title: string; done: boolean; note?: string; time?: string }>
}

async function savedCard(page: Page, id: string) {
  return page.evaluate(({ key, id: cardId }) => {
    const state = JSON.parse(localStorage.getItem(key)!) as { cards: SavedChecklistCard[] }
    return state.cards.find((card) => card.id === cardId)
  }, { key: STORAGE_KEY, id })
}

test('Task lists and projects explain their distinct planning scopes while creating a card', async ({ page }) => {
  await page.goto('/new')

  await page.getByRole('radio', { name: 'Task list', exact: true }).check()
  const guide = page.locator('.composer-type-guide')
  await expect(guide).toContainText('A short, date-specific checklist')
  await expect(guide).toContainText('immediate actions and an optional reminder')
  await expect(page.getByLabel('Reminder time', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Task-list context', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Checklist items', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create task list', exact: true })).toBeVisible()

  await page.getByRole('radio', { name: 'Project', exact: true }).check()
  await expect(guide).toContainText('A larger outcome over time')
  await expect(guide).toContainText('milestones, a due date, progress, and collaborators')
  await expect(page.getByLabel('Project title', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Start date', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Due date', { exact: false })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'You', exact: true })).toBeChecked()
  await expect(page.getByLabel('Project purpose', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Project milestones', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Reminder time', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Create project', exact: true })).toBeVisible()
})

test('Calendar events and task cards can be edited without replacing task checklist progress', async ({ page }) => {
  await page.goto('/calendar')
  await page.getByRole('button', { name: 'Preview Faculty Alignment & Curriculum Sync details', exact: true }).click()
  await page.getByRole('link', { name: 'Edit event', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Edit Event', exact: true })).toBeVisible()
  await page.locator('#card-title').fill('Updated faculty alignment')
  await page.locator('#card-location').fill('Library meeting room')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page).toHaveURL('/calendar/evt-oquendo')
  await expect(page.getByText('Updated faculty alignment', { exact: true })).toBeVisible()

  await page.goto('/tasks/task-grades')
  await page.locator('.checklist-panel').getByRole('link', { name: 'Edit task list', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Edit Task list', exact: true })).toBeVisible()
  await page.locator('#card-title').fill('Updated advisory record')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page).toHaveURL('/tasks/task-grades')
  await expect(page.getByRole('heading', { name: 'Updated advisory record', exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox').first()).toBeChecked()
  await expect(page.getByRole('checkbox').nth(1)).not.toBeChecked()
})

test('Project tracking keeps the next milestone visible and preserves milestones when project details change', async ({ page }) => {
  await page.goto('/projects/proj-tos')
  await expect(page.getByRole('region', { name: 'Project pulse', exact: true })).toContainText('Draft 40-item multiple choice questionnaire')
  await page.getByRole('link', { name: 'Edit project', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Edit Project', exact: true })).toBeVisible()
  await page.locator('#card-title').fill('Updated quarterly assessment plan')
  await page.getByRole('checkbox', { name: 'You', exact: true }).check()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page).toHaveURL('/projects/proj-tos')
  await expect(page.getByRole('heading', { name: 'Updated quarterly assessment plan', exact: true })).toBeVisible()
  await expect(page.locator('.team-members')).toContainText('You')
  await expect(page.getByRole('checkbox').first()).toBeChecked()
  await expect(page.getByRole('checkbox').nth(1)).not.toBeChecked()

  await page.getByRole('button', { name: 'Edit milestone 2', exact: true }).click()
  await page.getByLabel('Milestone 2 assignee', { exact: true }).selectOption('You')
  await page.getByLabel('Milestone 2 target date', { exact: true }).fill('2026-11-20')
  await page.getByLabel('Milestone 2 tag', { exact: true }).fill('Q1')
  await page.getByLabel('Milestone 2 remarks', { exact: true }).fill('Waiting on the item review.')
  await page.getByRole('button', { name: 'Save milestone', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Project pulse', exact: true })).toContainText('Owned by You')
  await expect(page.getByText('Waiting on the item review.', { exact: true })).toBeVisible()
  await expect(page.locator('.project-milestone').nth(1)).toContainText('Target Nov 20')
  await page.locator('.project-milestone input[type="checkbox"]').nth(1).check()
  await page.locator('.project-milestone input[type="checkbox"]').nth(2).check()
  await page.locator('.project-milestone input[type="checkbox"]').nth(3).check()
  await expect(page.getByRole('region', { name: 'Project pulse', exact: true })).toContainText('All milestones completed')

  const summaryPage = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Export / Print summary', exact: true }).click()
  const summary = await summaryPage
  await expect(summary.getByRole('heading', { name: 'Updated quarterly assessment plan', exact: true })).toBeVisible()
  await expect(summary.getByText('Waiting on the item review.', { exact: true })).toBeVisible()
})

test('Projects offer compact links to other project workspaces beside the at-a-glance plan', async ({ page }) => {
  await page.goto('/projects/proj-tos')
  const otherProjects = page.locator('.project-other-projects')
  await expect(otherProjects).toBeVisible()
  await otherProjects.getByRole('link', { name: /School-Wide Reading Festival & Literacy Booths/ }).click()
  await expect(page).toHaveURL('/projects/proj-reading')
  await expect(page.getByRole('heading', { name: 'School-Wide Reading Festival & Literacy Booths', exact: true })).toBeVisible()
})

test('Event backgrounds are customized in the event editor, not its preview', async ({ page }) => {
  await page.goto('/calendar')
  await page.getByRole('button', { name: 'Preview Faculty Alignment & Curriculum Sync details', exact: true }).click()
  const preview = page.getByRole('dialog')
  await expect(preview.getByRole('group', { name: 'Occasion background', exact: true })).toHaveCount(0)
  await preview.getByRole('link', { name: 'Edit event', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Occasion background', exact: true })).toBeVisible()
})

test('Calendar event cards can be deleted deliberately', async ({ page }) => {
  await page.goto('/calendar')
  await page.getByRole('button', { name: "Preview All Souls’ Day (Additional Special Non-Working Holiday) details", exact: true }).click()
  await page.getByRole('button', { name: 'Delete event', exact: true }).click()
  const confirmation = page.getByRole('group', { name: 'Delete event', exact: true })
  await confirmation.getByRole('button', { name: 'Yes, delete event', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: "Preview All Souls’ Day (Additional Special Non-Working Holiday) details", exact: true })).toHaveCount(0)
})

test('Journal cards remain editable and can be deleted deliberately', async ({ page }) => {
  await page.goto('/journal/note-lesson')
  await page.getByLabel('Journal entry date', { exact: true }).fill('2026-11-12')
  await page.getByLabel('Journal timeline context', { exact: true }).fill('Updated private context')
  await expect(page.getByLabel('Journal entry date', { exact: true })).toHaveValue('2026-11-12')
  await expect(page.getByLabel('Journal timeline context', { exact: true })).toHaveValue('Updated private context')
  await page.getByRole('button', { name: 'Delete journal entry', exact: true }).click()
  const confirmation = page.getByRole('group', { name: 'Delete journal entry', exact: true })
  await expect(confirmation).toContainText('Delete this journal entry?')
  await confirmation.getByRole('button', { name: 'Yes, delete journal entry', exact: true }).click()
  await expect(page).toHaveURL('/journal')
  await expect(page.getByRole('link', { name: 'Open Text journal entry: Q2 Reading Comprehension Rubric Ideas', exact: true })).toHaveCount(0)
})

test('Task cards can be deleted from their workspace with a confirmation step', async ({ page }) => {
  await page.goto('/tasks/task-prep')
  await page.locator('.checklist-panel').getByRole('button', { name: 'Delete task list', exact: true }).click()
  const confirmation = page.getByRole('group', { name: 'Delete task list', exact: true })
  await confirmation.getByRole('button', { name: 'Yes, delete task list', exact: true }).click()
  await expect(page).toHaveURL('/tasks')
  await expect(page.getByRole('option', { name: 'Weekly Classroom Supply Inventory', exact: true })).toHaveCount(0)
})

test('Task checklist items support lightweight details, ordering, deletion, and clearing completed work', async ({ page }) => {
  await page.goto('/tasks/task-grades')
  const hero = page.locator('.hero-task')
  const panel = page.locator('.checklist-panel')
  await expect(hero.getByRole('heading', { name: 'Finalize Advisory Class Record & Parent Slips', exact: true })).toBeVisible()
  await expect(hero).toContainText('Planned Nov 11')
  await expect(panel.getByRole('heading', { name: 'Checklist', exact: true })).toBeVisible()
  await expect(panel).not.toContainText('Connected to your timeline task list')
  await expect(panel).not.toContainText('High priority')
  await expect(panel.getByRole('button', { name: 'Clear completed', exact: true })).toBeVisible()

  await panel.getByRole('button', { name: 'Edit checklist item 2', exact: true }).click()
  await panel.getByLabel('Checklist item 2 title', { exact: true }).fill('Follow up with four parents')
  await panel.getByLabel('Checklist item 2 time', { exact: true }).fill('09:15')
  await panel.getByLabel('Checklist item 2 note', { exact: true }).fill('Call before lunch.')
  await panel.getByRole('button', { name: 'Save item', exact: true }).click()
  await expect(panel.locator('.task-check-item').nth(1)).toContainText('9:15 AM · Call before lunch.')

  await panel.getByRole('button', { name: 'Move checklist item 2 up', exact: true }).click()
  await expect(panel.locator('.task-check-item').first()).toContainText('Follow up with four parents')
  let saved = await savedCard(page, 'task-grades')
  expect(saved?.subtasks.map((item) => item.title)).toEqual(['Follow up with four parents', 'Export Q1 attendance sheet'])
  expect(saved?.subtasks[0]).toMatchObject({ done: false, time: '09:15', note: 'Call before lunch.' })

  await panel.getByRole('button', { name: 'Delete checklist item 1', exact: true }).click()
  await panel.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(panel.locator('.task-check-item')).toHaveCount(1)
  await panel.getByRole('button', { name: 'Clear completed', exact: true }).click()
  await expect(panel.locator('.task-check-item')).toHaveCount(0)
  await expect(panel.getByText('No items yet. Add the first one below.', { exact: true })).toBeVisible()
  saved = await savedCard(page, 'task-grades')
  expect(saved?.subtasks).toEqual([])
})

test('Task lists move unchecked work to tomorrow and can become a project with its completion state', async ({ page }) => {
  await page.goto('/tasks/task-prep')
  await page.getByRole('button', { name: 'Move unfinished to tomorrow', exact: true }).click()
  await expect(page).toHaveURL(/\/tasks\/task-/)
  await expect(page.getByRole('heading', { name: 'Weekly Classroom Supply Inventory · follow-up', exact: true })).toBeVisible()
  await expect(page.locator('.task-check-item input[type="checkbox"]')).not.toBeChecked()
  const movedId = new URL(page.url()).pathname.split('/').pop()!
  const moved = await savedCard(page, movedId)
  const tomorrow = await page.evaluate(() => {
    const date = new Date()
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() + 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
  expect(moved?.date).toBe(tomorrow)
  expect(moved?.subtasks).toMatchObject([{ title: 'Check classroom supplies and note what needs restocking', done: false }])
  expect((await savedCard(page, 'task-prep'))?.subtasks).toEqual([])

  await page.goto('/tasks/task-grades')
  await page.getByRole('button', { name: 'Promote to project', exact: true }).click()
  await expect(page).toHaveURL(/\/projects\/project-/)
  await expect(page.getByRole('heading', { name: 'Finalize Advisory Class Record & Parent Slips', exact: true })).toBeVisible()
  await expect(page.locator('.project-milestone input[type="checkbox"]').first()).toBeChecked()
  await expect(page.locator('.project-milestone input[type="checkbox"]').nth(1)).not.toBeChecked()
  expect(await savedCard(page, 'task-grades')).toBeUndefined()
  const projectId = new URL(page.url()).pathname.split('/').pop()!
  const project = await savedCard(page, projectId)
  expect(project?.type).toBe('project')
  expect(project?.subtasks.map((item) => item.done)).toEqual([true, false])
})

test('Tasks show a passed reminder for today and retain their accessible glance details on a dark phone layout', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T12:00:00') })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.emulateMedia({ colorScheme: 'dark' })
  const state = createInitialState()
  state.cards = state.cards.map((card) => card.id === 'task-grades' ? {
    ...card,
    date: '2026-11-15',
    reminder: '09:00',
  } : card)
  await seedJourney(page, state)
  await page.goto('/tasks/task-grades')

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('.reminder-pill.is-passed')).toContainText('Passed · 9:00 AM')
  const glance = page.getByRole('complementary', { name: 'Task list context', exact: true })
  await expect(glance).toBeVisible()
  await expect(glance).toContainText('At a glance')
  await expect(glance).toContainText('Passed · 9:00 AM')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('The Tasks empty state explains the purpose of a new task list', async ({ page }) => {
  const state = createInitialState()
  state.cards = state.cards.filter((card) => card.type !== 'task')
  await seedJourney(page, state)
  await page.goto('/tasks')
  await expect(page.getByRole('heading', { name: 'Small steps start here', exact: true })).toBeVisible()
  await expect(page.getByText('Keep related, date-specific actions together. Add a reminder when the timing matters.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create a task list', exact: true })).toBeVisible()
})
