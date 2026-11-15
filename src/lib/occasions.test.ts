import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data'
import type { EventCard, NewCardInput, OccasionChoice } from '../types'
import { createCard } from './journey'
import { isOccasionChoice, occasionLabel, OCCASION_OPTIONS, OCCASION_THEMES, resolveOccasion, suggestOccasion } from './occasions'
import { journeyReducer, parseSavedState } from './store'

const input: NewCardInput = {
  type: 'event', title: 'Mia’s birthday', date: '2026-11-14', context: 'Family',
  time: '09:00', allDay: true, dueDate: '2026-11-14', details: '',
}

function event(state = createInitialState()): EventCard {
  const card = state.cards.find((entry) => entry.id === 'evt-holiday')
  if (card?.type !== 'event') throw new Error('Expected the holiday event fixture')
  return card
}

describe('occasion suggestions', () => {
  it.each([
    ['Mia’s birthday', 'birthday'], ['ＢＩＲＴＨＤＡＹ dinner', 'birthday'], ['B-day lunch', 'birthday'],
    ['Kaarawan ni Ana', 'birthday'], ['Birthday party', 'birthday'],
    ['School graduation', 'celebration'], ['Our wedding anniversary', 'celebration'], ['Town fiesta', 'celebration'],
    ['New Year’s Eve', 'celebration'], ['Family vacation', 'holiday'], ['Christmas break', 'holiday'], ['Eid gathering', 'holiday'],
    ['All Souls’ Day (Additional Special Non-Working Holiday)', 'remembrance'], ["All Saints' Day", 'remembrance'],
    ['Undas', 'remembrance'], ['Memorial gathering', 'remembrance'], ['Remembrance anniversary', 'remembrance'],
    ['Faculty Alignment & Curriculum Sync', 'none'], ['Prepare the birthdaycard template', 'none'], ['', 'none'],
  ] as const)('suggests an appropriate theme for %s', (title, expected) => {
    expect(suggestOccasion(title)).toBe(expected)
  })

  it('uses the holiday flag as a fallback, not to override a more specific occasion', () => {
    expect(suggestOccasion('A day off', true)).toBe('holiday')
    expect(suggestOccasion('All Souls’ Day', true)).toBe('remembrance')
    expect(suggestOccasion('Birthday party', true)).toBe('birthday')
    expect(suggestOccasion('A day off', false)).toBe('none')
  })

  it('supports old events without a choice and explicit automatic detection', () => {
    expect(resolveOccasion({ title: 'A birthday' })).toBe('birthday')
    expect(resolveOccasion({ title: 'A birthday', occasion: 'auto' })).toBe('birthday')
    expect(resolveOccasion(event())).toBe('remembrance')
  })

  it('never overrides a manual selection or a deliberate no-illustration choice', () => {
    for (const occasion of ['none', 'birthday', 'celebration', 'holiday', 'remembrance'] as const) {
      expect(resolveOccasion({ title: 'A birthday party', holiday: true, occasion })).toBe(occasion)
    }
  })

  it('only accepts the six local choices and gives each theme a readable label', () => {
    expect(OCCASION_OPTIONS).toHaveLength(6)
    expect(new Set(OCCASION_OPTIONS.map((option) => option.value)).size).toBe(6)
    for (const { value } of OCCASION_OPTIONS) expect(isOccasionChoice(value)).toBe(true)
    for (const value of [undefined, null, 0, true, {}, [], 'Birthday', 'custom', '__proto__', '<svg>']) {
      expect(isOccasionChoice(value)).toBe(false)
    }
    for (const [theme, { label }] of Object.entries(OCCASION_THEMES)) {
      expect(occasionLabel(theme as keyof typeof OCCASION_THEMES)).toBe(label)
    }
    expect(occasionLabel('none')).toBe('No illustration')
  })
})

describe('occasion creation, editing, and backwards-compatible persistence', () => {
  it('creates automatically illustrated events without turning them into official holidays', () => {
    const card = createCard(input, [])
    expect(card).toMatchObject({ type: 'event', holiday: false, occasion: 'auto' })
    if (card.type === 'event') expect(resolveOccasion(card)).toBe('birthday')
  })

  it('preserves every manual choice through creation and a saved-state round trip', () => {
    for (const { value: occasion } of OCCASION_OPTIONS) {
      const card = createCard({ ...input, occasion }, [])
      const state = journeyReducer(createInitialState(), { type: 'add-card', card })
      expect(parseSavedState(JSON.stringify(state))?.cards.find((entry) => entry.id === card.id)).toEqual(card)
      expect(card).toMatchObject({ occasion, holiday: false })
    }
  })

  it('rejects invalid background input before creating an event', () => {
    expect(() => createCard({ ...input, occasion: 'not-a-theme' as OccasionChoice }, [])).toThrow('valid occasion background')
  })

  it('does not add occasion fields to tasks, projects, or notes', () => {
    for (const type of ['task', 'project', 'note'] as const) {
      expect(createCard({ ...input, type, occasion: 'birthday' }, [])).not.toHaveProperty('occasion')
    }
  })

  it('updates only the requested event, without mutating its metadata or the original state', () => {
    const state = createInitialState()
    const original = event(state)
    const next = journeyReducer(state, { type: 'update-event-background', id: original.id, occasion: 'celebration' })
    expect(event(next)).toEqual({ ...original, occasion: 'celebration' })
    expect(original).not.toHaveProperty('occasion')
    expect(event(next).holiday).toBe(true)
    expect(next.cards.find((card) => card.id === 'evt-oquendo')).toBe(state.cards.find((card) => card.id === 'evt-oquendo'))
    expect(parseSavedState(JSON.stringify(next))).toEqual(next)
  })

  it('ignores invalid theme actions and never edits a non-event', () => {
    const state = createInitialState()
    expect(journeyReducer(state, { type: 'update-event-background', id: 'evt-holiday', occasion: 'oops' as OccasionChoice })).toBe(state)
    for (const id of ['task-grades', 'proj-tos', 'note-observation', 'missing']) {
      expect(journeyReducer(state, { type: 'update-event-background', id, occasion: 'birthday' })).toEqual(state)
    }
  })

  it('continues to accept version-one saves with no background field', () => {
    const state = createInitialState()
    expect(state.version).toBe(1)
    expect(event(state)).not.toHaveProperty('occasion')
    const parsed = parseSavedState(JSON.stringify(state))
    expect(parsed).toEqual(state)
    expect(resolveOccasion(event(parsed!))).toBe('remembrance')
  })

  it('rejects malformed saved background values instead of rendering arbitrary artwork', () => {
    for (const occasion of [null, 123, {}, ['birthday'], 'https://example.test/image.svg', '<svg onload=alert(1)>']) {
      const state = createInitialState()
      Object.assign(event(state), { occasion })
      expect(parseSavedState(JSON.stringify(state))).toBeNull()
    }
  })
})
