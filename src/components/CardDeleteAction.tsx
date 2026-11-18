import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { JourneyCard } from '../types'

function cardName(card: JourneyCard) {
  return card.type === 'event' ? 'event' : card.type === 'task' ? 'task list' : card.type === 'note' ? 'journal entry' : 'project'
}

/** A deliberate two-step control keeps destructive card removal out of accidental taps. */
export function CardDeleteAction({ card, onDelete, className = '', iconOnly = false }: {
  card: JourneyCard
  onDelete: (card: JourneyCard) => void
  className?: string
  /** Use the same deliberate confirmation flow where compact editor chrome only has room for an icon. */
  iconOnly?: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const label = cardName(card)

  if (confirming) return <span className={`card-delete-confirm ${className}`} role="group" aria-label={`Delete ${label}`}>
    <span>Delete this {label}?</span>
    <button type="button" className="text-button" onClick={() => setConfirming(false)}>Keep it</button>
    <button type="button" className="button button-danger" onClick={() => onDelete(card)}><Trash2 size=".75rem" />Yes, delete {label}</button>
  </span>

  const deleteLabel = `Delete ${label}`
  return <button type="button" className={`${iconOnly ? 'icon-button card-delete-icon' : 'button button-delete-card'} ${className}`} aria-label={iconOnly ? deleteLabel : undefined} title={iconOnly ? deleteLabel : undefined} onClick={() => setConfirming(true)}><Trash2 size=".75rem" />{!iconOnly && deleteLabel}</button>
}
