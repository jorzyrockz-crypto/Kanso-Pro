import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock3, FileText, Flag, Landmark, MapPin, Pin, School, Tag, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { PointerEvent as ReactPointerEvent, ReactNode, TouchEvent as ReactTouchEvent } from 'react'
import type { EventCard, NoteCard, ProjectCard, TaskCard, TimelineItem, TimelineSourceEntry } from '../types'
import { destinationPath } from '../lib/navigation'
import { formatDate, formatTime, progress, TYPE_CONFIG } from '../lib/journey'
import { occasionLabel, resolveOccasion } from '../lib/occasions'
import { AvatarStack, ProgressBar, TypeIcon } from './Common'
import { CardDeleteAction } from './CardDeleteAction'

const focusable = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

function isSource(item: TimelineItem): item is TimelineSourceEntry {
  return 'calendarSource' in item && item.calendarSource
}

function dateRange(date: string, endDate?: string) {
  const full = (value: string) => formatDate(value, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  return endDate && endDate !== date ? `${full(date)} – ${full(endDate)}` : full(date)
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div className="timeline-preview-detail"><dt>{label}</dt><dd>{children}</dd></div>
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <dl className="timeline-preview-detail-grid">{children}</dl>
}

function PreviewSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="timeline-preview-section"><h3>{title}</h3>{children}</section>
}

function ChecklistPreview({ items, label }: { items: TaskCard['subtasks']; label: string }) {
  const summary = progress(items)
  return <PreviewSection title={`${label} · ${summary.done} of ${summary.total} complete`}>
    {items.length ? <ul className="timeline-preview-checklist">{items.map((item) => <li className={item.done ? 'is-done' : ''} key={item.id}>{item.done ? <CheckCircle2 size="1rem" aria-label="Complete" /> : <Circle size="1rem" aria-label="Not complete" />}<span>{item.title}</span>{item.assignee && <small>{item.assignee}</small>}</li>)}</ul>
      : <p className="timeline-preview-empty">No checklist items yet.</p>}
  </PreviewSection>
}

function EventPreview({ card }: { card: EventCard }) {
  const occasion = resolveOccasion(card)
  const time = card.allDay ? 'All day' : `${formatTime(card.time) || 'Time not set'}${card.endTime ? ` – ${formatTime(card.endTime)}` : ''}`
  return <>
    <DetailGrid>
      <Detail label="Date">{dateRange(card.date)}</Detail><Detail label="Time">{time}</Detail>
      <Detail label="Calendar">{card.organization || 'Personal Calendar'}</Detail><Detail label="Organizer">{card.owner || 'You'}</Detail>
      {card.location && <Detail label="Location"><span className="timeline-preview-inline"><MapPin size=".875rem" aria-hidden="true" />{card.location}</span></Detail>}
      {card.holiday && <Detail label="Type"><span className="timeline-preview-inline"><Flag size=".875rem" aria-hidden="true" />Philippine holiday</span></Detail>}
      {occasion !== 'none' && <Detail label="Background">{occasionLabel(occasion)}</Detail>}
    </DetailGrid>
    {card.context && <PreviewSection title="Context"><p className="timeline-preview-copy">{card.context}</p></PreviewSection>}
  </>
}

function TaskPreview({ card }: { card: TaskCard }) {
  return <>
    <DetailGrid><Detail label="Planned for">{dateRange(card.date)}</Detail>{card.reminder && <Detail label="Reminder"><span className="timeline-preview-inline"><Clock3 size=".875rem" aria-hidden="true" />{formatTime(card.reminder)}</span></Detail>}</DetailGrid>
    {card.context && <PreviewSection title="Context"><p className="timeline-preview-copy">{card.context}</p></PreviewSection>}
    <ChecklistPreview items={card.subtasks} label="Checklist" />
  </>
}

function ProjectPreview({ card }: { card: ProjectCard }) {
  const checklist = progress(card.subtasks)
  return <>
    <DetailGrid>
      <Detail label="Started">{dateRange(card.date)}</Detail><Detail label="Due">{dateRange(card.dueDate)}</Detail>
      <Detail label="Progress">{checklist.percent}% complete</Detail><Detail label="Plan type">{card.featured ? 'Featured project' : 'Project sprint'}</Detail>
    </DetailGrid>
    {card.context && <PreviewSection title="Purpose"><p className="timeline-preview-copy">{card.context}</p></PreviewSection>}
    <PreviewSection title={`Collaborators · ${card.team.length || 1}`}><div className="timeline-preview-team"><AvatarStack names={card.team.length ? card.team : ['You']} /><span>{(card.team.length ? card.team : ['You']).join(', ')}</span></div></PreviewSection>
    <PreviewSection title={`Progress · ${checklist.done} of ${checklist.total} tasks`}><ProgressBar value={checklist.percent} label={`${card.title} progress`} /></PreviewSection>
    <ChecklistPreview items={card.subtasks} label="Tasks" />
  </>
}

