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

  const [streamBox, railBox, viewport] = await Promise.all([
    stream.boundingBox(), rail.boundingBox(), page.evaluate(() => document.documentElement.scrollWidth),
  ])
  expect(streamBox!.x + streamBox!.width).toBeLessThanOrEqual(railBox!.x)
  expect(viewport).toBeLessThanOrEqual(1280)

  await rail.getByRole('button', { name: 'Task list', exact: true }).click()
  await expect(page).toHaveURL(/\/new\?type=task&date=/)
})
