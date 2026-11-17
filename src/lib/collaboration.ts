import type { EventAcknowledgement, QuickReaction, ReactionEmoji, SpaceMember } from '../types'

export const REACTION_EMOJIS: ReactionEmoji[] = ['👍', '✅', '👀']

/** Toggle just this member's acknowledgement, retaining other collaborators' reactions. */
export function toggleReaction(reactions: QuickReaction[] | undefined, emoji: ReactionEmoji, member: string): QuickReaction[] {
  const current = reactions ?? []
  const hasReaction = current.some((reaction) => reaction.member === member && reaction.emoji === emoji)
  if (hasReaction) return current.filter((reaction) => !(reaction.member === member && reaction.emoji === emoji))
  return [...current.filter((reaction) => reaction.member !== member || reaction.emoji !== emoji), { emoji, member }]
}

export function reactionCount(reactions: QuickReaction[] | undefined, emoji: ReactionEmoji) {
  return reactions?.filter((reaction) => reaction.emoji === emoji).length ?? 0
}

/** A small @mention parser that only resolves the actual members of this Space. */
export function mentionedMembers(value: string, members: SpaceMember[]): SpaceMember[] {
  const text = value.toLocaleLowerCase()
  return members.filter((member) => {
    const escaped = member.name.trim().toLocaleLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    return !!escaped && new RegExp(`(^|\\s)@${escaped}(?=\\s|$|[.,!?;:])`, 'i').test(text)
  })
}

export function toggleAcknowledgement(acknowledgements: EventAcknowledgement[] | undefined, member: string, response: EventAcknowledgement['response']): EventAcknowledgement[] {
  const existing = acknowledgements ?? []
  const prior = existing.find((entry) => entry.member === member)
  if (prior?.response === response) return existing.filter((entry) => entry.member !== member)
  return [...existing.filter((entry) => entry.member !== member), { member, response }]
}

export function acknowledgementCount(acknowledgements: EventAcknowledgement[] | undefined, response: EventAcknowledgement['response']) {
  return acknowledgements?.filter((entry) => entry.response === response).length ?? 0
}

export type ActivityModule = 'timeline' | 'calendar' | 'tasks' | 'project' | 'journal'

export function activityModuleForHref(href: string): ActivityModule {
  if (href.startsWith('/calendar')) return 'calendar'
  if (href.startsWith('/tasks')) return 'tasks'
  if (href.startsWith('/projects') || href.startsWith('/project')) return 'project'
  if (href.startsWith('/journal')) return 'journal'
  return 'timeline'
}
