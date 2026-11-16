import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data'
import type { AccountUser } from './account'
import { emptyWorkspace, googleSyncUser, isStarterWorkspace, mergeInitialWorkspace, workspaceChangesSince, workspaceFingerprint } from './workspaceSync'

const googleAccount: AccountUser = {
  uid: 'google-user', displayName: 'Planner', email: 'planner@example.test', emailVerified: true, providers: ['google.com'],
}

describe('Google workspace sync policy', () => {
  it('only enables cloud sync for a Google-authenticated account', () => {
    expect(googleSyncUser(googleAccount)).toBe('google-user')
    expect(googleSyncUser({ ...googleAccount, providers: ['password'] })).toBeNull()
    expect(googleSyncUser(null)).toBeNull()
  })

  it('recognizes the untouched bundled starter workspace', () => {
    expect(isStarterWorkspace(createInitialState())).toBe(true)
    const changed = createInitialState()
    changed.cards[0].title = 'My own plan'
    expect(isStarterWorkspace(changed)).toBe(false)
  })

  it('keeps cloud cards for matching IDs while retaining distinct device cards', () => {
    const cloud = createInitialState()
    cloud.cards[0] = { ...cloud.cards[0], title: 'Cloud title' }
    const local = createInitialState()
    local.cards[0] = { ...local.cards[0], title: 'Device title' }
    local.cards.push({
      id: 'task-device-only', type: 'task', title: 'Device-only task', date: '2026-11-20', side: 'left', context: '', isCustom: true,
      reminder: undefined, subtasks: [],
    })
    const merged = mergeInitialWorkspace(cloud, local, true)
    expect(merged.cards.find((card) => card.id === cloud.cards[0].id)?.title).toBe('Cloud title')
    expect(merged.cards.some((card) => card.id === 'task-device-only')).toBe(true)
    expect(mergeInitialWorkspace(cloud, local, false)).toEqual(cloud)
  })

  it('writes only changed personal cards and the changed workspace preference', () => {
    const before = createInitialState()
    const after = createInitialState()
    after.bezel = true
    after.cards[1] = { ...after.cards[1], title: 'Edited locally' }
    const changes = workspaceChangesSince(before, after)
    expect(changes.bezelChanged).toBe(true)
    expect(changes.cards.map((card) => card.id)).toEqual([after.cards[1].id])
  })

  it('uses an order-independent workspace fingerprint and a blank new cloud workspace', () => {
    const state = createInitialState()
    expect(workspaceFingerprint(state)).toBe(workspaceFingerprint({ ...state, cards: [...state.cards].reverse() }))
    expect(emptyWorkspace()).toEqual({ version: 1, cards: [], bezel: false })
  })
})
