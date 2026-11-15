import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockFirebase } from './helpers/firebase'
import { createInitialState, STORAGE_KEY } from '../src/data'
import { MONTH_SCENES } from '../src/lib/months'
import type { EventCard } from '../src/types'

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' })
const settle = (page: Page) => page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))) })

async function layout(page: Page, width: number, height: number, coarse: boolean) {
  await page.setViewportSize({ width, height })
  await settle(page)
  const sidebar = coarse ? width >= 1000 && width > height && height >= 600 : width >= 1024
  const scaled = coarse && width >= 700 && height >= 600
  const rootSize = scaled ? Math.min(20, Math.max(16, width / 42)) : 16
  const state = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const bar = document.querySelector('.bottom-bar')!.getBoundingClientRect()
    const header = document.querySelector('.topbar')!.getBoundingClientRect()
    const main = document.querySelector('main')!.getBoundingClientRect()
    const outlet = document.querySelector('.page-outlet')!.getBoundingClientRect()
    return {
      coarse: matchMedia('(pointer: coarse)').matches,
      rootSize: parseFloat(root.fontSize), layout: root.getPropertyValue('--navigation-layout').trim(),
      bar: { x: bar.x, y: bar.y, right: bar.right, bottom: bar.bottom, width: bar.width },
      header: { x: header.x, width: header.width, bottom: header.bottom },
      mainX: main.x, outletX: outlet.x,
      bottomSpace: parseFloat(getComputedStyle(document.querySelector('.application')!).paddingBottom),
      scrollBottom: parseFloat(root.scrollPaddingBottom), overflow: document.documentElement.scrollWidth > innerWidth,
      columns: getComputedStyle(document.querySelector('.calendar-workspace')!).gridTemplateColumns.split(' ').length,
      control: document.querySelector('[aria-label="Next month"]')!.getBoundingClientRect().height,
      heading: parseFloat(getComputedStyle(document.querySelector('h1')!).fontSize),
    }
  })
  expect(state.coarse).toBe(coarse)
  expect(state.layout, `${width}×${height}`).toBe(sidebar ? 'sidebar' : 'bottom')
  expect(state.rootSize).toBeCloseTo(rootSize, 1)
  if (width >= 700) expect(state.heading).toBeCloseTo(rootSize * 1.875, 1)
  expect(state.overflow, `${width}×${height} overflow`).toBe(false)
  expect(await nav(page).getByRole('link').count()).toBe(5)
  expect(state.header.x).toBe(0)
  expect(state.header.width).toBeCloseTo(width, 0)
  if (sidebar) {
    expect(state.bar.width).toBeCloseTo((coarse ? 13 : 14.5) * rootSize, 0)
    expect(state.bar.y).toBeCloseTo(state.header.bottom, 0)
    expect(state.outletX).toBeCloseTo(state.bar.right, 0)
    expect(state.mainX).toBeGreaterThanOrEqual(state.bar.right)
    expect(state.bottomSpace).toBeLessThan(60)
    expect(state.scrollBottom).toBeLessThan(60)
    const links = await nav(page).getByRole('link').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height))
    expect(links.every(value => value >= (coarse ? 3 * rootSize : 44))).toBe(true)
  } else {
    expect(state.bar.bottom).toBe(height)
    expect(state.bar.y).toBeGreaterThan(height - 170)
    expect(state.outletX).toBe(0)
    expect(state.bottomSpace).toBeGreaterThanOrEqual(height - state.bar.y - 1)
  }
  if (coarse && width >= 640 && height >= 600) expect(state.control).toBeGreaterThanOrEqual(Math.max(44, rootSize * 2.5) - .1)
  if (coarse && scaled && (width < 1300 || width <= height)) expect(state.columns, `${width}×${height} calendar columns`).toBe(1)
  if (coarse && sidebar && width >= 1300) expect(state.columns).toBe(2)
  return state
}

