import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data'
import type { NewCardInput, TimelineSourceEntry } from '../types'
import { addDays, buildTimeline, calendarDays, createCard, daysBetween, focusCard, formatDate, formatTime, gapLabel, isValidDate, progress, projectStatus, shiftMonth } from './journey'

const input: NewCardInput = {
  type: 'event', title: 'A new little chapter', date: '2026-11-14', context: 'Personal',
  time: '09:00', allDay: true, dueDate: '2026-11-16', details: '',
}

function cards() { return createInitialState().cards }

const legislatedReference: TimelineSourceEntry = {
  id: 'deped-legislated-activities-childrens-month-2026',
  sourceId: 'deped-legislated-activities',
  sourceLabel: 'Legislated observance',
  sourceProvenance: 'DepEd Order No. 009, s. 2026, Annex D.',
  title: 'National Children’s Month',
  date: '2026-11-01',
  endDate: '2026-11-30',
  side: 'right',
  calendarSource: true,
}

describe('timezone-safe dates', () => {
  it('rejects malformed or rolled-over dates', () => {
    for (const invalid of ['', '11/14/2026', '2026-02-30', '2026-13-01', '2026-11-31', null, 123]) expect(isValidDate(invalid)).toBe(false)
    expect(isValidDate('2028-02-29')).toBe(true)
  })
  it('formats weekdays consistently, independent of local timezone', () => {
    expect(formatDate('2026-11-02', { weekday: 'long' })).toBe('Monday')
    expect(formatDate('2026-11-14', { weekday: 'long' })).toBe('Saturday')
  })
  it('moves across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
    expect(daysBetween('2026-11-02', '2026-11-10')).toBe(8)
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
  it('renders real twelve-hour times', () => {
    expect(formatTime('00:05')).toBe('12:05 AM')
    expect(formatTime('12:00')).toBe('12:00 PM')
    expect(formatTime('14:30')).toBe('2:30 PM')
    expect(formatTime('09:00', true)).toBe('09:00 AM')
    expect(formatTime()).toBe('')
  })
  it('labels quiet days across months without ambiguity', () => {
    expect(gapLabel('2026-11-03', '2026-11-09')).toBe('Nov 03 – 09')
    expect(gapLabel('2026-11-30', '2026-12-02')).toBe('Nov 30 – Dec 2')
  })
  it('lays out a Monday-first calendar with the correct November 2026 dates', () => {
    const days = calendarDays('2026-11')
    expect(days.length % 7).toBe(0)
    expect(days.slice(0, 6)).toEqual([null, null, null, null, null, null])
    expect(days[6]).toBe('2026-11-01')
    expect(days.filter(Boolean)).toHaveLength(30)
    expect(calendarDays('2028-02').filter(Boolean)).toHaveLength(29)
  })
})

describe('shared progress', () => {
  it('handles empty and complete checklists without NaN', () => {
    expect(progress([])).toEqual({ done: 0, total: 0, percent: 0 })
    expect(progress([{ done: true }, { done: false }, { done: false }])).toEqual({ done: 1, total: 3, percent: 33 })
    expect(progress([{ done: true }]).percent).toBe(100)
  })
  it('never labels an active project as pending', () => {
    expect(projectStatus(0)).toBe('Pending')
    expect(projectStatus(25)).toBe('In progress')
    expect(projectStatus(100)).toBe('Completed')
  })
})

describe('timeline grouping and real per-card filters', () => {
  it('keeps the two quiet cards in one genuine gap', () => {
    const timeline = buildTimeline(cards())
    const gap = timeline.find((entry) => entry.kind === 'gap')
    expect(gap).toMatchObject({ kind: 'gap', start: '2026-11-03', end: '2026-11-09' })
    expect(gap?.cards.map((card) => card.id)).toEqual(['note-lesson', 'task-prep'])
    expect(timeline.filter((entry) => entry.kind === 'day')).toHaveLength(5)
  })
  it('places enabled calendar references in dated rows without turning them into personal cards', () => {
    const timeline = buildTimeline(cards(), 'all', [legislatedReference])
    const sourceDay = timeline.find((entry) => entry.kind === 'day' && entry.date === '2026-11-01')
    expect(sourceDay?.cards).toEqual([legislatedReference])
    expect(timeline.flatMap((entry) => entry.cards).some((entry) => 'calendarSource' in entry && entry.calendarSource)).toBe(true)
    expect(buildTimeline(cards(), 'task', [legislatedReference]).flatMap((entry) => entry.cards)
      .some((entry) => 'calendarSource' in entry)).toBe(false)
  })
  it('shows only notes when a mixed task/note day is filtered', () => {
    const timeline = buildTimeline(cards(), 'note')
    const shown = timeline.flatMap((entry) => entry.cards)
    expect(shown).toHaveLength(2)
    expect(shown.every((card) => !('calendarSource' in card) && card.type === 'note')).toBe(true)
    expect(shown.some((card) => card.id === 'task-grades')).toBe(false)
  })
  it('does not invent task cards on an event-only day', () => {
    const timeline = buildTimeline(cards(), 'task')
    expect(timeline.filter((entry) => entry.kind === 'day').map((entry) => entry.date)).toEqual(['2026-11-11'])
  })
  it('inserts new cards chronologically and splits quiet gaps', () => {
    const initial = cards()
    const added = createCard({ ...input, date: '2026-11-05' }, initial)
    const timeline = buildTimeline([...initial, added])
    expect(timeline.filter((entry) => entry.kind === 'day').map((entry) => entry.date)).toEqual(['2026-11-02', '2026-11-05', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'])
    expect(timeline.find((entry) => entry.kind === 'gap')).toMatchObject({ start: '2026-11-06', end: '2026-11-09' })
    expect(timeline.flatMap((entry) => entry.cards)).toHaveLength(9)
  })
  it('promotes quiet items to normal cards when their date gains a scheduled card', () => {
    const initial = cards()
    const added = createCard({ ...input, date: '2026-11-06' }, initial)
    const timeline = buildTimeline([...initial, added])
    const day = timeline.find((entry) => entry.kind === 'day' && entry.date === '2026-11-06')
    expect(day?.cards).toHaveLength(2)
    expect(timeline.flatMap((entry) => entry.cards).map((card) => card.id)).toContain('task-prep')
    expect(new Set(timeline.flatMap((entry) => entry.cards).map((card) => card.id)).size).toBe(9)
  })
  it('focuses the assessment due on the sample focus date, not the old meeting', () => {
    expect(focusCard(cards(), '2026-11-14')?.id).toBe('proj-tos')
    expect(focusCard([], '2026-11-14')).toBeUndefined()
  })
})

describe('card creation', () => {
  it('validates titles, real dates, times and project due dates', () => {
    expect(() => createCard({ ...input, title: '  ' }, [])).toThrow('title')
    expect(() => createCard({ ...input, date: '2026-02-30' }, [])).toThrow('date')
    expect(() => createCard({ ...input, time: '25:00' }, [])).toThrow('time')
    expect(() => createCard({ ...input, type: 'project', dueDate: '2026-11-10' }, [])).toThrow('due date')
  })
  it('creates checklists from plain text and trims blank lines', () => {
    const card = createCard({ ...input, type: 'task', details: ' First action\n\n Second action ' }, [])
    expect(card.type).toBe('task')
    if (card.type === 'task') expect(card.subtasks.map((item) => item.title)).toEqual(['First action', 'Second action'])
  })
  it('keeps user input as text, never HTML, and alternates new-card sides', () => {
    const first = createCard({ ...input, title: '<img src=x onerror=alert(1)>' }, [])
    const second = createCard(input, [first])
    expect(first.title).toContain('<img')
    expect(first.side).toBe('left')
    expect(second.side).toBe('right')
    expect(first.id).not.toBe(second.id)
  })
  it('creates empty projects and notes without invalid progress', () => {
    const project = createCard({ ...input, type: 'project' }, [])
    const note = createCard({ ...input, type: 'note' }, [])
    if (project.type === 'project') expect(progress(project.subtasks).percent).toBe(0)
    if (note.type === 'note') expect(note.body).toBe('')
  })
})
