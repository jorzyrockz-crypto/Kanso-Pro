import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data'
import type { AccountUser } from './account'
import { emptyWorkspace, googleSyncUser, isStarterWorkspace, mergeInitialWorkspace, workspaceChangesSince, workspaceFingerprint } from './workspaceSync'

const googleAccount: AccountUser = {
  uid: 'google-user', displayName: 'Planner', email: 'planner@example.test', photoURL: null, emailVerified: true, providers: ['google.com'],
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

  it('does not resurrect a card that a cloud tombstone removed', () => {
    const cloud = createInitialState()
    const local = createInitialState()
    const deleted = local.cards.find((card) => card.id === 'task-prep')!
    cloud.cards = cloud.cards.filter((card) => card.id !== deleted.id)
    const merged = mergeInitialWorkspace(cloud, local, true, [deleted.id])
    expect(merged.cards.some((card) => card.id === deleted.id)).toBe(false)
  })

  it('writes only changed personal cards and the changed workspace preference', () => {
    const before = createInitialState()
    const after = createInitialState()
    after.bezel = true
    after.cards[1] = { ...after.cards[1], title: 'Edited locally' }
    const changes = workspaceChangesSince(before, after)
    expect(changes.bezelChanged).toBe(true)
    expect(changes.cards.map((card) => card.id)).toEqual([after.cards[1].id])
    expect(changes.deletedCardIds).toEqual([])
  })

  it('records card removals as durable cloud tombstones', () => {
    const before = createInitialState()
    const removed = before.cards.find((card) => card.id === 'task-prep')!
    const after = { ...before, cards: before.cards.filter((card) => card.id !== removed.id) }
    const changes = workspaceChangesSince(before, after)
    expect(changes.cards).toEqual([])
    expect(changes.deletedCardIds).toEqual([removed.id])
  })

  it('uses an order-independent workspace fingerprint and a blank new cloud workspace', () => {
    const state = createInitialState()
    expect(workspaceFingerprint(state)).toBe(workspaceFingerprint({ ...state, cards: [...state.cards].reverse() }))
    expect(emptyWorkspace()).toEqual({ version: 1, cards: [], bezel: false })
  })
})