function NotePreview({ card }: { card: NoteCard }) {
  return <>
    <DetailGrid><Detail label="Written">{dateRange(card.date)}</Detail>{card.time && <Detail label="Time"><span className="timeline-preview-inline"><Clock3 size=".875rem" aria-hidden="true" />{formatTime(card.time)}</span></Detail>}{card.pinned && <Detail label="Status"><span className="timeline-preview-inline"><Pin size=".875rem" aria-hidden="true" />Pinned</span></Detail>}</DetailGrid>
    {card.context && <PreviewSection title="Context"><p className="timeline-preview-copy">{card.context}</p></PreviewSection>}
    <PreviewSection title="Journal entry"><p className="timeline-preview-note">{card.body || 'This note is ready for your next thought.'}</p></PreviewSection>
    {card.tags.length > 0 && <PreviewSection title="Tags"><div className="timeline-preview-tags">{card.tags.map((tag) => <span key={tag}><Tag size=".6875rem" aria-hidden="true" />{tag}</span>)}</div></PreviewSection>}
  </>
}

function SourcePreview({ entry }: { entry: TimelineSourceEntry }) {
  const schoolCalendar = entry.sourceId === 'deped-sy-2026-2027'
  const Icon = schoolCalendar ? School : entry.sourceId === 'deped-legislated-activities' ? Landmark : FileText
  return <>
    <DetailGrid><Detail label="Date">{dateRange(entry.date, entry.endDate)}</Detail><Detail label="Source">{entry.sourceLabel}</Detail><Detail label="Entry type"><span className="timeline-preview-inline"><Icon size=".875rem" aria-hidden="true" />Reference only</span></Detail></DetailGrid>
    {entry.detail && <PreviewSection title="Reference details"><p className="timeline-preview-copy">{entry.detail}</p></PreviewSection>}
    <PreviewSection title="Provenance"><p className="timeline-preview-copy">{entry.sourceProvenance}</p></PreviewSection>
  </>
}

