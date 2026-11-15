import { describe, expect, it } from 'vitest'
import { composerOptions, composerPath, destinationPath, pageForPath, PAGE_LINKS, SETTINGS_SECTIONS } from './navigation'

describe('page navigation', () => {
  it('gives all four workspaces their own readable URLs', () => {
    expect(destinationPath({ page: 'calendar' })).toBe('/calendar')
    expect(destinationPath({ page: 'tasks' })).toBe('/tasks')
    expect(destinationPath({ page: 'project' })).toBe('/projects')
    expect(destinationPath({ page: 'journal' })).toBe('/journal')
  })
  it('preserves card-specific destinations and safely encodes identifiers', () => {
    expect(destinationPath({ page: 'project', cardId: 'proj-reading' })).toBe('/projects/proj-reading')
    expect(destinationPath({ page: 'journal', cardId: 'a note/?#' })).toBe('/journal/a%20note%2F%3F%23')
  })
  it('builds new-card URLs with optional validated context', () => {
    expect(composerPath()).toBe('/new')
    expect(composerPath({ type: 'note', date: '2026-11-05' })).toBe('/new?type=note&date=2026-11-05')
    expect(composerPath({ type: 'event', date: '2026-11-31' })).toBe('/new?type=event')
  })
  it('restores new-card defaults from a shared URL', () => {
    expect(composerOptions('?type=project&date=2026-11-05')).toEqual({ type: 'project', date: '2026-11-05' })
    for (const type of ['event', 'task', 'project', 'note']) expect(composerOptions(`?type=${type}`).type).toBe(type)
  })
  it('ignores malformed and unsupported new-card options', () => {
    expect(composerOptions('?type=unknown&date=2026-02-30')).toEqual({})
    expect(composerOptions('?type=note&date=oops')).toEqual({ type: 'note' })
    expect(composerOptions('')).toEqual({})
  })
  it('identifies page titles on index and card-specific routes', () => {
    expect(pageForPath('/').label).toBe('Timeline')
    expect(pageForPath('/calendar/evt-oquendo').page).toBe('calendar')
    expect(pageForPath('/tasks/').label).toBe('Tasks')
    expect(pageForPath('/projects/proj-reading').label).toBe('Projects')
    expect(pageForPath('/journal/note-lesson').label).toBe('Journal')
    expect(pageForPath('/new').label).toBe('New card')
    expect(pageForPath('/account').label).toBe('My workspace')
    expect(pageForPath('/account/').page).toBe('account')
  })
  it('names the dedicated sign-in, creation, and recovery pages without accepting arbitrary modes', () => {
    expect(pageForPath('/sign-in').page).toBe('sign-in')
    expect(pageForPath('/SIGN-IN/').label).toBe('Sign in')
    expect(pageForPath('/sign-in', '?mode=create').label).toBe('Create account')
    expect(pageForPath('/sign-in', '?mode=reset').label).toBe('Reset password')
    expect(pageForPath('/sign-in', '?mode=unknown&month=2029-03').label).toBe('Sign in')
  })
  it('names Settings without adding another bottom destination', () => {
    expect(pageForPath('/settings')).toEqual({ label: 'Settings', page: 'settings' })
    expect(pageForPath('/SETTINGS/').label).toBe('Settings')
    expect(PAGE_LINKS).toHaveLength(5)
    expect(PAGE_LINKS.map(({ path }) => path)).not.toContain('/settings')
    expect(SETTINGS_SECTIONS.map(({ id }) => id)).toEqual(['account', 'appearance', 'workspace', 'privacy', 'about'])
  })
  it('identifies unknown paths instead of claiming they are workspaces', () => {
    for (const path of ['/missing', '/new/card', '/projects/a/b', '/calendarish', '/account/unknown', '/sign-in/unknown', '/settings/unknown', '/settings/appearance']) {
      expect(pageForPath(path).page).toBe('not-found')
    }
  })
})
