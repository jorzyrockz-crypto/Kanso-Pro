import { ArrowDown, ArrowRight, ArrowUp, Bell, CalendarDays, Check, ChevronDown, ChevronRight, Eye, FileText, Flag, Folder, Landmark, Mail, MoreHorizontal, Pin, Plus, School, Users, X, Zap } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Dispatch, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react'
import type { ComposerOptions, DayEntry, EventCard, Filter, GapEntry, JourneyAction, JourneyCard, NoteCard, ProjectCard, RolloverCandidate, SpaceActivity, SpaceMember, TaskCard, TimelineEntry, TimelineItem, TimelineSourceEntry } from '../types'
import { addDays, daysBetween, formatDate, formatTime, gapLabel, progress, shortDate, TYPE_CONFIG } from '../lib/journey'
import { Avatar, ProgressBar, TypeIcon } from './Common'
import { destinationPath } from '../lib/navigation'
import { occasionLabel, resolveOccasion } from '../lib/occasions'
import { OccasionArtwork } from './OccasionArtwork'
import { legislatedActivityIllustration } from '../lib/legislatedActivityVisuals'
import { TimelineCardPreview } from './TimelineCardPreview'
import { EventContextMenu } from './EventContextMenu'
import { QuickReactions } from './QuickReactions'
import { acknowledgementCount, toggleReaction } from '../lib/collaboration'

function useReveal() {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.classList.add('is-visible')
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        element.classList.add('is-visible')
        observer.unobserve(element)
      }
    }, { threshold: 0.06, rootMargin: '30px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return ref
}

function EventCardSurface({ card, onPreview, onContextMenu }: { card: EventCard; onPreview: () => void; onContextMenu: () => void }) {
  const pressTimer = useRef<number | null>(null)
  const pressStart = useRef<{ x: number; y: number } | null>(null)
  const longPressTriggered = useRef(false)
  const clearPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current)
    pressTimer.current = null
    pressStart.current = null
  }
  useEffect(() => () => clearPress(), [])
  const startPress = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    longPressTriggered.current = false
    pressStart.current = { x: event.clientX, y: event.clientY }
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null
      pressStart.current = null
      longPressTriggered.current = true
      onContextMenu()
    }, 550)
  }
  const cancelForMovement = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = pressStart.current
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) clearPress()
  }
  return <button type="button" className="card-open" aria-label={`Preview ${card.title || 'Untitled event'} details. Long press for event actions.`} title="Long press or right-click for event actions"
    onPointerDown={startPress} onPointerMove={cancelForMovement} onPointerUp={clearPress} onPointerCancel={clearPress}
    onContextMenu={(event) => { event.preventDefault(); clearPress(); onContextMenu() }}
    onKeyDown={(event) => { if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); onContextMenu() } }}
    onClick={(event) => { if (longPressTriggered.current) { event.preventDefault(); longPressTriggered.current = false; return } onPreview() }} />
}

function CardFrame({ card, className = '', highlight, reminderAttention, children, artwork, dispatch, currentMember, canEdit, onPreview, onContextMenu }: {
  card: JourneyCard
  className?: string
  highlight?: boolean
  reminderAttention?: boolean
  children: ReactNode
  artwork?: ReactNode
  dispatch?: Dispatch<JourneyAction>
  currentMember?: SpaceMember
  canEdit?: boolean
  onPreview?: () => void
  onContextMenu?: () => void
}) {
  const destination = destinationPath({ page: TYPE_CONFIG[card.type].workspace, cardId: card.id })
  const previewableEvent = card.type === 'event' && onPreview && onContextMenu
  return (
    <article id={`card-${card.id}`} data-card-id={card.id} data-card-type={card.type} data-occasion={card.type === 'event' ? resolveOccasion(card) : undefined}
      className={`journey-card card-${card.type} ${className} ${highlight ? 'is-highlighted' : ''} ${reminderAttention ? 'is-reminder-alert' : ''}`}>
      {artwork}
      {previewableEvent ? <EventCardSurface card={card} onPreview={onPreview} onContextMenu={onContextMenu} /> : <Link className="card-open" to={destination} aria-label={`Open ${card.title || 'Untitled reflection'} details`} />}
      <div className="card-content">{children}{dispatch && currentMember && <QuickReactions reactions={card.reactions} memberName={currentMember.name} disabled={!canEdit} label={`Reactions to ${card.title || 'this update'}`} onReact={(emoji) => dispatch({ type: 'update-card', card: { ...card, reactions: toggleReaction(card.reactions, emoji, currentMember.name) } })} />}</div>
    </article>
  )
}

function EventAcknowledgementIndicator({ card, memberName }: { card: EventCard; memberName: string }) {
  const response = card.acknowledgements?.find((entry) => entry.member === memberName)?.response
  if (!response) return null
  const going = response === 'going'
  const count = acknowledgementCount(card.acknowledgements, response)
  const label = `You marked this event as ${going ? 'going' : 'noted'}${count > 1 ? `. ${count} people responded ${going ? 'going' : 'noted'}.` : '.'}`
  const Icon = going ? Check : Eye
  return <span className={`badge event-acknowledgement-indicator is-${response}`} role="status" aria-label={label} title={label}><Icon size=".6875rem" aria-hidden="true" />{going ? 'Going' : 'Noted'}</span>
}