export function TimelineCardPreview({ item, items = [], onClose, onItemChange, onDeleteCard }: {
  item: TimelineItem | null
  items?: readonly TimelineItem[]
  onClose: () => void
  onItemChange?: (item: TimelineItem) => void
  onDeleteCard?: (card: EventCard | TaskCard | NoteCard) => void
}) {
  const headingId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const swipeStart = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const activeIndex = item ? items.findIndex((candidate) => candidate.id === item.id && isSource(candidate) === isSource(item)) : -1
  const previous = activeIndex > 0 ? items[activeIndex - 1] : undefined
  const next = activeIndex >= 0 && activeIndex < items.length - 1 ? items[activeIndex + 1] : undefined
  const navigatePreview = (direction: -1 | 1) => {
    const target = direction === -1 ? previous : next
    if (target) onItemChange?.(target)
  }
  const open = !!item

  useEffect(() => {
    if (!open) return
    const focusedBeforeOpen = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus({ preventScroll: true })
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      const nativeField = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement
      if (!nativeField && event.key === 'ArrowLeft' && previous) { event.preventDefault(); navigatePreview(-1); return }
      if (!nativeField && event.key === 'ArrowRight' && next) { event.preventDefault(); navigatePreview(1); return }
      if (event.key !== 'Tab') return
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusable) ?? [])
      if (!controls.length) return
      const first = controls[0]
      const last = controls.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', keyboard)
      if (focusedBeforeOpen?.isConnected) focusedBeforeOpen.focus({ preventScroll: true })
    }
  }, [next, onClose, open, previous])

  if (!item) return null

  const beginSwipe = (pointerId: number, x: number, y: number) => { swipeStart.current = { pointerId, x, y } }
  const finishSwipe = (pointerId: number, x: number, y: number) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start || start.pointerId !== pointerId) return
    const horizontal = x - start.x
    const vertical = y - start.y
    if (Math.abs(horizontal) < 48 || Math.abs(horizontal) <= Math.abs(vertical)) return
    navigatePreview(horizontal < 0 ? 1 : -1)
  }
  const onSwipeStart = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch') return
    beginSwipe(event.pointerId, event.clientX, event.clientY)
    // Some test/embedded WebViews reject capture for synthetic pointers; the swipe still
    // works from the dialog handlers, while real touch pointers stay captured off-target.
    try { event.currentTarget.setPointerCapture?.(event.pointerId) } catch { /* no pointer capture available */ }
  }
  const onSwipeEnd = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch') return
    finishSwipe(event.pointerId, event.clientX, event.clientY)
    try { if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* capture was not established */ }
  }
  // Older mobile WebViews can expose touch events without PointerEvent. Avoid duplicate
  // navigation on modern browsers, where the pointer handlers above already own the gesture.
  const onTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    if (typeof window !== 'undefined' && 'PointerEvent' in window) return
    const touch = event.touches[0]
    if (touch) beginSwipe(touch.identifier, touch.clientX, touch.clientY)
  }
  const onTouchEnd = (event: ReactTouchEvent<HTMLElement>) => {
    if (typeof window !== 'undefined' && 'PointerEvent' in window) return
    const touch = event.changedTouches[0]
    if (touch) finishSwipe(touch.identifier, touch.clientX, touch.clientY)
  }

  const source = isSource(item)
  const config = source ? null : TYPE_CONFIG[item.type]
  const typeLabel = source ? item.sourceLabel : config!.label
  const actionHref = source ? `/calendar?date=${item.date}` : destinationPath({ page: config!.workspace, cardId: item.id })
  const actionLabel = source ? 'View in Calendar' : config!.link
  const canManage = !source && (item.type === 'event' || item.type === 'task' || item.type === 'note')
  const canEdit = !source && (item.type === 'event' || item.type === 'task')
  const preview = source ? <SourcePreview entry={item} /> : item.type === 'event' ? <EventPreview card={item} /> : item.type === 'task' ? <TaskPreview card={item} /> : item.type === 'project' ? <ProjectPreview card={item} /> : <NotePreview card={item} />

  return <div className="timeline-preview-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className={`timeline-preview-dialog ${source ? 'is-source' : `is-${item.type}`}`} role="dialog" aria-modal="true" aria-labelledby={headingId} aria-describedby={descriptionId} onPointerDown={onSwipeStart} onPointerUp={onSwipeEnd} onPointerCancel={() => { swipeStart.current = null }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="timeline-preview-header"><span className="timeline-preview-type-icon">{source ? <Landmark size="1.125rem" aria-hidden="true" /> : <TypeIcon type={item.type} size={18} />}</span><div className="timeline-preview-heading"><span>{typeLabel}</span><h2 id={headingId}>{item.title || 'Untitled reflection'}</h2></div>{items.length > 1 && <div className="timeline-preview-navigation"><button type="button" className="icon-button timeline-preview-previous" aria-label="Previous preview" disabled={!previous} onClick={() => navigatePreview(-1)}><ChevronLeft size="1rem" aria-hidden="true" /></button><span aria-live="polite">{activeIndex + 1} of {items.length}</span><button type="button" className="icon-button timeline-preview-next" aria-label="Next preview" disabled={!next} onClick={() => navigatePreview(1)}><ChevronRight size="1rem" aria-hidden="true" /></button><span className="sr-only">Swipe left or right to browse nearby entries.</span></div>}<button ref={closeRef} type="button" className="timeline-preview-close" aria-label="Close card preview" onClick={onClose}><X size="1rem" aria-hidden="true" /></button></header>
      <div className="timeline-preview-body"><p id={descriptionId} className="timeline-preview-intro">{source ? 'A calendar reference kept separate from your personal cards.' : 'A complete preview of this card, without leaving your timeline.'}</p>{preview}</div>
      <footer className="timeline-preview-actions"><button type="button" className="button timeline-preview-dismiss" onClick={onClose}>Close</button>{canEdit ? <Link className="button timeline-preview-open" to={`/new?edit=${encodeURIComponent(item.id)}`} state={{ from: actionHref }} onClick={onClose}>Edit {item.type === 'event' ? 'event' : 'task list'}</Link> : <Link className="button timeline-preview-open" to={actionHref} onClick={onClose}>{actionLabel}</Link>}{canManage && onDeleteCard && <CardDeleteAction card={item} onDelete={(card) => { onClose(); onDeleteCard(card as EventCard | TaskCard | NoteCard) }} />}</footer>
    </section>
  </div>
}
