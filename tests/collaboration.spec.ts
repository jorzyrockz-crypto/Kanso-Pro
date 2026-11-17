import { expect, test } from '@playwright/test'

test('Spaces keep local team work separate and require Google before online invitations or sync', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')

  const switcher = page.getByRole('button', { name: /Switch workspace, current space: Personal Space/ })
  await expect(switcher).toBeVisible()
  await switcher.click()
  await expect(page.getByRole('dialog', { name: 'Switch workspace' })).toContainText('Personal Space')
  await page.getByRole('option', { name: /Curriculum Planning/ }).click()
  await expect(page.getByRole('button', { name: /Switch workspace, current space: Curriculum Planning/ })).toBeVisible()
  await expect(page.locator('.space-member-stack')).toHaveAttribute('aria-label', /J\. Santos/)
  await expect(page.getByText('Local Space', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Invite', exact: true })).toBeDisabled()

  await page.goto('/projects/proj-tos')
  await expect(page.getByRole('button', { name: 'All Team', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Assigned to Me/ }).click()
  await expect(page.getByRole('button', { name: /Assigned to Me/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'All Team', exact: true }).click()
  await page.getByRole('button', { name: 'Edit milestone 2', exact: true }).click()
  await page.getByLabel('Milestone 2 assignee', { exact: true }).selectOption('J. Santos')
  await page.getByRole('button', { name: 'Save milestone', exact: true }).click()
  await page.getByRole('button', { name: /Notifications/ }).click()
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toContainText('Assignment updated')
  await page.keyboard.press('Escape')

  await page.goto('/tasks/task-grades')
  await page.getByRole('button', { name: 'Add comment', exact: true }).first().click()
  await page.getByLabel('Add a comment', { exact: true }).fill('I can take the first pass this afternoon.')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('I can take the first pass this afternoon.', { exact: true })).toBeVisible()

  await page.goto('/journal')
  await expect(page.getByText('Team Notes · this device', { exact: true })).toBeVisible()
  await expect(page.getByText(/shared team note/i).first()).toBeVisible()
})