function EventJourneyCard({ card, highlight, reminderAttention, onPreview, onContextMenu, dispatch, currentMember, canEdit }: { card: EventCard; highlight: boolean; reminderAttention: boolean; onPreview: () => void; onContextMenu: () => void; dispatch: Dispatch<JourneyAction>; currentMember: SpaceMember; canEdit: boolean }) {
  const theme = resolveOccasion(card)
  if (theme !== 'none') return (
    <CardFrame card={card} highlight={highlight} reminderAttention={reminderAttention} className={`illustrated-event-card occasion-surface occasion-${theme}`} artwork={<OccasionArtwork theme={theme} />} dispatch={dispatch} currentMember={currentMember} canEdit={canEdit} onPreview={onPreview} onContextMenu={onContextMenu}>
      <div className="card-topline">
        <span className="badge occasion-event-badge">{card.holiday ? <Flag size="0.6875rem" /> : <CalendarDays size="0.6875rem" />}{card.holiday ? 'PH HOLIDAY' : occasionLabel(theme)}</span>
        <button type="button" className="icon-button card-menu interactive" onClick={onContextMenu} aria-label={`Event actions for ${card.title}`}><MoreHorizontal size="1.0625rem" /></button>
      </div>
      <div className="event-status-line"><span className="occasion-event-time">{card.allDay ? 'All day' : formatTime(card.time)}</span><EventAcknowledgementIndicator card={card} memberName={currentMember.name} /></div>
      <div className="occasion-event-copy"><h3>{card.title}</h3>{card.context && <p className="card-caption">{card.context}</p>}</div>
      <div className="card-footer occasion-event-footer"><span><CalendarDays size="0.6875rem" />Connected to Calendar</span><span className="footer-link">Open Schedule<ArrowRight size="0.75rem" /></span></div>
    </CardFrame>
  )
  if (card.holiday) return (
    <CardFrame card={card} highlight={highlight} reminderAttention={reminderAttention} className="holiday-card" dispatch={dispatch} currentMember={currentMember} canEdit={canEdit} onPreview={onPreview} onContextMenu={onContextMenu}>
      <div className="card-topline">
        <span className="badge holiday-badge"><Flag size="0.75rem" />PH HOLIDAY</span>
        <div className="person-actions">
          <span className="person-pill holiday-person"><Avatar name="You" />You</span>
          <button type="button" className="icon-button card-menu interactive" onClick={onContextMenu} aria-label={`Event actions for ${card.title}`}><MoreHorizontal size="1rem" /></button>
        </div>
      </div>
      <div className="event-status-line"><span className="badge all-day-badge"><CalendarDays size="0.6875rem" />ALL DAY</span><EventAcknowledgementIndicator card={card} memberName={currentMember.name} /></div>
      <h3>{card.title}</h3>
      <p className="card-caption truncate">{card.context}</p>
      <div className="card-footer holiday-footer">
        <span><CalendarDays size="0.6875rem" />Connected to Calendar</span>
        <span className="footer-link">Open Schedule <ArrowRight size="0.75rem" /></span>
      </div>
    </CardFrame>
  )
  return (
    <CardFrame card={card} highlight={highlight} reminderAttention={reminderAttention} className="standard-event-card" dispatch={dispatch} currentMember={currentMember} canEdit={canEdit} onPreview={onPreview} onContextMenu={onContextMenu}>
      <div className="card-topline event-topline">
        <div className="event-topline-status"><span className="event-time">{card.allDay ? 'ALL DAY' : formatTime(card.time, true)}</span><EventAcknowledgementIndicator card={card} memberName={currentMember.name} /></div>
        <div className="person-actions">
          <span className="person-pill"><Avatar name={card.owner} /><span>{card.owner}</span></span>
          <button type="button" className="icon-button card-menu interactive" onClick={onContextMenu} aria-label={`Event actions for ${card.title}`}><MoreHorizontal size="1.0625rem" /></button>
        </div>
      </div>
      <h3>{card.title}</h3>
      <div className="event-footer">
        <span className="organization-pill"><Users size="0.8125rem" /><span>{card.organization}</span></span>
        <span className="footer-link">Calendar <ChevronRight size="0.8125rem" /></span>
      </div>
    </CardFrame>
  )
}

function TaskJourneyCard({ card, dispatch, highlight, reminderAttention, currentMember, canEdit }: { card: TaskCard; dispatch: Dispatch<JourneyAction>; highlight: boolean; reminderAttention: boolean; currentMember: SpaceMember; canEdit: boolean }) {
  const { done, total } = progress(card.subtasks)
  return (
    <CardFrame card={card} highlight={highlight} reminderAttention={reminderAttention} dispatch={dispatch} currentMember={currentMember} canEdit={canEdit}>
      <div className="card-topline task-topline">
        <span className="badge type-badge"><TypeIcon type="task" size={12} />Task list</span>
        {card.reminder && <span className="reminder-pill"><Bell size="0.6875rem" />{formatTime(card.reminder)}</span>}
      </div>
      <h3>{card.title}</h3>
      <div className="timeline-checklist">
        {card.subtasks.slice(0, 3).map((item) => (
          <label key={item.id} className={`timeline-check interactive ${item.done ? 'is-done' : ''}`}>
            <input type="checkbox" checked={item.done} disabled={!canEdit} onChange={() => dispatch({ type: 'toggle-item', cardId: card.id, itemId: item.id })} />
            <span>{item.title}</span>
          </label>
        ))}
        {total > 3 && <span className="more-items">+{total - 3} more actions in this list</span>}
      </div>
      <div className="card-footer task-footer"><span>{done} of {total} completed</span><span className="footer-link">Open task list <ArrowRight size="0.75rem" /></span></div>
    </CardFrame>
  )
}

