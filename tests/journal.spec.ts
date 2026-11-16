import { expect, test } from '@playwright/test'

const navigation = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Main navigation' })

test('Journal offers the responsive note studio with local voice and private Firestore image paths', async ({ page }) => {
  await page.goto('/journal')
  await expect(page.getByRole('heading', { name: 'Recent notes', exact: true })).toBeVisible()
  await navigation(page).getByRole('button', { name: 'New note', exact: true }).click()
  await expect(page).toHaveURL('/journal?create=menu')
  await expect(page.getByRole('heading', { name: 'Start a private note', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Text note/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Voice note/ })).toBeVisible()

  await page.getByRole('button', { name: /Text note/ }).click()
  await expect(page).toHaveURL(/\/journal\/note-/)
  await page.getByLabel('Note title', { exact: true }).fill('A local journal note')
  const reflection = page.getByLabel('Your reflection', { exact: true })
  await reflection.fill('This note stays on this device.')
  await page.getByRole('button', { name: 'Checklist', exact: true }).click()
  await expect(reflection.locator('input[type="checkbox"]')).toHaveCount(1)
  await page.getByLabel('Tags, separated by commas', { exact: true }).fill('private, journal')
  await page.getByLabel('Note category', { exact: true }).selectOption('Personal')
  await page.locator('.studio-back-to-notes').click()
  await expect(page.getByRole('link', { name: 'Open Text note: A local journal note', exact: true })).toBeVisible()

  await navigation(page).getByRole('button', { name: 'New note', exact: true }).click()
  await page.getByRole('button', { name: /Voice note/ }).click()
  await expect(page.getByRole('button', { name: 'Start recording', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Checklist', exact: true })).toBeVisible()

  await page.goto('/journal?create=menu')
  const imageNote = page.getByRole('button', { name: /Image note/ })
  await expect(imageNote).toBeDisabled()
  await expect(imageNote).toContainText('Sign in with Google to store images privately.')
})

test('note studio uses a rail on larger screens and a focused editor on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/journal/note-lesson')
  await expect(page.getByRole('complementary', { name: 'Journal entries', exact: true })).toBeVisible()
  await expect(page.getByRole('toolbar', { name: 'Rich text formatting', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Your reflection', exact: true })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('complementary', { name: 'Journal entries', exact: true })).toBeHidden()
  await expect(page.locator('.studio-back-to-notes')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add photo', exact: true })).toBeDisabled()
})
