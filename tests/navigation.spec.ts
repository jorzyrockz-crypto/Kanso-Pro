import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const navigation = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' })
const rect = (locator: Locator) => locator.evaluate((element) => {
  const { x, y, width, height, bottom, right } = element.getBoundingClientRect()
  return { x, y, width, height, bottom, right }
})
const settleLayout = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

async function expectBottomBar(page: Page, width: number, height: number) {
  const bar = await rect(navigation(page))
  expect(bar.x).toBeGreaterThanOrEqual(0)
  expect(bar.right).toBeLessThanOrEqual(width)
  expect(bar.y).toBeGreaterThanOrEqual(height - 150)
  expect(bar.bottom).toBeLessThanOrEqual(height)
  const links = await navigation(page).getByRole('link').evaluateAll((elements) => elements.map((element) => {
    const { x, y, width, height, right, bottom } = element.getBoundingClientRect()
    return { x, y, width, height, right, bottom }
  }))
  expect(links).toHaveLength(5)
  for (const link of links) {
    expect(link.width).toBeGreaterThanOrEqual(44)
    expect(link.height).toBeGreaterThanOrEqual(44)
    expect(link.x).toBeGreaterThanOrEqual(0)
    expect(link.right).toBeLessThanOrEqual(width)
    expect(link.y).toBeGreaterThanOrEqual(bar.y)
    expect(link.bottom).toBeLessThanOrEqual(height)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
}

async function expectPrimaryNavigation(page: Page, width: number, height: number) {
  if (width < 1024) return expectBottomBar(page, width, height)
  // This test uses the default fine pointer; touch breakpoints have dedicated coverage.
  const bar = await rect(navigation(page))
  expect(bar.x).toBeGreaterThanOrEqual(0)
  expect(bar.right).toBeLessThanOrEqual(232)
  expect(bar.bottom).toBeLessThanOrEqual(height)
  expect(bar.y).toBeLessThan(150)
  const links = await navigation(page).getByRole('link').evaluateAll(elements => elements.map(element => {
    const { width, height } = element.getBoundingClientRect()
    return { width, height }
  }))
  expect(links).toHaveLength(5)
  expect(links.every(link => link.width >= 44 && link.height >= 44)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
}

test('primary navigation stays fixed and reachable in portrait, landscape, and split-width layouts', async ({ page }) => {
  await page.goto('/projects/proj-reading')
  await expect(page.getByRole('heading', { level: 1, name: 'Projects', exact: true })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('header.topbar nav')).toHaveCount(0)
  await expect(navigation(page)).toHaveCount(1)
  expect(await page.locator('.bottom-bar').evaluate((element) => getComputedStyle(element).position)).toBe('fixed')
  for (const [width, height] of [[320, 640], [375, 812], [600, 900], [768, 1024], [834, 1194], [1194, 834], [1024, 768], [1366, 1024]]) {
    await page.setViewportSize({ width, height })
    await settleLayout(page)
    await page.evaluate(() => window.scrollTo(0, 0))
    await expectPrimaryNavigation(page, width, height)
    const before = await rect(navigation(page))
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await settleLayout(page)
    const after = await rect(navigation(page))
    expect(Math.abs(after.y - before.y)).toBeLessThan(1)
    expect(Math.abs(after.bottom - before.bottom)).toBeLessThan(1)
    await expectPrimaryNavigation(page, width, height)
  }
  for (const control of [page.getByRole('link', { name: 'Kanso Pro home', exact: true }), page.getByRole('button', { name: 'New card', exact: true })]) {
    const bounds = await rect(control)
    expect(bounds.width).toBeGreaterThanOrEqual(44)
    expect(bounds.height).toBeGreaterThanOrEqual(44)
  }
})

test('safe-area changes reserve matching space for page content and keep the footer above the bar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/journal/note-observation')
  await expect(page.getByLabel('Note title', { exact: true })).toBeVisible()
  // Simulate the values provided by CSS env() on a device with a home indicator/notch.
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-area-bottom', '34px')
    document.documentElement.style.setProperty('--safe-area-left', '24px')
    document.documentElement.style.setProperty('--safe-area-right', '24px')
  })
  await settleLayout(page)
  const bar = await rect(navigation(page))
  expect(812 - bar.bottom).toBeGreaterThanOrEqual(34)
  expect(bar.x).toBeGreaterThanOrEqual(24)
  expect(375 - bar.right).toBeGreaterThanOrEqual(24)
  await expectBottomBar(page, 375, 812)
  const insets = await page.evaluate(() => ({
    actual: document.querySelector('.bottom-bar')!.getBoundingClientRect().height,
    reserved: parseFloat(getComputedStyle(document.querySelector('.application')!).paddingBottom),
    scroll: parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom),
  }))
  expect(insets.reserved).toBeGreaterThanOrEqual(insets.actual)
  expect(insets.scroll).toBeGreaterThan(insets.actual)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await settleLayout(page)
  const footer = await rect(page.getByRole('contentinfo'))
  expect(footer.bottom).toBeLessThan(bar.y)
  const timelineLink = page.getByRole('link', { name: 'View your timeline', exact: true })
  await timelineLink.focus()
  await expect(timelineLink).toBeFocused()
  expect((await rect(timelineLink)).bottom).toBeLessThan(bar.y)
})

test('the end of the creation page and its success message remain clear of bottom navigation', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/new?type=note')
  await page.getByLabel('Card title', { exact: false }).fill('A reachable new chapter')
  await page.locator('#card-details').fill('A little room for a thought.')
  await page.getByRole('button', { name: 'Add to Timeline', exact: true }).scrollIntoViewIfNeeded()
  await settleLayout(page)
  const submit = await rect(page.getByRole('button', { name: 'Add to Timeline', exact: true }))
  expect(submit.bottom).toBeLessThan((await rect(navigation(page))).y)
  await page.getByRole('button', { name: 'Add to Timeline', exact: true }).click()
  await expect(page).toHaveURL('/')
  await expect(page.locator('.toast')).toBeVisible()
  expect((await rect(page.locator('.toast'))).bottom).toBeLessThan((await rect(navigation(page))).y)
  await expect(navigation(page).getByRole('link', { name: 'Timeline', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('the bottom bar remains outside the optional tablet bezel', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1194 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Tablet frame', exact: true }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/ipad-frame-active/)
  expect(await page.locator('.app-shell').evaluate((element) => element.contains(document.querySelector('.bottom-bar')))).toBe(false)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expectBottomBar(page, 834, 1194)
  await navigation(page).getByRole('link', { name: 'Calendar', exact: true }).click()
  await expect(page).toHaveURL('/calendar')
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar', exact: true })).toBeVisible()
})

test.describe('touch navigation', () => {
  test.use({ hasTouch: true })

  test('all five bottom tabs work with touch and remain real page links', async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1194 })
    await page.goto('/')
    for (const [label, path] of [['Calendar', '/calendar'], ['Tasks', '/tasks'], ['Projects', '/projects'], ['Journal', '/journal'], ['Timeline', '/']]) {
      const link = navigation(page).getByRole('link', { name: label, exact: true })
      await link.tap()
      await expect(page).toHaveURL(path)
      await expect(link).toHaveAttribute('aria-current', 'page')
      await expect(page.getByRole('main')).toBeVisible()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
    await page.setViewportSize({ width: 375, height: 812 })
    await navigation(page).getByRole('link', { name: 'Journal', exact: true }).tap()
    await expect(page).toHaveURL('/journal')
    await expectBottomBar(page, 375, 812)
  })
})
