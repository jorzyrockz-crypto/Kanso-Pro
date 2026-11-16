import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { JourneyCard } from '../types'

function cardName(card: JourneyCard) {
  return card.type === 'event' ? 'event' : card.type === 'task' ? 'task list' : card.type === 'note' ? 'journal entry' : 'project card'
}

/** A deliberate two-step control keeps destructive card removal out of accidental taps. */
export function CardDeleteAction({ card, onDelete, className = '' }: {
  card: JourneyCard
  onDelete: (card: JourneyCard) => void
  className?: string
}) {
  const [confirming, setConfirming] = useState(false)
  const label = cardName(card)

  if (confirming) return <span className={`card-delete-confirm ${className}`} role="group" aria-label={`Delete ${label}`}>
    <span>Delete this {label}?</span>
    <button type="button" className="text-button" onClick={() => setConfirming(false)}>Keep it</button>
    <button type="button" className="button button-danger" onClick={() => onDelete(card)}><Trash2 size=".75rem" />Yes, delete {label}</button>
  </span>

  return <button type="button" className={`button button-delete-card ${className}`} onClick={() => setConfirming(true)}><Trash2 size=".75rem" />Delete {label}</button>
}
