import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { mockFirebase } from '../helpers/firebase'
import { createInitialState, STORAGE_KEY } from '../../src/data'
import type { TaskCard } from '../../src/types'
import { emptyNotifications, NOTIFICATIONS_KEY } from '../../src/lib/notifications'
import { SEEN_BUILD_KEY } from '../../src/lib/updates'

async function ready(page: Page) {
  await page.goto('/settings#about')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await expect(page.locator('.pwa-state')).toContainText('Ready offline')
}

test('manifest, transparent branding, maskable icons, and install affordance', async ({ page, context }) => {
  const firebase = await mockFirebase(context)
  await page.addInitScript(() => Object.defineProperty(window, 'Notification', { configurable: true, value: class {
    static permission = 'default'
    static async requestPermission() { document.body.dataset.askedPermission = 'true'; return 'denied' }
  } }))
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
  const version = await page.locator('meta[name="app-version"]').getAttribute('content')
  expect(version).toMatch(/^\d+\.\d+\.\d+\+[a-f0-9]{16}$/)
  const activeVersion = await page.evaluate(async () => {
    const channel = new MessageChannel()
    return new Promise<string>(resolve => {
      channel.port1.onmessage = event => { channel.port1.close(); resolve(event.data.version) }
      navigator.serviceWorker.controller!.postMessage({ type: 'GET_VERSION' }, [channel.port2])
    })
  })
  expect(activeVersion).toBe(version)
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click()
  await expect(page.locator('.pwa-update')).toContainText('Kanso Pro is up to date.')
  await expect(page.locator('body')).toHaveAttribute('data-asked-permission', 'true')
  await page.getByRole('button', { name: /^Notifications(?:,|$)/ }).click()
  await page.getByRole('dialog', { name: 'Notifications' }).getByRole('link', { name: 'Open notification settings', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Browser notifications are blocked' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /^Browser notifications/ })).not.toBeChecked()

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
    // A changed worker with the same announced build must not create a false update.
    const sameVersion = original.replace(/const CACHE_NAME = CACHE_PREFIX \+ '([^']+)'/, "const CACHE_NAME = CACHE_PREFIX + '$1-pwa-smoke'")
    await writeFile('dist/sw.js', sameVersion)
    await page.getByRole('button', { name: 'Check for updates', exact: true }).click()
    await expect(page.locator('.pwa-update')).toContainText('Kanso Pro is up to date.')
    await expect(page.getByRole('button', { name: 'Restart to update', exact: true })).toHaveCount(0)
    await page.goto('/new?type=note')
    await page.locator('#card-title').fill('Unfinished — keep this draft')
    await writeFile('dist/sw.js', original
      .replace(/const CACHE_NAME = CACHE_PREFIX \+ '([^']+)'/, "const CACHE_NAME = CACHE_PREFIX + '$1-pwa-smoke'")
      .replace(/const APP_VERSION = '([^']+)'/, "const APP_VERSION = '$1-pwa-smoke'"))
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update() })
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)
    await expect(page.locator('#card-title')).toHaveValue('Unfinished — keep this draft')
    await expect(page).toHaveTitle(/^Update ready ·/)
    const restartUpdate = page.getByRole('button', { name: 'Restart to update', exact: true })
    const updateFab = page.locator('.app-update-fab')
    await expect(restartUpdate).toBeVisible()
    await expect(updateFab).toBeVisible()
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(updateFab).toHaveCSS('animation-name', 'update-fab-breathe')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(updateFab).toHaveCSS('animation-name', 'none')
    page.once('dialog', async dialog => { expect(dialog.message()).toContain('unfinished fields'); await dialog.dismiss() })
    await restartUpdate.click()
    await expect(page.locator('#card-title')).toHaveValue('Unfinished — keep this draft')
    expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true)
    await expect(restartUpdate).toBeVisible()
    const settings = await context.newPage()
    await settings.goto('/settings#about')
    const settingsUpdate = settings.locator('.pwa-update')
    const settingsRestart = settingsUpdate.getByRole('button', { name: 'Restart to update', exact: true })
    await expect(settingsRestart).toBeVisible()
    await expect(settingsUpdate).toContainText('Update ready')
    await Promise.all([
      settings.waitForEvent('framenavigated', { predicate: (frame) => frame === settings.mainFrame() }),
      settingsRestart.click(),
    ])
    await expect(settings.locator('.pwa-state')).toContainText('Ready offline')
    await expect(page.locator('#card-title')).toHaveValue('Unfinished — keep this draft')
    expect(await page.evaluate(() => localStorage.getItem('kanso-pro:journey:v1'))).toBe(saved)
    await expect(settingsUpdate.getByRole('button', { name: 'Restart to update', exact: true })).toHaveCount(0)
  } finally {
    await writeFile('dist/sw.js', original)
  }
})

