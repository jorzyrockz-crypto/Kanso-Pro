import type { QuickReaction, ReactionEmoji } from '../types'
import { REACTION_EMOJIS, reactionCount } from '../lib/collaboration'

export function QuickReactions({ reactions, memberName, onReact, disabled = false, label = 'Quick reactions', compact = false }: {
  reactions?: QuickReaction[]
  memberName: string
  onReact: (emoji: ReactionEmoji) => void
  disabled?: boolean
  label?: string
  compact?: boolean
}) {
  return <div className={`quick-reactions interactive ${compact ? 'is-compact' : ''}`} role="group" aria-label={label}>
    {REACTION_EMOJIS.map((emoji) => {
      const count = reactionCount(reactions, emoji)
      const reacted = reactions?.some((reaction) => reaction.member === memberName && reaction.emoji === emoji) ?? false
      return <button key={emoji} type="button" disabled={disabled} className={reacted ? 'is-reacted' : ''} aria-pressed={reacted} aria-label={`${reacted ? 'Remove' : 'Add'} ${emoji} reaction${count ? `, ${count} total` : ''}`} onClick={() => onReact(emoji)}><span aria-hidden="true">{emoji}</span>{count > 0 && <small>{count}</small>}</button>
    })}
  </div>
}
