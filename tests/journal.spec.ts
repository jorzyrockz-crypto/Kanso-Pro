import { expect, test } from '@playwright/test'

const navigation = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Main navigation' })

test('Journal offers private text and voice notes while reserving Firestore images and AI for their explicit paths', async ({ page }) => {
  await page.goto('/journal')
  await expect(page.getByRole('heading', { name: 'Recent notes', exact: true })).toBeVisible()
  await navigation(page).getByRole('button', { name: 'New note', exact: true }).click()
  await expect(page).toHaveURL('/journal?create=menu')
  await expect(page.getByRole('heading', { name: 'Start a private note', exact: true })).toBeVisible()
  await expect(page.getByLabel('AI Assist is a future upgrade')).toContainText('Coming in a future upgrade')

  await page.getByRole('button', { name: /Text note/ }).click()
  await expect(page).toHaveURL(/\/journal\/note-/)
  await page.getByLabel('Note title', { exact: true }).fill('A local journal note')
  await page.getByLabel('Your reflection', { exact: true }).fill('This note stays on this device.')
  await page.getByLabel('Tags, separated by commas', { exact: true }).fill('private, journal')
  await page.getByLabel('Note category', { exact: true }).selectOption('Personal')
  await page.getByRole('link', { name: 'All notes', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Open Text note: A local journal note', exact: true })).toBeVisible()

  await navigation(page).getByRole('button', { name: 'New note', exact: true }).click()
  await page.getByRole('button', { name: /Voice note/ }).click()
  await expect(page.getByRole('button', { name: 'Start recording', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'AI Assist', exact: true })).toBeVisible()

  await page.goto('/journal?create=menu')
  const imageNote = page.getByRole('button', { name: /Image note/ })
  await expect(imageNote).toBeDisabled()
  await expect(imageNote).toContainText('Sign in with Google to store images privately.')
})
