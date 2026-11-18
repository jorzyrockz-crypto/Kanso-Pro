import { CalendarDays, Check, Eye, Pencil, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Dispatch } from 'react'
import type { EventCard, JourneyAction, JourneyCard, SpaceMember } from '../types'
import { destinationPath } from '../lib/navigation'
import { acknowledgementCount, toggleAcknowledgement } from '../lib/collaboration'
import { CardDeleteAction } from './CardDeleteAction'

export function EventContextMenu({ card, dispatch, currentMember, canEdit, onPreview, onClose, onDeleteCard }: {
  card: EventCard
  dispatch: Dispatch<JourneyAction>
  currentMember: SpaceMember
  canEdit: boolean
  onPreview: () => void
  onClose: () => void
  onDeleteCard: (card: JourneyCard) => void
}) {
  const headingId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const eventHref = destinationPath({ page: 'calendar', cardId: card.id })
  const acknowledgement = card.acknowledgements?.find((entry) => entry.member === currentMember.name)?.response
  const choose = (response: 'going' | 'noted') => {
    dispatch({ type: 'update-card', card: { ...card, acknowledgements: toggleAcknowledgement(card.acknowledgements, currentMember.name, response) } })
    onClose()
  }

  useEffect(() => {
    const focusedBeforeOpen = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus({ preventScroll: true })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (focusedBeforeOpen?.isConnected) focusedBeforeOpen.focus({ preventScroll: true })
    }
  }, [onClose])

  return <div className="event-context-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="event-context-menu" role="dialog" aria-modal="true" aria-labelledby={headingId}>
      <header className="event-context-heading"><div><span>Event actions</span><h2 id={headingId}>{card.title || 'Untitled event'}</h2></div><button ref={closeRef} type="button" className="event-context-close" aria-label="Close event actions" onClick={onClose}><X size="1rem" aria-hidden="true" /></button></header>
      <div className="event-context-rsvp" role="group" aria-label={`Respond to ${card.title || 'this event'}`}>
        <button type="button" disabled={!canEdit} className={acknowledgement === 'going' ? 'is-active' : ''} aria-pressed={acknowledgement === 'going'} onClick={() => choose('going')}><Check size=".875rem" aria-hidden="true" />Going{acknowledgementCount(card.acknowledgements, 'going') ? ` · ${acknowledgementCount(card.acknowledgements, 'going')}` : ''}</button>
        <button type="button" disabled={!canEdit} className={acknowledgement === 'noted' ? 'is-active' : ''} aria-pressed={acknowledgement === 'noted'} onClick={() => choose('noted')}><Eye size=".875rem" aria-hidden="true" />Noted{acknowledgementCount(card.acknowledgements, 'noted') ? ` · ${acknowledgementCount(card.acknowledgements, 'noted')}` : ''}</button>
      </div>
      <div className="event-context-options">
        <button type="button" onClick={() => { onClose(); onPreview() }}><Eye size=".9375rem" aria-hidden="true" />Preview event</button>
        {canEdit && <Link to={`/new?edit=${encodeURIComponent(card.id)}`} state={{ from: eventHref }} onClick={onClose}><Pencil size=".9375rem" aria-hidden="true" />Edit event</Link>}
        <Link to={eventHref} onClick={onClose}><CalendarDays size=".9375rem" aria-hidden="true" />View Calendar details</Link>
      </div>
      {canEdit && <div className="event-context-delete"><CardDeleteAction card={card} onDelete={(deleted) => { onClose(); onDeleteCard(deleted) }} /></div>}
    </section>
  </div>
}
