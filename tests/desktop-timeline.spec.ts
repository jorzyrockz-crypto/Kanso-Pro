import { expect, test } from '@playwright/test'

test('desktop Timeline keeps a planning desk beside the Journey Stream', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  const stream = page.locator('#journey-stream')
  const rail = page.getByRole('complementary', { name: 'Desktop planning summary', exact: true })
  await expect(rail).toBeVisible()
  await expect(rail.getByRole('heading', { name: 'At a glance', exact: true })).toBeVisible()
  await expect(rail.getByRole('heading', { name: 'Task lists to finish', exact: true })).toBeVisible()
  await expect(rail.getByRole('button', { name: 'Task list', exact: true })).toBeVisible()

  const [headerBox, streamBox, railBox, viewport] = await Promise.all([
    page.locator('.stream-header').boundingBox(), stream.boundingBox(), rail.boundingBox(), page.evaluate(() => document.documentElement.scrollWidth),
  ])
  expect(headerBox!.x + headerBox!.width).toBeLessThanOrEqual(railBox!.x)
  expect(Math.abs(headerBox!.y - railBox!.y)).toBeLessThanOrEqual(1)
  expect(streamBox!.x + streamBox!.width).toBeLessThanOrEqual(railBox!.x)
  expect(viewport).toBeLessThanOrEqual(1280)

  await rail.getByRole('button', { name: 'Task list', exact: true }).click()
  await expect(page).toHaveURL(/\/new\?type=task&date=/)
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
  const [calendarPanel, agendaPanel] = await Promise.all([page.locator('.calendar-panel').boundingBox(), page.locator('.agenda-panel').boundingBox()])
  expect(calendarPanel!.x + calendarPanel!.width).toBeLessThanOrEqual(agendaPanel!.x)

  await page.goto('/journal')
  await expect(page.locator('.journal-recent')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280)
})
