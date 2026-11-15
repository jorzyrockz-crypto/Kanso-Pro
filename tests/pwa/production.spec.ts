import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { mockFirebase } from '../helpers/firebase'

async function ready(page: Page) {
  await page.goto('/settings#about')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await expect(page.locator('.pwa-state')).toContainText('Ready offline')
}

test('manifest, transparent branding, maskable icons, and install affordance', async ({ page, context }) => {
  const firebase = await mockFirebase(context)
  await ready(page)
  const cdp = await context.newCDPSession(page)
  const manifest = await cdp.send('Page.getAppManifest')
  expect(manifest.errors).toEqual([])
  const data = JSON.parse(manifest.data!)
  expect(data.name).toBe('Kanso Pro')
  expect(data.display).toBe('standalone')
  expect(data.start_url).toBe('/')
  expect(data.scope).toBe('/')
  expect(data.icons).toHaveLength(3)
  expect((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([])
  const icons = await page.evaluate(async (entries: { src: string; sizes: string; purpose: string }[]) => Promise.all(entries.map(async (icon) => {
    const image = new Image()
    image.src = icon.src
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width; canvas.height = image.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, 0, 0)
    const corner = Array.from(ctx.getImageData(0, 0, 1, 1).data)
    const centerAlpha = ctx.getImageData(image.width / 2, image.height / 2, 1, 1).data[3]
    return { purpose: icon.purpose, sizes: `${image.width}x${image.height}`, expected: icon.sizes, corner, centerAlpha }
  })), data.icons)
  for (const icon of icons) {
    expect(icon.sizes).toBe(icon.expected)
    expect(icon.centerAlpha).toBe(255)
    expect(icon.corner[3]).toBe(icon.purpose === 'maskable' ? 255 : 0)
  }
  await expect(page.locator('.app-brand .kanso-icon')).toHaveAttribute('src', '/icons/icon-96.png')
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt')
    Object.assign(event, { prompt: async () => { document.body.dataset.installPrompted = 'true' }, userChoice: Promise.resolve({ outcome: 'dismissed' }) })
    window.dispatchEvent(event)
  })
  await page.getByRole('button', { name: 'Install Kanso Pro', exact: true }).click()
  await expect(page.locator('body')).toHaveAttribute('data-install-prompted', 'true')
  await expect(page.locator('.pwa-install-help')).toContainText('iPhone or iPad')
  await expect(page.locator('.pwa-settings-heading')).not.toContainText('Installed app')
  expect(firebase.requests).toEqual([])
  expect(firebase.unexpectedRequests).toEqual([])
})

test('cold offline deep links save local cards and preserve appearance without caching credentials', async ({ page, context }) => {
  const firebase = await mockFirebase(context)
  await ready(page)
  await page.getByRole('radio', { name: 'Dark', exact: true }).check()
  await context.setOffline(true)
  await page.goto('/new?type=note')
  await expect(page.getByRole('radio', { name: 'Note', exact: true })).toBeChecked()
  await page.locator('#card-title').fill('Written while offline')
  await page.locator('#card-details').fill('My plans stay on this device.')
  await page.getByRole('button', { name: 'Add to Timeline' }).click()
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('kanso-pro:journey:v1')!).cards.find((card: { title: string }) => card.title === 'Written while offline').id as string)
  await page.goto(`/journal/${id}`)
  await expect(page.locator('#main-content')).toContainText('My plans stay on this device.')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('#main-content')).toContainText('My plans stay on this device.')
  await page.goto('/settings#about')
  await expect(page.locator('.pwa-state')).toContainText('You’re offline')
  const cached = await page.evaluate(async () => {
    const urls: string[] = []
    for (const key of await caches.keys()) {
      if (key.startsWith('kanso-pro-shell-')) urls.push(...(await (await caches.open(key)).keys()).map((request) => request.url))
    }
    return urls
  })
  expect(cached.length).toBeGreaterThan(5)
  expect(cached.every((value) => {
    const url = new URL(value)
    return url.origin === 'http://127.0.0.1:4173' && !url.search && !/api|__\/auth|token|password|journey/.test(url.pathname)
  })).toBe(true)
  expect(firebase.requests).toEqual([])
  expect(firebase.unexpectedRequests).toEqual([])
})

test('an update waits for consent and never reloads a different tab’s unfinished card', async ({ page, context }) => {
  await mockFirebase(context)
  const original = await readFile('dist/sw.js', 'utf8')
  try {
    await ready(page)
    const saved = await page.evaluate(() => localStorage.getItem('kanso-pro:journey:v1'))
    await page.goto('/new?type=note')
    await page.locator('#card-title').fill('Unfinished — keep this draft')
    await writeFile('dist/sw.js', original.replace(/const CACHE_NAME = CACHE_PREFIX \+ '([^']+)'/, "const CACHE_NAME = CACHE_PREFIX + '$1-pwa-smoke'"))
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update() })
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)
    await expect(page.locator('#card-title')).toHaveValue('Unfinished — keep this draft')
    const settings = await context.newPage()
    await settings.goto('/settings#about')
    await expect(settings.getByRole('button', { name: 'Reload to update', exact: true })).toBeVisible()
    await expect(settings.locator('.pwa-update')).toContainText('unsaved')
    await Promise.all([
      settings.waitForEvent('framenavigated', { predicate: (frame) => frame === settings.mainFrame() }),
      settings.getByRole('button', { name: 'Reload to update', exact: true }).click(),
    ])
    await expect(settings.locator('.pwa-state')).toContainText('Ready offline')
    await expect(page.locator('#card-title')).toHaveValue('Unfinished — keep this draft')
    expect(await page.evaluate(() => localStorage.getItem('kanso-pro:journey:v1'))).toBe(saved)
    await expect(settings.getByRole('button', { name: 'Reload to update', exact: true })).toHaveCount(0)
  } finally {
    await writeFile('dist/sw.js', original)
  }
})
