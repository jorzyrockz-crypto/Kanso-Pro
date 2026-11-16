import { expect, test } from '@playwright/test'

test('desktop navigation can be collapsed and restores its local preference', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.evaluate(() => localStorage.removeItem('kanso-pro:sidebar-collapsed:v1'))
  await page.reload()

  const rail = page.locator('.bottom-bar')
  const toggle = page.getByRole('button', { name: 'Collapse navigation sidebar', exact: true })
  await expect(toggle).toBeVisible()
  await expect(rail).not.toHaveClass(/is-collapsed/)

  await toggle.click()
  await expect(rail).toHaveClass(/is-collapsed/)
  await expect(page.locator('html')).toHaveAttribute('data-sidebar-collapsed', 'true')
  await expect(page.getByRole('link', { name: 'Calendar', exact: true })).toHaveAttribute('title', 'Calendar')

  await page.reload()
  await expect(page.getByRole('button', { name: 'Expand navigation sidebar', exact: true })).toBeVisible()
  await expect(rail).toHaveClass(/is-collapsed/)
})
