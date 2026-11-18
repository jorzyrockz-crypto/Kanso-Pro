import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { isNewBuild, OPEN_UPDATE_INTERVAL, RESUME_UPDATE_INTERVAL, shouldCheckOnResume, updateSurface } from './updates'

it('checks on resume after one minute and polls a foreground app every five minutes', () => {
  expect(shouldCheckOnResume(100, 100 + RESUME_UPDATE_INTERVAL - 1)).toBe(false)
  expect(shouldCheckOnResume(100, 100 + RESUME_UPDATE_INTERVAL)).toBe(true)
  expect(RESUME_UPDATE_INTERVAL).toBe(60_000)
  expect(OPEN_UPDATE_INTERVAL).toBe(5 * 60_000)
})
it('never announces an update to first-time users or on an unchanged build', () => {
  expect(isNewBuild(null, '1.1.0+a')).toBe(false)
  expect(isNewBuild('1.1.0+a', '1.1.0+a')).toBe(false)
  expect(isNewBuild('1.0.0+a', '1.1.0+b')).toBe(true)
})
it('uses the actual titlebar capability, browser banner, or guest touch toast', () => {
  expect(updateSurface(true, false, true)).toBe('titlebar')
  expect(updateSurface(false, false, true)).toBe('banner')
  expect(updateSurface(false, true, true)).toBe('banner')
  expect(updateSurface(false, true, false)).toBe('toast')
})

describe('service-worker notification click boundaries', () => {
  async function click(url: string, existing = true, base = '/') {
    const listeners: Record<string, (event: unknown) => void> = {}
    const client = { url: `https://kanso.test${base}`, focused: true, frameType: 'top-level', focus: vi.fn(async () => {}), postMessage: vi.fn() }
    const openWindow = vi.fn(async () => {})
    const self = { location: { origin: 'https://kanso.test' }, clients: { matchAll: async () => existing ? [client] : [], openWindow }, addEventListener: (name: string, callback: (event: unknown) => void) => { listeners[name] = callback } }
    const worker = readFileSync('src/service-worker.js', 'utf8')
      .replace('__CACHE_PREFIX__', 'kanso-pro-shell-test-').replace('__APP_BASE_PATH__', base).replace('__APP_INDEX_URL__', `${base}index.html`).replace('__PRECACHE_URLS__', '[]')
    runInNewContext(worker, { self, URL })
    let work = Promise.resolve()
    const close = vi.fn()
    listeners.notificationclick({ notification: { data: { url, id: 'reminder-id' }, close }, waitUntil: (value: Promise<void>) => { work = value } })
    await work
    return { client, openWindow, close }
  }
  it('focuses and messages an existing client without navigating/reloading its form', async () => {
    const { client, openWindow, close } = await click('/tasks/due-card')
    expect(close).toHaveBeenCalledOnce()
    expect(client.focus).toHaveBeenCalledOnce()
    expect(client.postMessage).toHaveBeenCalledWith({ type: 'OPEN_NOTIFICATION', url: '/tasks/due-card', id: 'reminder-id' })
    expect(openWindow).not.toHaveBeenCalled()
  })
  it('opens a safe local page when the app has no live window', async () => {
    const { openWindow } = await click('/notifications', false)
    expect(openWindow).toHaveBeenCalledWith('https://kanso.test/notifications#notification=reminder-id')
  })
  it('keeps project-site notification URLs inside the app directory', async () => {
    const { openWindow } = await click('/tasks/due-card', false, '/Kanso-Pro/')
    expect(openWindow).toHaveBeenCalledWith('https://kanso.test/Kanso-Pro/tasks/due-card#notification=reminder-id')
  })
  it.each(['https://evil.test/tasks/a', '//evil.test/notifications', '/api/private'])('will not open %s', async url => {
    const { client, openWindow } = await click(url)
    expect(client.postMessage).not.toHaveBeenCalled()
    expect(openWindow).not.toHaveBeenCalled()
  })
})
