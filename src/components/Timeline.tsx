import { ArrowDown, ArrowRight, ArrowUp, Bell, CalendarDays, ChevronDown, ChevronRight, FileText, Flag, Landmark, MoreHorizontal, Pin, Plus, School, Users, Zap } from 'lucide-react'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Dispatch, ReactNode, RefObject } from 'react'
import type { ComposerOptions, DayEntry, EventCard, Filter, GapEntry, JourneyAction, JourneyCard, NoteCard, ProjectCard, TaskCard, TimelineEntry, TimelineItem, TimelineSourceEntry } from '../types'
import { addDays, daysBetween, formatDate, formatTime, gapLabel, progress, projectStatus, shortDate, TYPE_CONFIG } from '../lib/journey'
import { Avatar, AvatarStack, ProgressBar, TypeIcon } from './Common'
import { destinationPath } from '../lib/navigation'
import { occasionLabel, resolveOccasion } from '../lib/occasions'
import { OccasionArtwork } from './OccasionArtwork'
import { legislatedActivityIllustration } from '../lib/legislatedActivityVisuals'
import { TimelineCardPreview } from './TimelineCardPreview'

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

function CardFrame({ card, className = '', highlight, children, artwork, onPreview }: {
  card: JourneyCard
  className?: string
  highlight?: boolean
  children: ReactNode
  artwork?: ReactNode
  onPreview: () => void
}) {
  return (
    <article id={`card-${card.id}`} data-card-id={card.id} data-card-type={card.type} data-occasion={card.type === 'event' ? resolveOccasion(card) : undefined}
      className={`journey-card card-${card.type} ${className} ${highlight ? 'is-highlighted' : ''}`}>
      {artwork}
      <button type="button" className="card-open" onClick={onPreview}
        aria-label={`Preview ${card.title || 'Untitled reflection'} details`} />
      <div className="card-content">{children}</div>
    </article>
  )
}

