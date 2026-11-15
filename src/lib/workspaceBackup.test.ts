import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../data'
import { parseSavedState } from './store'
import { buildWorkspaceBackup, downloadWorkspaceBackup } from './workspaceBackup'

const now = new Date('2027-02-28T23:59:00Z')
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('workspace-only JSON backups', () => {
  it('keeps the version-one schema and existing dated filename', () => {
    const state = createInitialState()
    const backup = buildWorkspaceBackup(state, now)
    expect(backup.fileName).toBe('kanso-pro-journey-2027-02-28.json')
    expect(JSON.parse(backup.json)).toEqual(state)
    expect(parseSavedState(backup.json)).toEqual(state)
    expect(backup.json).toContain('\n  "version": 1,')
  })
  it('never serializes accidental account/session fields at the root', () => {
    const state = { ...createInitialState(), user: { email: 'private@example.test' }, password: 'do-not-export', idToken: 'private-token', refreshToken: 'private-refresh' }
    const backup = buildWorkspaceBackup(state, now)
    expect(Object.keys(JSON.parse(backup.json)).sort()).toEqual(['bezel', 'cards', 'version'])
    expect(backup.json).not.toMatch(/private@example|do-not-export|private-token|private-refresh/)
  })
  it('preserves literal card content, edits, and the shared frame preference', () => {
    const state = createInitialState()
    state.bezel = true
    state.cards[0].title = '<script>not executable</script> · My plans'
    const before = structuredClone(state)
    const backup = buildWorkspaceBackup(state, now)
    expect(JSON.parse(backup.json)).toEqual(before)
    expect(state).toEqual(before)
  })
  it('supports an empty device workspace', () => {
    const state = { version: 1 as const, cards: [], bezel: false }
    expect(parseSavedState(buildWorkspaceBackup(state, now).json)).toEqual(state)
  })
})

function browserDownload() {
  const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
  const append = vi.fn()
  let release: (() => void) | undefined
  const timer = vi.fn((callback: () => void) => { release = callback; return 1 })
  vi.stubGlobal('document', { createElement: vi.fn(() => anchor), body: { append } })
  vi.stubGlobal('window', { setTimeout: timer })
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:device-backup')
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  return { anchor, append, timer, create, revoke, release: () => release?.() }
}

describe('local download lifecycle', () => {
  it('uses a JSON blob and cleans up the anchor and object URL', async () => {
    const browser = browserDownload()
    const state = createInitialState()
    downloadWorkspaceBackup(state)
    expect(browser.create).toHaveBeenCalledOnce()
    const blob = browser.create.mock.calls[0][0] as Blob
    expect(blob.type).toBe('application/json')
    expect(JSON.parse(await blob.text())).toEqual(state)
    expect(browser.anchor.href).toBe('blob:device-backup')
    expect(browser.anchor.download).toMatch(/^kanso-pro-journey-\d{4}-\d{2}-\d{2}\.json$/)
    expect(browser.append).toHaveBeenCalledWith(browser.anchor)
    expect(browser.anchor.click).toHaveBeenCalledOnce()
    expect(browser.anchor.remove).toHaveBeenCalledOnce()
    expect(browser.timer).toHaveBeenCalledWith(expect.any(Function), 1000)
    expect(browser.revoke).not.toHaveBeenCalled()
    browser.release()
    expect(browser.revoke).toHaveBeenCalledWith('blob:device-backup')
  })
  it('releases resources and rethrows a failed browser click', () => {
    const browser = browserDownload()
    browser.anchor.click.mockImplementation(() => { throw new Error('Download blocked') })
    expect(() => downloadWorkspaceBackup(createInitialState())).toThrow('Download blocked')
    expect(browser.anchor.remove).toHaveBeenCalledOnce()
    browser.release()
    expect(browser.revoke).toHaveBeenCalledOnce()
  })
  it('releases resources when the document rejects the link', () => {
    const browser = browserDownload()
    browser.append.mockImplementation(() => { throw new Error('Document unavailable') })
    expect(() => downloadWorkspaceBackup(createInitialState())).toThrow('Document unavailable')
    expect(browser.anchor.click).not.toHaveBeenCalled()
    expect(browser.anchor.remove).toHaveBeenCalledOnce()
    browser.release()
    expect(browser.revoke).toHaveBeenCalledOnce()
  })
  it('never clicks a link when the browser cannot create an object URL', () => {
    const browser = browserDownload()
    browser.create.mockImplementation(() => { throw new Error('Blob blocked') })
    expect(() => downloadWorkspaceBackup(createInitialState())).toThrow('Blob blocked')
    expect(browser.append).not.toHaveBeenCalled()
    expect(browser.anchor.click).not.toHaveBeenCalled()
  })
})
