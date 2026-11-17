import { describe, expect, it } from 'vitest'
import { activityModuleForHref, mentionedMembers, toggleAcknowledgement, toggleReaction } from './collaboration'
import type { SpaceMember } from '../types'

const members: SpaceMember[] = [
  { id: 'owner', name: 'You', role: 'owner', presence: 'online' },
  { id: 'santos', name: 'J. Santos', role: 'editor', presence: 'online' },
  { id: 'chair', name: 'Grade Level Chair', role: 'editor', presence: 'away' },
]

describe('collaboration helpers', () => {
  it('keeps reactions member-scoped and toggles the selected emoji', () => {
    const first = toggleReaction([], '👍', 'You')
    expect(first).toEqual([{ emoji: '👍', member: 'You' }])
    expect(toggleReaction(first, '👍', 'You')).toEqual([])
    expect(toggleReaction(first, '✅', 'You')).toEqual([{ emoji: '👍', member: 'You' }, { emoji: '✅', member: 'You' }])
  })

  it('resolves mentions only for current Space members', () => {
    expect(mentionedMembers('Please review this, @J. Santos. @Someone Else is not in this Space.', members).map((member) => member.name)).toEqual(['J. Santos'])
    expect(mentionedMembers('Thanks @grade level chair!', members).map((member) => member.name)).toEqual(['Grade Level Chair'])
  })

  it('replaces an event response instead of duplicating it', () => {
    expect(toggleAcknowledgement([{ member: 'You', response: 'going' }], 'You', 'noted')).toEqual([{ member: 'You', response: 'noted' }])
  })

  it('routes activity to the matching sidebar module', () => {
    expect(activityModuleForHref('/projects/proj-q1')).toBe('project')
    expect(activityModuleForHref('/journal/note-1')).toBe('journal')
    expect(activityModuleForHref('/')).toBe('timeline')
  })
})
