import { CircleCheck, Eye, ThumbsUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { QuickReaction, ReactionEmoji } from '../types'
import { REACTION_EMOJIS, reactionCount } from '../lib/collaboration'

const reactionVisuals: Record<ReactionEmoji, { label: string; tone: 'like' | 'complete' | 'seen'; Icon: LucideIcon }> = {
  '👍': { label: 'Like', tone: 'like', Icon: ThumbsUp },
  '✅': { label: 'Complete', tone: 'complete', Icon: CircleCheck },
  '👀': { label: 'Seen', tone: 'seen', Icon: Eye },
}

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
      const { Icon, label: reactionLabel, tone } = reactionVisuals[emoji]
      const actionLabel = `${reacted ? 'Remove' : 'Add'} ${reactionLabel} reaction${count ? `, ${count} total` : ''}`
      return <button key={emoji} type="button" disabled={disabled} className={reacted ? 'is-reacted' : ''} data-reaction={tone} aria-pressed={reacted} aria-label={actionLabel} title={actionLabel} onClick={() => onReact(emoji)}><Icon size=".875rem" aria-hidden="true" />{count > 0 && <small>{count}</small>}</button>
    })}
  </div>
}
