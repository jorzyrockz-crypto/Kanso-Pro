import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data'
import { journeyReducer, parseSavedState } from './store'

describe('the single journey store', () => {
  it('returns independent seed states', () => {
    const first = createInitialState()
    first.cards[0].title = 'Changed'
    expect(createInitialState().cards[0].title).not.toBe('Changed')
  })
  it('toggles a task without mutating the original or other cards', () => {
    const state = createInitialState()
    const next = journeyReducer(state, { type: 'toggle-item', cardId: 'task-grades', itemId: 'grades-2' })
    const before = state.cards.find((card) => card.id === 'task-grades')
    const after = next.cards.find((card) => card.id === 'task-grades')
    if (before?.type === 'task' && after?.type === 'task') {
      expect(before.subtasks[1].done).toBe(false)
      expect(after.subtasks[1].done).toBe(true)
    }
    expect(next.cards[0]).toBe(state.cards[0])
  })
  it('adds task actions and project milestones to their real card', () => {
    const state = createInitialState()
    const next = journeyReducer(state, { type: 'add-item', cardId: 'proj-reading', item: { id: 'new', title: 'New milestone', done: false } })
    const project = next.cards.find((card) => card.id === 'proj-reading')
    if (project?.type === 'project') expect(project.subtasks).toHaveLength(9)
    const other = next.cards.find((card) => card.id === 'proj-tos')
    if (other?.type === 'project') expect(other.subtasks).toHaveLength(4)
  })
  it('updates the selected journal note, including deliberate empty strings', () => {
    const state = createInitialState()
    const next = journeyReducer(state, { type: 'update-note', id: 'note-lesson', title: '', body: 'A quiet idea.' })
    const note = next.cards.find((card) => card.id === 'note-lesson')
    expect(note?.title).toBe('')
    if (note?.type === 'note') expect(note.body).toBe('A quiet idea.')
    expect(next.cards.find((card) => card.id === 'note-observation')).toEqual(state.cards.find((card) => card.id === 'note-observation'))
  })
  it('does not add duplicate cards', () => {
    const state = createInitialState()
    expect(journeyReducer(state, { type: 'add-card', card: state.cards[0] })).toBe(state)
  })
  it('persists the bezel preference', () => {
    expect(journeyReducer(createInitialState(), { type: 'toggle-bezel' }).bezel).toBe(true)
  })
})

describe('safe local persistence', () => {
  it('round-trips valid state', () => {
    const state = createInitialState()
    expect(parseSavedState(JSON.stringify(state))).toEqual(state)
  })
  it('ignores invalid JSON, obsolete versions, invalid dates and malformed cards', () => {
    for (const raw of [null, 'oops', '{}', '{"version":99,"cards":[],"bezel":false}', '[]']) expect(parseSavedState(raw)).toBeNull()
    const invalidDate = createInitialState()
    invalidDate.cards[0].date = '2026-11-31'
    expect(parseSavedState(JSON.stringify(invalidDate))).toBeNull()
    const missingList = JSON.parse(JSON.stringify(createInitialState()))
    missingList.cards.find((card: { type: string }) => card.type === 'task').subtasks = null
    expect(parseSavedState(JSON.stringify(missingList))).toBeNull()
  })
  it('rejects duplicate card and checklist IDs', () => {
    const state = createInitialState()
    state.cards.push(state.cards[0])
    expect(parseSavedState(JSON.stringify(state))).toBeNull()
    const another = createInitialState()
    const project = another.cards.find((card) => card.type === 'project')
    if (project?.type === 'project') project.subtasks.push(project.subtasks[0])
    expect(parseSavedState(JSON.stringify(another))).toBeNull()
  })
})