test('a freshly updated app returns to the Timeline with the release card over a blurred workspace', async ({ page, context }) => {
  await mockFirebase(context)
  await page.goto('/projects/proj-reading')
  await page.evaluate((key) => localStorage.setItem(key, '0.0.0+previous-build'), SEEN_BUILD_KEY)
  await page.reload()
  await expect(page).toHaveURL('/')
  const release = page.getByRole('dialog', { name: 'Kanso Pro · Planning Space', exact: true })
  await expect(release).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Timeline', exact: true })).toBeVisible()
  await expect(page.locator('.about-updates-backdrop')).toHaveCSS('backdrop-filter', /blur/)
  await release.getByRole('button', { name: 'Close About and what’s new', exact: true }).click()
  await expect(release).toHaveCount(0)
})

test.describe('background delivery', () => {
  test.use({ timezoneId: 'UTC' })
  test('quiet background reminders wait, summarize once, and keep card details off the lock screen', async ({ page, context }) => {
    await mockFirebase(context)
    const planner = createInitialState()
    const source = planner.cards.find((card): card is TaskCard => card.type === 'task')!
    planner.cards = Array.from({ length: 4 }, (_, index): TaskCard => ({ ...source, id: `quiet-${index}`, title: `Private planner title ${index}`, date: '2026-11-14', reminder: '19:00', subtasks: [{ id: `quiet-step-${index}`, title: 'Private note', done: false }] }))
    const inbox = emptyNotifications()
    inbox.preferences.phone = true
    // Avoid restoring test data on a later navigation: this runs just once here.
    await page.addInitScript(({ plannerKey, plannerRaw, inboxKey, inboxRaw }) => {
      if (!localStorage.getItem(inboxKey)) {
        localStorage.setItem(plannerKey, plannerRaw)
        localStorage.setItem(inboxKey, inboxRaw)
      }
      Object.defineProperty(window, 'Notification', { configurable: true, value: class { static permission = 'granted' } })
    }, { plannerKey: STORAGE_KEY, plannerRaw: JSON.stringify(planner), inboxKey: NOTIFICATIONS_KEY, inboxRaw: JSON.stringify(inbox) })
    // The browser test's device-local zone is set independently of the runner.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.clock.install({ time: new Date('2026-11-14T18:59:00Z') })
    await ready(page)
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      Object.getPrototypeOf(registration).showNotification = async (title: string, options: NotificationOptions) => {
        const calls = JSON.parse(document.documentElement.dataset.phoneCalls || '[]')
        calls.push({ title, options })
        document.documentElement.dataset.phoneCalls = JSON.stringify(calls)
      }
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.clock.fastForward(60_001)
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).items.length, NOTIFICATIONS_KEY)).toBe(4)
    await expect(page.locator('html')).not.toHaveAttribute('data-phone-calls')
    await page.clock.fastForward(11 * 60 * 60_000)
    await expect.poll(() => page.evaluate(() => JSON.parse(document.documentElement.dataset.phoneCalls || '[]').length)).toBe(1)
    const calls = await page.evaluate(() => JSON.parse(document.documentElement.dataset.phoneCalls!))
    expect(calls[0].title).toBe('Kanso Pro · Reminder summary')
    expect(calls[0].options.body).toContain('4 planner reminders')
    expect(calls[0].options.data.url).toBe('/notifications')
    expect(JSON.stringify(calls)).not.toMatch(/Private planner title|Private note/)
    await page.clock.fastForward(60_001)
    expect(await page.evaluate(() => JSON.parse(document.documentElement.dataset.phoneCalls!).length)).toBe(1)
  })
})