test.describe('touch-aware fluid layout', () => {
  test.use({ hasTouch: true })
  test('phones, portrait/split tablets, landscape boundaries, and large tablet columns', async ({ page, context }) => {
    await mockFirebase(context)
    await page.goto('/calendar')
    for (const [width, height] of [[375, 812], [812, 375], [640, 900], [699, 1000], [700, 1000], [800, 1280], [999, 800], [1000, 800], [1194, 834], [1299, 900], [1300, 900], [1024, 1366], [1000, 599], [1000, 600]]) {
      await layout(page, width, height, true)
    }
  })

  test('sidebar reading position still selects the correct month when rotating the Timeline', async ({ page, context }) => {
    await mockFirebase(context)
    const state = createInitialState()
    const source = state.cards.find((card): card is EventCard => card.type === 'event')!
    state.cards = MONTH_SCENES.map((scene, index): EventCard => ({ ...source, id: `fluid-month-${scene.id}`, date: `2026-${scene.id}-14`, title: `${scene.name} planning`, holiday: false, occasion: 'none', side: index % 2 ? 'right' : 'left' }))
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: JSON.stringify(state) })
    await page.setViewportSize({ width: 1194, height: 834 })
    await page.goto('/')
    for (const [width, height] of [[1194, 834], [834, 1194]]) {
      await page.setViewportSize({ width, height })
      await settle(page)
      await page.locator('[data-timeline-month="2026-06"]').first().evaluate(element => {
        const header = document.querySelector('.stream-header')!.getBoundingClientRect().bottom
        const sidebar = getComputedStyle(document.documentElement).getPropertyValue('--navigation-layout').trim() === 'sidebar'
        const end = sidebar ? innerHeight : document.querySelector('.bottom-bar')!.getBoundingClientRect().top
        const readingArea = header + Math.max(0, end - header) * .35
        window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - readingArea, behavior: 'instant' })
      })
      await expect(page.locator('.month-backdrop')).toHaveAttribute('data-month-background', '2026-06')
      await expect(page.locator('.month-icon')).toHaveAttribute('aria-label', 'June 2026')
    }
  })

  test('rotation keeps focused drafts, theme, routes, and saved cards; entry pages never gain a rail', async ({ page, context }) => {
    const firebase = await mockFirebase(context)
    await page.setViewportSize({ width: 1194, height: 834 })
    await page.goto('/settings#appearance')
    await page.getByRole('radio', { name: 'Dark', exact: true }).check()
    await page.goto('/new?type=note')
    await page.locator('#card-title').fill('Keep this unfinished chapter')
    await page.locator('#card-details').fill('Rotate, without starting again.')
    const saved = await page.evaluate(() => localStorage.getItem('kanso-pro:journey:v1'))
    const address = page.url()
    for (const [width, height] of [[834, 1194], [600, 900], [1194, 834], [1000, 500], [1366, 1024]]) {
      await page.setViewportSize({ width, height })
      await settle(page)
      expect(page.url()).toBe(address)
      await expect(page.locator('#card-title')).toHaveValue('Keep this unfinished chapter')
      await expect(page.locator('#card-details')).toHaveValue('Rotate, without starting again.')
      await expect(page.locator('#card-details')).toBeFocused()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      expect(await page.evaluate(() => localStorage.getItem('kanso-pro:journey:v1'))).toBe(saved)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    }
    await page.getByRole('button', { name: 'Add to Timeline', exact: true }).click()
    await expect(page.locator('.toast')).toBeVisible()
    const toast = await page.locator('.toast-region').boundingBox()
    expect(toast!.x + toast!.width / 2).toBeCloseTo((1366 + 260) / 2, 0)
    await expect(nav(page).getByRole('link', { name: 'Timeline', exact: true })).toHaveAttribute('aria-current', 'page')
    await page.setViewportSize({ width: 800, height: 1280 })
    await settle(page)
    expect(await page.locator('.stream-header').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(800)
    await nav(page).getByRole('link', { name: 'Journal', exact: true }).tap()
    await expect(page).toHaveURL('/journal')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.goto('/sign-in')
    await expect(nav(page)).toHaveCount(0)
    expect(await page.locator('.page-outlet').evaluate(element => element.getBoundingClientRect().x)).toBe(0)
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome back.' })).toBeVisible()
    await page.locator('#account-email').fill('local-layout@example.test')
    await page.locator('#account-password').fill('Unsubmitted layout draft')
    for (const [width, height] of [[375, 812], [812, 375], [800, 1280], [1194, 834]]) {
      await page.setViewportSize({ width, height })
      await settle(page)
      await expect(nav(page)).toHaveCount(0)
      await expect(page.locator('#account-email')).toHaveValue('local-layout@example.test')
      await expect(page.locator('#account-password')).toHaveValue('Unsubmitted layout draft')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      expect(await page.locator('#account-password').evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16)
    }
    expect(firebase.requests).toEqual([])
    expect(firebase.unexpectedRequests).toEqual([])
  })
})

test('fine-pointer laptops never receive tablet scaling, even at identical widths', async ({ page, context }) => {
  await mockFirebase(context)
  await page.goto('/calendar')
  for (const [width, height] of [[375, 812], [800, 1280], [1000, 800], [1023, 768], [1024, 768], [1194, 834], [1440, 900], [1680, 1050]]) {
    await layout(page, width, height, false)
  }
  await nav(page).getByRole('link', { name: 'Tasks', exact: true }).click()
  await expect(page).toHaveURL('/tasks')
  await page.goBack()
  await expect(page).toHaveURL('/calendar')
  await expect(nav(page).getByRole('link', { name: 'Calendar', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.emulateMedia({ media: 'print' })
  await expect(nav(page)).toBeHidden()
  expect(await page.locator('.page-outlet').evaluate(element => element.getBoundingClientRect().x)).toBe(0)
})