function EventJourneyCard({ card, highlight, onPreview }: { card: EventCard; highlight: boolean; onPreview: () => void }) {
  const theme = resolveOccasion(card)
  if (theme !== 'none') return (
    <CardFrame card={card} highlight={highlight} onPreview={onPreview} className={`illustrated-event-card occasion-surface occasion-${theme}`} artwork={<OccasionArtwork theme={theme} />}>
      <div className="card-topline">
        <span className="badge occasion-event-badge">{card.holiday ? <Flag size="0.6875rem" /> : <CalendarDays size="0.6875rem" />}{card.holiday ? 'PH HOLIDAY' : occasionLabel(theme)}</span>
        <button type="button" className="icon-button card-menu interactive" onClick={onPreview} aria-label={`Preview details for ${card.title}`}><MoreHorizontal size="1.0625rem" /></button>
      </div>
      <span className="occasion-event-time">{card.allDay ? 'All day' : formatTime(card.time)}</span>
      <div className="occasion-event-copy"><h3>{card.title}</h3>{card.context && <p className="card-caption">{card.context}</p>}</div>
      <div className="card-footer occasion-event-footer"><span><CalendarDays size="0.6875rem" />Connected to Calendar</span><span className="footer-link">Open Schedule<ArrowRight size="0.75rem" /></span></div>
    </CardFrame>
  )
  if (card.holiday) return (
    <CardFrame card={card} highlight={highlight} onPreview={onPreview} className="holiday-card">
      <div className="card-topline">
        <span className="badge holiday-badge"><Flag size="0.75rem" />PH HOLIDAY</span>
        <div className="person-actions">
          <span className="person-pill holiday-person"><Avatar name="You" />You</span>
          <button type="button" className="icon-button card-menu interactive" onClick={onPreview} aria-label={`Preview details for ${card.title}`}><MoreHorizontal size="1rem" /></button>
        </div>
      </div>
      <span className="badge all-day-badge"><CalendarDays size="0.6875rem" />ALL DAY</span>
      <h3>{card.title}</h3>
      <p className="card-caption truncate">{card.context}</p>
      <div className="card-footer holiday-footer">
        <span><CalendarDays size="0.6875rem" />Connected to Calendar</span>
        <span className="footer-link">Open Schedule <ArrowRight size="0.75rem" /></span>
      </div>
    </CardFrame>
  )
  return (
    <CardFrame card={card} highlight={highlight} onPreview={onPreview} className="standard-event-card">
      <div className="card-topline event-topline">
        <span className="event-time">{card.allDay ? 'ALL DAY' : formatTime(card.time, true)}</span>
        <div className="person-actions">
          <span className="person-pill"><Avatar name={card.owner} /><span>{card.owner}</span></span>
          <button type="button" className="icon-button card-menu interactive" onClick={onPreview} aria-label={`Preview details for ${card.title}`}><MoreHorizontal size="1.0625rem" /></button>
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

function TaskJourneyCard({ card, dispatch, highlight, onPreview }: { card: TaskCard; dispatch: Dispatch<JourneyAction>; highlight: boolean; onPreview: () => void }) {
  const { done, total } = progress(card.subtasks)
  return (
    <CardFrame card={card} highlight={highlight} onPreview={onPreview}>
      <div className="card-topline task-topline">
        <span className="badge type-badge"><TypeIcon type="task" size={12} />Task & Reminder</span>
        {card.reminder && <span className="reminder-pill"><Bell size="0.6875rem" />{formatTime(card.reminder)}</span>}
      </div>
      <h3>{card.title}</h3>
      <div className="timeline-checklist">
        {card.subtasks.slice(0, 3).map((item) => (
          <label key={item.id} className={`timeline-check interactive ${item.done ? 'is-done' : ''}`}>
            <input type="checkbox" checked={item.done} onChange={() => dispatch({ type: 'toggle-item', cardId: card.id, itemId: item.id })} />
            <span>{item.title}</span>
          </label>
        ))}
        {total > 3 && <span className="more-items">+{total - 3} more in Personal Tasks</span>}
      </div>
      <div className="card-footer task-footer"><span>{done} of {total} completed</span><span className="footer-link">Personal Tasks Page <ArrowRight size="0.75rem" /></span></div>
    </CardFrame>
  )
}

function NoteJourneyCard({ card, highlight, onPreview }: { card: NoteCard; highlight: boolean; onPreview: () => void }) {
  return (
    <CardFrame card={card} highlight={highlight} onPreview={onPreview} className="journal-paper">
      <div className="card-topline note-topline">
        <span className="badge type-badge"><TypeIcon type="note" size={11} />Journal Note</span>
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

function ProjectJourneyCard({ card, highlight, onPreview }: { card: ProjectCard; highlight: boolean; onPreview: () => void }) {
  const { done, total, percent } = progress(card.subtasks)
  if (!card.featured) return (
    <CardFrame card={card} highlight={highlight} onPreview={onPreview} className="sprint-card">
      <div className="card-topline">
        <span className="badge type-badge"><Zap size="0.6875rem" />Project Sprint</span>
        <span className="on-track"><span className="status-dot" />{percent === 100 ? 'Completed' : 'On track'}</span>
      </div>
      <h3>{card.title}</h3>
      <p className="card-caption">{card.team.length} Collaborators <span className="meta-dot">·</span> {card.context}</p>
      <ProgressBar value={percent} label={`${card.title} progress`} />
      <div className="sprint-footer"><span><strong>{done}</strong> / {total} Tasks Done</span><span className="footer-link">Open Projects <ArrowRight size="0.75rem" /></span></div>
    </CardFrame>
  )
  return (
    <CardFrame card={card} highlight={highlight} onPreview={onPreview} className="featured-project-card">
      <div className="project-heading">
        <div><h3>{card.title}</h3><p className="card-caption">Due Date: {shortDate(card.dueDate)} <span className="meta-dot">·</span> {card.context || 'Personal Project'}</p></div>
        <span className="project-orb"><Zap size="1.4375rem" strokeWidth={1.8} /></span>
      </div>
      <div className="project-meta">
        <AvatarStack names={card.team} />
        <span className={`project-status ${percent === 100 ? 'is-complete' : ''}`}><span className="status-dot" />{projectStatus(percent)}</span>
      </div>
      <ProgressBar value={percent} label={`${card.title} progress`} />
      <div className="project-footer"><span><strong>{done}</strong> / {total} Total Tasks</span><strong>{percent}%</strong></div>
    </CardFrame>
  )
}

function JourneyCardView({ card, dispatch, highlight, onPreview }: { card: JourneyCard; dispatch: Dispatch<JourneyAction>; highlight: boolean; onPreview: () => void }) {
  switch (card.type) {
    case 'event': return <EventJourneyCard card={card} highlight={highlight} onPreview={onPreview} />
    case 'task': return <TaskJourneyCard card={card} dispatch={dispatch} highlight={highlight} onPreview={onPreview} />
    case 'note': return <NoteJourneyCard card={card} highlight={highlight} onPreview={onPreview} />
    case 'project': return <ProjectJourneyCard card={card} highlight={highlight} onPreview={onPreview} />
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
  const SourceIcon = isSchoolCalendar ? School : isLegislated ? Landmark : FileText
  const visualClass = isSchoolCalendar ? 'source-school-calendar' : isLegislated ? 'source-legislated-activity' : 'source-local-memo'
  const illustration = isLegislated ? legislatedActivityIllustration(entry.title) : undefined
  return <article id={`source-${entry.id}`} className={`journey-card calendar-source-event timeline-source-card ${visualClass}${illustration ? ` legislated-illustration-${illustration}` : ''}`} data-source-id={entry.sourceId} data-card-type="calendar-source" data-illustration={illustration}>
    <button type="button" className="timeline-source-open" onClick={onPreview} aria-label={`Preview ${entry.title} details`} />
    <div className="calendar-source-event-meta"><span><CalendarDays size="0.75rem" />{sourceEntryDate(entry)}</span><span className="badge">{entry.sourceLabel}</span></div>
    <h3>{entry.title}</h3>
    <p>{entry.detail ?? entry.sourceProvenance}</p>
    <div className="calendar-source-event-note"><SourceIcon size="0.75rem" aria-hidden="true" />{isLegislated ? 'Legislated annual observance · reference only' : isSchoolCalendar ? 'DepEd school calendar · reference only' : 'Calendar source · reference only, not a personal card'}</div>
  </article>
}

function DayRow({ entry, dispatch, highlightId, onPreview }: { entry: DayEntry; dispatch: Dispatch<JourneyAction>; highlightId: string | null; onPreview: (item: TimelineItem) => void }) {
  const ref = useReveal()
  const first = entry.cards[0]
  const firstIsSource = isTimelineSourceEntry(first)
  const isMonday = formatDate(entry.date, { weekday: 'short' }) === 'Mon'
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
        : <JourneyCardView key={card.id} card={card} dispatch={dispatch} highlight={highlightId === card.id} onPreview={() => onPreview(card)} />
      )}</div>
      <div className="date-node-wrapper">
        <Link className={`date-node ${!firstIsSource && first.type === 'project' ? 'date-project' : isMonday ? 'date-monday' : ''}`}
          to={firstIsSource ? `/calendar?date=${entry.date}` : destinationPath({ page: TYPE_CONFIG[first.type].workspace, cardId: first.id })}
          aria-label={firstIsSource ? `View ${formatDate(entry.date, { month: 'long', day: 'numeric' })} in Calendar` : `Open ${formatDate(entry.date, { month: 'long', day: 'numeric' })} details`}>
          <span>{formatDate(entry.date, { weekday: 'short' })}</span><strong>{entry.date.slice(8)}</strong>
        </Link>
      </div>
      <div className="card-column card-col-right">{itemsForSide('right').map((card) => isTimelineSourceEntry(card)
        ? <TimelineSourceCard key={card.id} entry={card} onPreview={() => onPreview(card)} />
        : <JourneyCardView key={card.id} card={card} dispatch={dispatch} highlight={highlightId === card.id} onPreview={() => onPreview(card)} />
      )}</div>
    </section>
  )
}

function QuietDays({ entry, onCompose, expanded, onToggle, highlightId, onPreview }: { entry: GapEntry; onCompose: (options?: ComposerOptions) => void; expanded: boolean; onToggle: () => void; highlightId: string | null; onPreview: (card: JourneyCard) => void }) {
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
            <button key={card.id} id={`card-${card.id}`} type="button" className={`quiet-item quiet-item-${card.type} ${highlightId === card.id ? 'is-highlighted' : ''}`} onClick={() => onPreview(card)}>
              <TypeIcon type={card.type} size={17} /><span><strong>{formatDate(card.date, { weekday: 'short', month: 'short', day: '2-digit' })}:</strong> {card.title}</span><ChevronRight size="0.8125rem" />
            </button>
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
  const ref = useRef<HTMLElement>(null)
  const loaded = useRef(false)
  const pastReady = useRef(typeof window !== 'undefined' && window.scrollY > 96)
  const load = useCallback(() => {
    if (!canLoad || loaded.current) return
    loaded.current = true
    onLoad()
  }, [canLoad, onLoad])

  useEffect(() => {
    const element = ref.current
    if (!element || !canLoad || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && (direction === 'future' || pastReady.current)) load()
    }, { rootMargin: direction === 'future' ? '280px 0px' : '0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [canLoad, direction, load])

  useEffect(() => {
    if (direction !== 'past') return
    let touchStart = 0
    const rememberScroll = () => { if (window.scrollY > 96) pastReady.current = true }
    const atTopBoundary = () => window.scrollY <= 2 && (ref.current?.getBoundingClientRect().top ?? Infinity) < window.innerHeight * .8
    const revealWithWheel = (event: WheelEvent) => { if (event.deltaY < -8 && atTopBoundary()) load() }
    const rememberTouch = (event: TouchEvent) => { touchStart = event.touches[0]?.clientY ?? 0 }
    const revealWithPull = (event: TouchEvent) => {
      const position = event.touches[0]?.clientY ?? touchStart
      if (position - touchStart > 28 && atTopBoundary()) load()
    }
    window.addEventListener('scroll', rememberScroll, { passive: true })
    window.addEventListener('wheel', revealWithWheel, { passive: true })
    window.addEventListener('touchstart', rememberTouch, { passive: true })
    window.addEventListener('touchmove', revealWithPull, { passive: true })
    return () => {
      window.removeEventListener('scroll', rememberScroll)
      window.removeEventListener('wheel', revealWithWheel)
      window.removeEventListener('touchstart', rememberTouch)
      window.removeEventListener('touchmove', revealWithPull)
    }
  }, [direction, load])

  const period = formatDate(`${month}-01`, { month: 'long', year: 'numeric' })
  const earlier = direction === 'past'
  return <section ref={ref} className={`timeline-boundary timeline-boundary-${direction}`} data-timeline-month={month} aria-label={earlier ? `Load dates before ${period}` : `Load dates after ${period}`}>
    <button type="button" onClick={load} disabled={!canLoad}>
      {earlier ? <ArrowUp size=".875rem" aria-hidden="true" /> : <ArrowDown size=".875rem" aria-hidden="true" />}
      <span>{canLoad ? `Keep scrolling for ${earlier ? 'earlier' : 'later'} dates` : 'End of the timeline'}</span>
    </button>
  </section>
}

export function Timeline({ entries, filter, onCompose, dispatch, highlightId, containerRef, openGaps, onToggleGap, months, canLoadPast, canLoadFuture, onLoadPast, onLoadFuture }: {
  entries: TimelineEntry[]
  filter: Filter
  onCompose: (options?: ComposerOptions) => void
  dispatch: Dispatch<JourneyAction>
  highlightId: string | null
  containerRef: RefObject<HTMLElement | null>
  openGaps: string[]
  onToggleGap: (key: string) => void
  months: string[]
  canLoadPast: boolean
  canLoadFuture: boolean
  onLoadPast: () => void
  onLoadFuture: () => void
}) {
  const [preview, setPreview] = useState<TimelineItem | null>(null)
  const openPreview = useCallback((item: TimelineItem) => setPreview(item), [])
  const closePreview = useCallback(() => setPreview(null), [])
  const entriesForMonth = (month: string) => entries.filter((entry) => (entry.kind === 'day' ? entry.date : entry.start).startsWith(month))
  const renderEntry = (entry: TimelineEntry) => {
    if (entry.kind === 'gap') {
      const key = `${entry.start}-${entry.end}`
      return <QuietDays key={`${key}-${filter}`} entry={entry} onCompose={onCompose} expanded={openGaps.includes(key)} onToggle={() => onToggleGap(key)} highlightId={highlightId} onPreview={openPreview} />
    }
    return <DayRow key={entry.date} entry={entry} dispatch={dispatch} highlightId={highlightId} onPreview={openPreview} />
  }
  const firstMonth = months[0]
  const lastMonth = months.at(-1)
  return (
    <section ref={containerRef} id="journey-stream" className="timeline" aria-label="Journey timeline">
      <div className="timeline-spine" aria-hidden="true" /><div className="timeline-glow" aria-hidden="true" />
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
      <TimelineCardPreview item={preview} onClose={closePreview} onEventBackgroundChange={(card, occasion) => dispatch({ type: 'update-event-background', id: card.id, occasion })} />
    </section>
  )
}
