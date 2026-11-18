import { describe, expect, it } from 'vitest'
import type { SpaceActivity } from '../types'
import { parseSpineActivityEnvelopeState, reconcileSpineActivityLedger, relevantSpineActivity } from './useSpineActivityEnvelope'

const teammate = (id: string, overrides: Partial<SpaceActivity> = {}): SpaceActivity => ({
  id,
  kind: 'assignment',
  title: 'A teammate updated a plan',
  detail: 'A shared update is ready to review.',
  href: '/tasks/task-grades',
  createdAt: '2026-11-15T09:00:00.000Z',
  actor: 'J. Santos',
  ...overrides,
})

describe('spine activity envelope', () => {
  it('quietly baselines established teammate activity instead of showing an old envelope', () => {
    const result = reconcileSpineActivityLedger(undefined, [teammate('earlier')])
    expect(result.incoming).toEqual([])
    expect(result.ledger).toEqual({ known: ['earlier'], opened: ['earlier'] })
  })

  it('keeps later teammate activity unopened while retaining already opened entries', () => {
    const baseline = reconcileSpineActivityLedger(undefined, [teammate('earlier')]).ledger
    const result = reconcileSpineActivityLedger(baseline, [teammate('new'), teammate('earlier')])
    expect(result.incoming.map((entry) => entry.id)).toEqual(['new'])
    expect(result.ledger.known).toEqual(['new', 'earlier'])
    expect(result.ledger.opened).toEqual(['earlier'])
  })

  it('excludes the current member’s activity and updates addressed to someone else', () => {
    const activity = [
      teammate('mine', { actor: 'You' }),
      teammate('for-someone-else', { target: 'Grade Level Chair' }),
      teammate('for-me', { target: 'You' }),
      teammate('team-wide'),
    ]
    expect(relevantSpineActivity(activity, 'You').map((entry) => entry.id)).toEqual(['for-me', 'team-wide'])
  })

  it('accepts only a bounded, valid persisted per-Space envelope state', () => {
    const parsed = parseSpineActivityEnvelopeState(JSON.stringify({ version: 1, spaces: { shared: { known: ['one', 'one', 3], opened: ['one'] }, bad: { known: 'no', opened: [] } } }))
    expect(parsed).toEqual({ version: 1, spaces: { shared: { known: ['one'], opened: ['one'] } } })
    expect(parseSpineActivityEnvelopeState('{bad')).toBeNull()
  })
})