function NoteJourneyCard({ card, highlight, reminderAttention, dispatch, currentMember, canEdit }: { card: NoteCard; highlight: boolean; reminderAttention: boolean; dispatch: Dispatch<JourneyAction>; currentMember: SpaceMember; canEdit: boolean }) {
  return (
    <CardFrame card={card} highlight={highlight} reminderAttention={reminderAttention} className="journal-paper" dispatch={dispatch} currentMember={currentMember} canEdit={canEdit}>
      <div className="card-topline note-topline">
        <span className="badge type-badge"><TypeIcon type="note" size={11} />{card.category === 'Space Update' ? 'Space Update' : 'Journal Note'}</span>
        <span className="note-time">{formatTime(card.time)}{card.time && card.pinned && ' · '}{card.pinned && <><Pin size="0.625rem" />Pinned</>}</span>
      </div>
      <h3>{card.title || 'Untitled reflection'}</h3>
      <p className={`note-excerpt ${card.body ? '' : 'muted'}`}>{card.body || 'A fresh page, ready for a thought.'}</p>
      <div className="card-footer note-footer">
        <div className="note-tags">{card.tags.slice(0, 2).map((tag) => <span key={tag}>#{tag}</span>)}</div>
        <span className="footer-link">Open Journal <ArrowRight size="0.75rem" /></span>
      </div>
    </CardFrame>
  )
}

function timelineDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function projectDueState(card: ProjectCard, percent: number) {
  if (percent === 100) return { text: 'Complete', tone: 'is-complete' }
  const days = daysBetween(timelineDate(), card.dueDate)
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, tone: 'is-overdue' }
  if (days === 0) return { text: 'Due today', tone: 'is-today' }
  if (days === 1) return { text: 'Due tomorrow', tone: 'is-upcoming' }
  return { text: `${days}d left`, tone: 'is-upcoming' }
}

function ProjectJourneyCard({ card, highlight, reminderAttention, dispatch, currentMember, canEdit }: { card: ProjectCard; highlight: boolean; reminderAttention: boolean; dispatch: Dispatch<JourneyAction>; currentMember: SpaceMember; canEdit: boolean }) {
  const { done, total, percent } = progress(card.subtasks)
  const nextMilestone = card.subtasks.find((item) => !item.done)
  const due = projectDueState(card, percent)
  return (
    <CardFrame card={card} highlight={highlight} reminderAttention={reminderAttention} className={`project-stream-card ${card.featured ? 'featured-project-card' : 'sprint-card'}`} dispatch={dispatch} currentMember={currentMember} canEdit={canEdit}>
      <div className="card-topline project-stream-topline">
        <span className="badge type-badge"><Zap size="0.6875rem" />Project</span>
        <span className={`timeline-project-due ${due.tone}`}>{due.text}</span>
      </div>
      <h3>{card.title}</h3>
      <p className="project-next-milestone"><Flag size="0.6875rem" aria-hidden="true" />{nextMilestone ? `Next: ${nextMilestone.title}` : 'All milestones completed'}</p>
      <ProgressBar value={percent} label={`${card.title} progress`} />
      <div className="card-footer project-stream-footer"><span className={`project-status ${percent === 100 ? 'is-complete' : ''}`}>{percent === 100 ? 'Completed' : 'Pending'}</span><span>{percent}% · {done} of {total} milestones</span><Link className="footer-link interactive" to={destinationPath({ page: 'project', cardId: card.id })}>Open project <ArrowRight size="0.75rem" /></Link></div>
    </CardFrame>
  )
}

function JourneyCardView({ card, dispatch, highlight, reminderAttention, onPreview, onEventActions, currentMember, canEdit }: { card: JourneyCard; dispatch: Dispatch<JourneyAction>; highlight: boolean; reminderAttention: boolean; onPreview: () => void; onEventActions: (card: EventCard) => void; currentMember: SpaceMember; canEdit: boolean }) {
  switch (card.type) {
    case 'event': return <EventJourneyCard card={card} highlight={highlight} reminderAttention={reminderAttention} onPreview={onPreview} onContextMenu={() => onEventActions(card)} dispatch={dispatch} currentMember={currentMember} canEdit={canEdit} />
    case 'task': return <TaskJourneyCard card={card} dispatch={dispatch} highlight={highlight} reminderAttention={reminderAttention} currentMember={currentMember} canEdit={canEdit} />
    case 'note': return <NoteJourneyCard card={card} highlight={highlight} reminderAttention={reminderAttention} dispatch={dispatch} currentMember={currentMember} canEdit={canEdit} />
    case 'project': return <ProjectJourneyCard card={card} highlight={highlight} reminderAttention={reminderAttention} dispatch={dispatch} currentMember={currentMember} canEdit={canEdit} />
  }
}

function isTimelineSourceEntry(item: TimelineItem): item is TimelineSourceEntry {
  return 'calendarSource' in item && item.calendarSource
}

function sourceEntryDate(entry: TimelineSourceEntry) {
  const start = formatDate(entry.date, { weekday: 'short', month: 'short', day: '2-digit' })
  if (!entry.endDate || entry.endDate === entry.date) return start
  return `${start} – ${formatDate(entry.endDate, { month: 'short', day: '2-digit' })}`
}

function TimelineSourceCard({ entry, onPreview }: { entry: TimelineSourceEntry; onPreview: () => void }) {
  const isSchoolCalendar = entry.sourceId === 'deped-sy-2026-2027'
  const isLegislated = entry.sourceId === 'deped-legislated-activities'
  const isDepEdReference = isSchoolCalendar || isLegislated
  const SourceIcon = isSchoolCalendar ? School : isLegislated ? Landmark : FileText
  const visualClass = isSchoolCalendar ? 'source-school-calendar' : isLegislated ? 'source-legislated-activity' : 'source-local-memo'
  const illustration = isLegislated ? legislatedActivityIllustration(entry.title) : undefined
  const footer = isDepEdReference ? 'DO 009, s. 2026 · Reference only' : 'Calendar source · Reference only'
  return <article id={`source-${entry.id}`} className={`journey-card calendar-source-event timeline-source-card ${visualClass}${illustration ? ` legislated-illustration-${illustration}` : ''}`} data-source-id={entry.sourceId} data-card-type="calendar-source" data-illustration={illustration}>
    <button type="button" className="timeline-source-open" onClick={onPreview} aria-label={`Preview ${entry.title} details`} />
    <div className="calendar-source-event-meta"><span><CalendarDays size="0.75rem" />{sourceEntryDate(entry)}</span><span className="badge source-reference-badge" title={entry.sourceProvenance} aria-label={`${entry.sourceLabel}. ${entry.sourceProvenance}`}>{entry.sourceLabel}</span></div>
    <h3>{entry.title}</h3>
    {entry.detail && <p>{entry.detail}</p>}
    {!isDepEdReference && !entry.detail && <p>{entry.sourceProvenance}</p>}
    <div className="calendar-source-event-note"><SourceIcon size="0.75rem" aria-hidden="true" />{footer}</div>
  </article>
}

function DayRow({ entry, today, dispatch, highlightId, reminderAttentionIds, onPreview, onEventActions, currentMember, canEdit }: { entry: DayEntry; today: string; dispatch: Dispatch<JourneyAction>; highlightId: string | null; reminderAttentionIds: ReadonlySet<string>; onPreview: (item: TimelineItem) => void; onEventActions: (card: EventCard) => void; currentMember: SpaceMember; canEdit: boolean }) {
  const ref = useReveal()
  const first = entry.cards[0]
  const firstIsSource = isTimelineSourceEntry(first)
  const isMonday = formatDate(entry.date, { weekday: 'short' }) === 'Mon'
  const isToday = entry.date === today
  const itemsForSide = (side: 'left' | 'right') => entry.cards.filter((card) => card.side === side)
  return (
    <section ref={ref} className="journey-row day-row" data-timeline-month={entry.date.slice(0, 7)} aria-label={formatDate(entry.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}>
      {(['left', 'right'] as const).map((side) => {
        const sideCards = itemsForSide(side)
        const tetherType = sideCards[0] && isTimelineSourceEntry(sideCards[0]) ? 'source' : sideCards[0]?.type
        return sideCards.length > 0 && <div key={`tether-${side}`} className={`tether tether-${side} tether-${tetherType}`} aria-hidden="true" />
      })}
      <div className="card-column card-col-left">{itemsForSide('left').map((card) => isTimelineSourceEntry(card)
        ? <TimelineSourceCard key={card.id} entry={card} onPreview={() => onPreview(card)} />
        : <JourneyCardView key={card.id} card={card} dispatch={dispatch} highlight={highlightId === card.id} reminderAttention={reminderAttentionIds.has(card.id)} onPreview={() => onPreview(card)} onEventActions={onEventActions} currentMember={currentMember} canEdit={canEdit} />
      )}</div>
      <div className={`date-node-wrapper ${isToday ? 'is-today' : ''}`}>
        <Link className={`date-node ${isToday ? 'date-today' : ''} ${!firstIsSource && first.type === 'project' ? 'date-project' : isMonday ? 'date-monday' : ''}`} data-date={entry.date}
          to={firstIsSource ? `/calendar?date=${entry.date}` : destinationPath({ page: TYPE_CONFIG[first.type].workspace, cardId: first.id })}
          aria-current={isToday ? 'date' : undefined}
          aria-label={isToday ? `Today, ${formatDate(entry.date, { weekday: 'long', month: 'long', day: 'numeric' })}` : firstIsSource ? `View ${formatDate(entry.date, { month: 'long', day: 'numeric' })} in Calendar` : `Open ${formatDate(entry.date, { month: 'long', day: 'numeric' })} details`}>
          {isToday && <em className="date-node-today" aria-hidden="true">Today</em>}<span>{formatDate(entry.date, { weekday: 'short' })}</span><strong>{entry.date.slice(8)}</strong>
        </Link>
      </div>
      <div className="card-column card-col-right">{itemsForSide('right').map((card) => isTimelineSourceEntry(card)
        ? <TimelineSourceCard key={card.id} entry={card} onPreview={() => onPreview(card)} />
        : <JourneyCardView key={card.id} card={card} dispatch={dispatch} highlight={highlightId === card.id} reminderAttention={reminderAttentionIds.has(card.id)} onPreview={() => onPreview(card)} onEventActions={onEventActions} currentMember={currentMember} canEdit={canEdit} />
      )}</div>
    </section>
  )
}

function QuietDays({ entry, onCompose, expanded, onToggle, highlightId }: { entry: GapEntry; onCompose: (options?: ComposerOptions) => void; expanded: boolean; onToggle: () => void; highlightId: string | null }) {
  const ref = useReveal()
  const drawerId = `quiet-${entry.start}-${entry.end}`
  return (
    <section ref={ref} className="journey-row quiet-row">
      <div className="quiet-pill-wrapper">
        <button className={`quiet-pill ${expanded ? 'is-expanded' : ''}`} onClick={onToggle} aria-expanded={expanded} aria-controls={drawerId}>
          <CalendarDays size="1rem" />
          <span className="quiet-label">{gapLabel(entry.start, entry.end)} <span className="quiet-label-dot">·</span> No scheduled events</span>
          <span className="quiet-badge">{expanded ? 'Hide buffer' : entry.cards.length ? `Peek ${entry.cards.length} ${entry.cards.length === 1 ? 'card' : 'cards'}` : 'Make room'}</span>
          <ChevronDown size="0.8125rem" className="quiet-chevron" />
        </button>
        {expanded && <div id={drawerId} className="quiet-drawer">
          <div className="quiet-drawer-header"><span><span className="status-dot" />A little breathing room</span>
            <button className="text-button" onClick={() => onCompose({ date: addDays(entry.start, Math.min(2, Math.floor(daysBetween(entry.start, entry.end) / 2))) })}><Plus size="0.6875rem" />Insert card here</button>
          </div>
          {entry.cards.length ? <div className="quiet-items">{entry.cards.map((card) => (
            <Link key={card.id} id={`card-${card.id}`} className={`quiet-item quiet-item-${card.type} ${highlightId === card.id ? 'is-highlighted' : ''}`} to={destinationPath({ page: TYPE_CONFIG[card.type].workspace, cardId: card.id })}>
              <TypeIcon type={card.type} size={17} /><span><strong>{formatDate(card.date, { weekday: 'short', month: 'short', day: '2-digit' })}:</strong> {card.title}</span><ChevronRight size="0.8125rem" />
            </Link>
          ))}</div> : <p className="quiet-empty">Nothing planned. Keep it open, or plant a new idea.</p>}
        </div>}
      </div>
    </section>
  )
}

function TimelineMonthEmpty({ month, filter, onCompose }: { month: string; filter: Filter; onCompose: (options?: ComposerOptions) => void }) {
  const type = filter === 'all' ? 'event' : filter
  const label = filter === 'all' ? 'An open month' : `No ${TYPE_CONFIG[type].shortLabel.toLowerCase()} yet`
  return <section className="timeline-month-empty" aria-label={`${formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}: ${label}`}>
    <CalendarDays size="1rem" aria-hidden="true" /><div><strong>{label}</strong><span>Make space for what matters, or keep this month open.</span></div>
    <button type="button" className="text-button" onClick={() => onCompose({ type, date: `${month}-01` })}><Plus size="0.75rem" />Plan</button>
  </section>
}

function TimelineBoundary({ direction, month, canLoad, onLoad }: { direction: 'past' | 'future'; month: string; canLoad: boolean; onLoad: () => void }) {
  const loading = useRef(false)
  const load = useCallback(() => {
    // Loading is intentional: observing or listening for a fling here could chain through
    // several months after the person has stopped scrolling.
    if (!canLoad || loading.current) return
    loading.current = true
    onLoad()
  }, [canLoad, onLoad])

  const period = formatDate(`${month}-01`, { month: 'long', year: 'numeric' })
  const earlier = direction === 'past'
  return <section className={`timeline-boundary timeline-boundary-${direction}`} data-timeline-month={month} aria-label={earlier ? `Load dates before ${period}` : `Load dates after ${period}`}>
    <button type="button" onClick={load} disabled={!canLoad}>
      {earlier ? <ArrowUp size=".875rem" aria-hidden="true" /> : <ArrowDown size=".875rem" aria-hidden="true" />}
      <span>{canLoad ? `Load ${earlier ? 'earlier' : 'later'} dates` : 'End of the timeline'}</span>
    </button>
  </section>
}

function plannedDate(card: JourneyCard) {
  return card.type === 'project' ? card.dueDate : card.date
}

function DesktopRailItem({ card, detail, trailing }: { card: Exclude<JourneyCard, NoteCard>; detail: string; trailing?: ReactNode }) {
  return <Link className={`desktop-rail-item rail-item-${card.type}`} to={destinationPath({ page: TYPE_CONFIG[card.type].workspace, cardId: card.id })}>
    <span className="desktop-rail-item-icon"><TypeIcon type={card.type} size={15} /></span>
    <span className="desktop-rail-item-copy"><strong>{card.title}</strong><small>{detail}</small></span>
    {trailing}<ChevronRight size=".8125rem" aria-hidden="true" />
  </Link>
}

function SpineActivityEnvelope({ activity, arrivalVersion, onOpen }: { activity: SpaceActivity[]; arrivalVersion: number; onOpen: (activity: SpaceActivity[]) => void }) {
  const count = activity.length
  const label = `${count} new teammate ${count === 1 ? 'activity' : 'activities'}. Open activity tray.`
  return <div className="spine-activity-stop">
    <button type="button" className={`spine-activity-envelope ${arrivalVersion ? 'is-arriving' : ''}`} onClick={() => onOpen(activity)} aria-label={label} title={label}>
      <span className="spine-activity-envelope-icon"><Mail size="1.0625rem" aria-hidden="true" /></span>
      <span className="spine-activity-new" aria-hidden="true">New</span>
      {count > 1 && <span className="spine-activity-count" aria-hidden="true">{count > 9 ? '9+' : count}</span>}
    </button>
  </div>
}

function SpineActivityTray({ activity, onClose }: { activity: SpaceActivity[]; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  const count = activity.length
  return <section className="spine-activity-tray" role="dialog" aria-labelledby="spine-activity-tray-title">
    <header className="spine-activity-tray-heading">
      <span className="spine-activity-tray-icon"><Mail size="1rem" aria-hidden="true" /></span>
      <div><span>Team activity</span><h2 id="spine-activity-tray-title">{count} new {count === 1 ? 'update' : 'updates'}</h2></div>
      <button ref={closeRef} type="button" className="icon-button spine-activity-tray-close" onClick={onClose} aria-label="Close new activity tray"><X size=".9375rem" /></button>
    </header>
    <ol className="spine-activity-list">{activity.map((entry) => <li key={entry.id}>
      <Link to={entry.href} onClick={onClose}><span className={`spine-activity-kind activity-${entry.kind}`}><Bell size=".8125rem" aria-hidden="true" /></span><span><strong>{entry.title}</strong><small>{entry.detail}</small><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></span><ArrowRight size=".8125rem" aria-hidden="true" /></Link>
    </li>)}</ol>
  </section>
}

function DesktopPlanningRail({ cards, today, rolloverCandidates, dispatch, onCompose }: { cards: JourneyCard[]; today: string; rolloverCandidates: RolloverCandidate[]; dispatch: Dispatch<JourneyAction>; onCompose: (options?: ComposerOptions) => void }) {
  const scheduledCards = cards.filter((card) => !card.backlog && !card.quiet)
  const actionableCards = scheduledCards.filter((card): card is Exclude<JourneyCard, NoteCard> => card.type !== 'note')
  const todayCards = actionableCards.filter((card) => card.date === today || (card.type === 'project' && card.dueDate === today))
  const todayCardIds = new Set(todayCards.map((card) => card.id))
  const upcomingCards = actionableCards.filter((card) => plannedDate(card) > today).sort((first, second) => plannedDate(first).localeCompare(plannedDate(second))).slice(0, 3)
  const unfinishedTasks = scheduledCards.filter((card): card is TaskCard => card.type === 'task' && !todayCardIds.has(card.id) && card.subtasks.some((item) => !item.done)).sort((first, second) => first.date.localeCompare(second.date)).slice(0, 3)
  const activeProjects = scheduledCards.filter((card): card is ProjectCard => card.type === 'project' && progress(card.subtasks).percent < 100).sort((first, second) => first.dueDate.localeCompare(second.dueDate)).slice(0, 3)
  const triageCards = rolloverCandidates.slice(0, 3)
  const taskDetail = (card: TaskCard) => {
    const { done, total } = progress(card.subtasks)
    return `${total - done} action${total - done === 1 ? '' : 's'} left · ${shortDate(card.date)}`
  }

  return <aside className="desktop-planning-rail" aria-label="Desktop planning summary">
    <div className="desktop-rail-heading"><span className="desktop-rail-heading-mark" aria-hidden="true"><CalendarDays size="1.125rem" /></span><div><span className="eyebrow">Planning desk</span><h2>At a glance</h2><p>Keep the next decision close while you move through your timeline.</p></div></div>
    <section className="desktop-rail-section" aria-labelledby="desktop-today-title">
      <div className="desktop-rail-section-heading"><span className="desktop-rail-section-icon"><CalendarDays size=".8125rem" /></span><div><span>Today</span><h3 id="desktop-today-title">{formatDate(today, { weekday: 'long', month: 'short', day: 'numeric' })}</h3></div></div>
      {todayCards.length ? <div className="desktop-rail-list">{todayCards.slice(0, 3).map((card) => <DesktopRailItem key={card.id} card={card} detail={card.type === 'task' ? taskDetail(card) : card.type === 'project' ? `Project due · ${progress(card.subtasks).percent}% complete` : formatTime(card.time) || 'All-day event'} />)}</div> : <p className="desktop-rail-empty">No personal cards scheduled. Keep the space open or add what matters.</p>}
    </section>
    <section className="desktop-rail-section" aria-labelledby="desktop-next-title">
      <div className="desktop-rail-section-heading"><span className="desktop-rail-section-icon"><ArrowRight size=".8125rem" /></span><div><span>Up next</span><h3 id="desktop-next-title">Coming up</h3></div></div>
      {upcomingCards.length ? <div className="desktop-rail-list">{upcomingCards.map((card) => <DesktopRailItem key={card.id} card={card} detail={`${card.type === 'project' ? 'Due' : 'Planned'} ${shortDate(plannedDate(card))}`} />)}</div> : <p className="desktop-rail-empty">Nothing later is scheduled in this timeline window.</p>}
    </section>
    <section className="desktop-rail-section" aria-labelledby="desktop-focus-title">
      <div className="desktop-rail-section-heading"><span className="desktop-rail-section-icon desktop-rail-focus"><TypeIcon type="task" size={13} /></span><div><span>Focus</span><h3 id="desktop-focus-title">Task lists to finish</h3></div></div>
      {unfinishedTasks.length ? <div className="desktop-rail-list">{unfinishedTasks.map((card) => <DesktopRailItem key={card.id} card={card} detail={taskDetail(card)} />)}</div> : <p className="desktop-rail-empty">Every visible task list is complete. Nice work.</p>}
    </section>
    <section className="desktop-rail-section desktop-triage-section" aria-labelledby="desktop-triage-title">
      <div className="desktop-rail-section-heading"><span className="desktop-rail-section-icon desktop-rail-triage"><ArrowRight size=".8125rem" /></span><div><span>Planning triage</span><h3 id="desktop-triage-title">Carry forward</h3></div>{triageCards.length > 0 && <span className="desktop-triage-count">{triageCards.length}</span>}</div>
      {triageCards.length ? <div className="desktop-triage-list">{triageCards.map((card) => {
        const due = card.type === 'project' ? card.dueDate : card.date
        return <div className={`desktop-triage-item triage-item-${card.type}`} key={card.id}><span className="desktop-triage-icon"><TypeIcon type={card.type} size={14} /></span><span className="desktop-triage-copy"><strong>{card.title}</strong><small>Overdue since {shortDate(due)}</small></span><div className="desktop-triage-actions"><button type="button" className="desktop-triage-move" aria-label={`Move ${card.title} to today`} onClick={() => dispatch({ type: 'rollover-card', id: card.id, date: today })}>Today</button><button type="button" className="desktop-triage-backlog" aria-label={`Move ${card.title} to backlog`} onClick={() => dispatch({ type: 'backlog-card', id: card.id })}>Backlog</button></div></div>
      })}</div> : <p className="desktop-rail-empty">Nothing overdue. Your plan is clear.</p>}
    </section>
    <section className="desktop-rail-section" aria-labelledby="desktop-project-title">
      <div className="desktop-rail-section-heading"><span className="desktop-rail-section-icon desktop-rail-project"><Zap size=".75rem" /></span><div><span>Projects</span><h3 id="desktop-project-title">Milestone progress</h3></div></div>
      {activeProjects.length ? <div className="desktop-rail-list">{activeProjects.map((card) => {
        const { percent } = progress(card.subtasks)
        return <DesktopRailItem key={card.id} card={card} detail={`Due ${shortDate(card.dueDate)}`} trailing={<span className="desktop-rail-progress">{percent}%</span>} />
      })}</div> : <p className="desktop-rail-empty">No active projects in this timeline window.</p>}
    </section>
    <section className="desktop-rail-quick-add" aria-labelledby="desktop-quick-add-title"><div><span className="eyebrow">Quick add</span><h3 id="desktop-quick-add-title">Make room for</h3></div><div className="desktop-quick-add-actions"><button type="button" onClick={() => onCompose({ type: 'event', date: today })}><Plus size=".75rem" />Event</button><button type="button" onClick={() => onCompose({ type: 'task', date: today })}><Plus size=".75rem" />Task list</button><button type="button" onClick={() => onCompose({ type: 'project', date: today })}><Plus size=".75rem" />Project</button></div></section>
  </aside>
}

function DawnRollover({ candidates, today, filter, dispatch }: { candidates: RolloverCandidate[]; today: string; filter: Filter; dispatch: Dispatch<JourneyAction> }) {
  const [dismissed, setDismissed] = useState<string | null>(null)
  const visible = candidates.filter((card) => (filter === 'all' || card.type === filter) && card.id !== dismissed)
  const card = visible[0]
  if (!card) return null
  const scheduledFor = card.type === 'project' ? card.dueDate : card.date
  const count = visible.length
  const countLabel = `${count} uncompleted from past ${count === 1 ? 'day' : 'days'}`
  return <section className="dawn-rollover" aria-labelledby="dawn-rollover-title">
    <div className="dawn-rollover-heading">
      <span className="dawn-rollover-icon"><Zap size="1rem" aria-hidden="true" /></span>
      <div><h2 id="dawn-rollover-title">The Dawn Rollover</h2><span>{countLabel}</span></div>
      <button type="button" className="dawn-rollover-dismiss" onClick={() => setDismissed(card.id)} aria-label="Hide this rollover reminder until your next visit" title="Hide for now"><X size="1rem" /></button>
    </div>
    <p>Incomplete deliverables carried forward — choose one clear next step for today.</p>
    <div className="dawn-rollover-item"><span aria-hidden="true" /><strong>{card.title}</strong><small>Due {shortDate(scheduledFor)}</small></div>
    <div className="dawn-rollover-actions">
      <button type="button" className="dawn-rollover-apply" onClick={() => dispatch({ type: 'rollover-card', id: card.id, date: today })}><ArrowRight size=".875rem" />Roll Over to Today</button>
      <button type="button" className="dawn-rollover-backlog" onClick={() => dispatch({ type: 'backlog-card', id: card.id })}><Folder size=".875rem" />To Backlog</button>
    </div>
  </section>
}

export function Timeline({ cards, entries, filter, onCompose, dispatch, onDeleteCard, highlightId, reminderAttentionIds, spineActivity, spineActivityArrivalVersion, spineActivitySpaceId, onOpenSpineActivity, containerRef, openGaps, onToggleGap, rolloverCandidates, rolloverDate, months, canLoadPast, canLoadFuture, onLoadPast, onLoadFuture, currentMember, canEdit }: {
  cards: JourneyCard[]
  entries: TimelineEntry[]
  filter: Filter
  onCompose: (options?: ComposerOptions) => void
  dispatch: Dispatch<JourneyAction>
  onDeleteCard: (card: JourneyCard) => void
  highlightId: string | null
  reminderAttentionIds: string[]
  spineActivity: SpaceActivity[]
  spineActivityArrivalVersion: number
  spineActivitySpaceId: string
  onOpenSpineActivity: (ids: string[]) => void
  containerRef: RefObject<HTMLElement | null>
  openGaps: string[]
  onToggleGap: (key: string) => void
  rolloverCandidates: RolloverCandidate[]
  rolloverDate: string
  months: string[]
  canLoadPast: boolean
  canLoadFuture: boolean
  onLoadPast: () => void
  onLoadFuture: () => void
  currentMember: SpaceMember
  canEdit: boolean
}) {
  const [preview, setPreview] = useState<TimelineItem | null>(null)
  const [eventActions, setEventActions] = useState<EventCard | null>(null)
  const [spineActivityTray, setSpineActivityTray] = useState<SpaceActivity[] | null>(null)
  const previewItems = useMemo(() => entries.flatMap((entry) => entry.cards), [entries])
  const reminderAttentionCardIds = useMemo(() => new Set(reminderAttentionIds), [reminderAttentionIds])
  const openPreview = useCallback((item: TimelineItem) => setPreview(item), [])
  const closePreview = useCallback(() => setPreview(null), [])
  const openEventActions = useCallback((card: EventCard) => { setPreview(null); setEventActions(card) }, [])
  const closeEventActions = useCallback(() => setEventActions(null), [])
  useEffect(() => setSpineActivityTray(null), [spineActivitySpaceId])
  const openSpineActivity = useCallback((activity: SpaceActivity[]) => {
    setSpineActivityTray(activity)
    onOpenSpineActivity(activity.map((entry) => entry.id))
  }, [onOpenSpineActivity])
  const closeSpineActivity = useCallback(() => setSpineActivityTray(null), [])
  const entriesForMonth = (month: string) => entries.filter((entry) => (entry.kind === 'day' ? entry.date : entry.start).startsWith(month))
  const renderEntry = (entry: TimelineEntry) => {
    if (entry.kind === 'gap') {
      const key = `${entry.start}-${entry.end}`
      return <QuietDays key={`${key}-${filter}`} entry={entry} onCompose={onCompose} expanded={openGaps.includes(key)} onToggle={() => onToggleGap(key)} highlightId={highlightId} />
    }
    return <DayRow key={entry.date} entry={entry} today={rolloverDate} dispatch={dispatch} highlightId={highlightId} reminderAttentionIds={reminderAttentionCardIds} onPreview={openPreview} onEventActions={openEventActions} currentMember={currentMember} canEdit={canEdit} />
  }
  const firstMonth = months[0]
  const lastMonth = months.at(-1)
  return (
    <div className="timeline-layout">
      <section ref={containerRef} id="journey-stream" className="timeline" aria-label="Journey timeline">
        <div className="timeline-spine" aria-hidden="true" /><div className="timeline-glow" aria-hidden="true" />
        {spineActivityTray ? <SpineActivityTray activity={spineActivityTray} onClose={closeSpineActivity} /> : spineActivity.length > 0 && <SpineActivityEnvelope key={`${spineActivitySpaceId}-${spineActivityArrivalVersion}`} activity={spineActivity} arrivalVersion={spineActivityArrivalVersion} onOpen={openSpineActivity} />}
        <DawnRollover candidates={rolloverCandidates} today={rolloverDate} filter={filter} dispatch={dispatch} />
        {firstMonth && <TimelineBoundary key={`past-${firstMonth}`} direction="past" month={firstMonth} canLoad={canLoadPast} onLoad={onLoadPast} />}
        {months.map((month, index) => {
          const monthEntries = entriesForMonth(month)
          return <Fragment key={month}>
            <div className={`month-marker ${index === 0 ? 'month-marker-initial' : ''}`} data-timeline-month={month}><span>{formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}</span></div>
            {monthEntries.length ? monthEntries.map(renderEntry) : <TimelineMonthEmpty month={month} filter={filter} onCompose={onCompose} />}
          </Fragment>
        })}
        <div className="horizon"><button onClick={() => onCompose()}><span className="horizon-dot" />Continue Your Journey <span className="horizon-separator">·</span> Add Next Card<Plus size="0.8125rem" /></button>
          <p>A little structure. A lot of possibility.</p>
        </div>
        {lastMonth && <TimelineBoundary key={`future-${lastMonth}`} direction="future" month={lastMonth} canLoad={canLoadFuture} onLoad={onLoadFuture} />}
        <TimelineCardPreview item={preview} items={previewItems} onItemChange={(item) => setPreview(item)} onClose={closePreview} onDeleteCard={onDeleteCard} />
        {eventActions && <EventContextMenu card={eventActions} dispatch={dispatch} currentMember={currentMember} canEdit={canEdit} onPreview={() => setPreview(eventActions)} onClose={closeEventActions} onDeleteCard={onDeleteCard} />}
      </section>
      <DesktopPlanningRail cards={cards} today={rolloverDate} rolloverCandidates={rolloverCandidates} dispatch={dispatch} onCompose={onCompose} />
    </div>
  )
}
