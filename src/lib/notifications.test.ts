import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data'
import type { EventCard, TaskCard, ProjectCard } from '../types'
import { addNotifications, defaultPreferences, emptyNotifications, MAX_NOTIFICATIONS, parseNotifications, quietNow, reconcileReminders, reminderFor, safeNotificationPath } from './notifications'

const seed = createInitialState()
const event = { ...seed.cards.find((card): card is EventCard => card.type === 'event')!, id: 'event-test', date: '2026-11-14', allDay: false, time: '10:00' }
const task = { ...seed.cards.find((card): card is TaskCard => card.type === 'task')!, id: 'task-test', date: '2026-11-14', reminder: '09:00', subtasks: [{ id: 'step', title: 'One action', done: false }] }
const project = { ...seed.cards.find((card): card is ProjectCard => card.type === 'project')!, id: 'project-test', dueDate: '2026-11-14', subtasks: [{ id: 'step', title: 'One milestone', done: false }] }
const before = new Date(2026, 10, 14, 7)
const after = new Date(2026, 10, 14, 12)

describe('local planner reminder boundaries', () => {
  it('silently baselines existing overdue plans, including on repeated evaluations', () => {
    const first = reconcileReminders(emptyNotifications(), [event, task, project], after)
    expect(first.incoming).toEqual([])
    expect(first.state.initialized).toBe(true)
    expect(reconcileReminders(first.state, [event, task, project], new Date(2026, 10, 20)).incoming).toEqual([])
  })
  it('catches due reminders after an app closure, without repeating them', () => {
    const first = reconcileReminders(emptyNotifications(), [event, task, project], before)
    const next = reconcileReminders(first.state, [event, task, project], after)
    expect(next.incoming.map(item => item.kind)).toEqual(['event', 'task', 'project'])
    expect(next.incoming.map(item => item.href)).toEqual(['/calendar/event-test', '/tasks/task-test', '/projects/project-test'])
    expect(reconcileReminders(next.state, [event, task, project], after).incoming).toEqual([])
  })
  it('uses device-local times and the documented all-day/project defaults', () => {
    expect(new Date(reminderFor(event)!.at).getHours()).toBe(10)
    expect(new Date(reminderFor({ ...event, allDay: true })!.at).getHours()).toBe(8)
    expect(new Date(reminderFor(project)!.at).getHours()).toBe(9)
    expect(new Date(reminderFor({ ...task, reminder: undefined })!.at).getHours()).toBe(9)
  })
  it('skips completed work, journal notes, invalid dates, and invalid time labels', () => {
    expect(reminderFor({ ...task, subtasks: [{ ...task.subtasks[0], done: true }] })).toBeNull()
    expect(reminderFor({ ...project, subtasks: [{ ...project.subtasks[0], done: true }] })).toBeNull()
    expect(reminderFor(seed.cards.find(card => card.type === 'note')!)).toBeNull()
    expect(reminderFor({ ...event, date: '2026-02-31' })).toBeNull()
    expect(reminderFor({ ...task, reminder: 'whenever' })).toBeNull()
  })
  it('respects category settings without flooding old reminders when re-enabled', () => {
    const base = reconcileReminders(emptyNotifications(), [task], before).state
    base.preferences.tasks = false
    const muted = reconcileReminders(base, [task], after)
    expect(muted.incoming).toEqual([])
    muted.state.preferences.tasks = true
    expect(reconcileReminders(muted.state, [task], after).incoming).toEqual([])
  })
  it('new due plans or changed deadlines notify once; edits to titles do not repeat a deadline', () => {
    const base = reconcileReminders(emptyNotifications(), [task], after).state
    expect(reconcileReminders(base, [{ ...task, title: 'A changed title' }], after).incoming).toEqual([])
    expect(reconcileReminders(base, [{ ...task, reminder: '11:00' }], after).incoming).toHaveLength(1)
    expect(reconcileReminders(base, [task, { ...task, id: 'new-task' }], after).incoming).toHaveLength(1)
  })
  it('does not repeat an already-received deadline when a date is changed back', () => {
    const base = reconcileReminders(emptyNotifications(), [task], before).state
    const first = reconcileReminders(base, [task], after).state
    first.items[0].read = true
    const moved = reconcileReminders(first, [{ ...task, reminder: '11:00' }], after).state
    const returned = reconcileReminders(moved, [task], after)
    expect(returned.incoming).toEqual([])
    expect(returned.state.items).toHaveLength(2)
  })
  it('does not mutate cards or partition the local workspace by account', () => {
    const cards = [event, task, project], raw = JSON.stringify(cards)
    reconcileReminders(emptyNotifications(), cards, after)
    expect(JSON.stringify(cards)).toBe(raw)
    expect(JSON.stringify(emptyNotifications())).not.toMatch(/account|school|token|password|uid/)
  })
})

describe('quiet hours and private persisted inbox', () => {
  it.each([[18, 59, false], [19, 0, true], [23, 0, true], [0, 0, true], [5, 59, true], [6, 0, false]])('19:00–06:00 at %s:%s', (hour, minute, quiet) => {
    expect(quietNow(defaultPreferences(), new Date(2026, 10, 14, hour, minute))).toBe(quiet)
  })
  it('supports same-day ranges, disabled quiet hours and invalid equal endpoints', () => {
    const p = { ...defaultPreferences(), quietStart: '12:00', quietEnd: '14:00' }
    expect(quietNow(p, new Date(2026, 10, 14, 13))).toBe(true)
    expect(quietNow({ ...p, quiet: false }, new Date(2026, 10, 14, 13))).toBe(false)
    expect(quietNow({ ...p, quietEnd: '12:00' }, new Date(2026, 10, 14, 13))).toBe(false)
  })
  it('keeps the newest 60 and does not mark a previously read update unread again', () => {
    const items = Array.from({ length: 75 }, (_, i) => ({ id: `update:${i}`, kind: 'update' as const, title: 'Update', detail: 'Release', href: '/settings#about', createdAt: i, read: false }))
    const state = addNotifications(emptyNotifications(), items)
    expect(state.items).toHaveLength(MAX_NOTIFICATIONS)
    expect(state.items[0].id).toBe('update:74')
    state.items[0].read = true
    expect(addNotifications(state, [items[74]]).items[0].read).toBe(true)
  })
  it('round trips only notification fields, rejects corrupt preferences, and drops unsafe links', () => {
    const state = reconcileReminders(reconcileReminders(emptyNotifications(), [task], before).state, [task], after).state
    expect(parseNotifications(JSON.stringify(state))).toEqual(state)
    expect(parseNotifications('{bad')).toBeNull()
    expect(parseNotifications(JSON.stringify({ ...state, preferences: { ...state.preferences, quietEnd: '19:00' } }))).toBeNull()
    state.items.push({ ...state.items[0], id: 'bad', href: 'https://evil.test/' })
    expect(parseNotifications(JSON.stringify(state))!.items).toHaveLength(1)
  })
  it.each(['//evil.test/', 'https://evil.test/', '/sign-in?token=private', '/api/tokens', '/tasks/a?redirect=evil'])('rejects unrelated/external notification path %s', path => {
    expect(safeNotificationPath(path)).toBe(false)
  })
})
