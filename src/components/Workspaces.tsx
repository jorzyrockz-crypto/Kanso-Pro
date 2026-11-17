import { ArrowDown, ArrowRight, ArrowUp, Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, FileText, Landmark, MessageSquareText, Pencil, Plus, Printer, School, Users, Zap } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Dispatch, FormEvent, ReactNode } from 'react'
import { FOCUS_DATE } from '../data'
import type { ComposerOptions, Destination, EventCard, JourneyAction, JourneyCard, ProjectCard, Space, SpaceMember, TaskCard, TimelineItem, TimelineSourceEntry, Workspace } from '../types'
import { calendarDays, formatDate, formatTime, makeId, progress, shiftMonth, shortDate, TYPE_CONFIG } from '../lib/journey'
import { AddChecklistItem, Avatar, EmptyState, ProgressBar, SaveIndicator, TeamScopeToggle, TypeIcon } from './Common'
import type { CloudSaveState } from './Common'
import { NotFoundPage } from './PageHeader'
import { destinationPath, WORKSPACE_PATHS, WORKSPACE_TYPES } from '../lib/navigation'
import { calendarPeriod, monthScene } from '../lib/months'
import { cardAssignedTo } from '../lib/spaces'
import { MonthArtwork, monthPalette } from './MonthArtwork'
import { calendarSourceEntriesForMonth } from '../lib/calendarSources'
import type { CalendarSource, CalendarSourceEntry } from '../lib/calendarSources'
import { TimelineCardPreview } from './TimelineCardPreview'
import { JournalWorkspace } from './JournalWorkspace'
import { CardDeleteAction } from './CardDeleteAction'

const workspaceNames: Record<Workspace, string> = {
  calendar: 'Calendar', tasks: 'Personal Tasks', project: 'Projects', journal: 'Journal',
}

type WorkspaceProps = {
  cards: JourneyCard[]
  calendarSources: CalendarSource[]
  cardId?: string
  dispatch: Dispatch<JourneyAction>
  onCompose: (options?: ComposerOptions) => void
  onNavigate: (destination: Destination) => void
  onDeleteCard: (card: JourneyCard) => void
  members: SpaceMember[]
  currentMember: SpaceMember
  scope: 'all' | 'assigned'
  onScopeChange: (scope: 'all' | 'assigned') => void
  canEdit: boolean
  space: Space
}

function WorkspaceHero({ type, eyebrow, title, children, stat, extra, actions, month }: {
  type: 'event' | 'task' | 'project' | 'note'
  eyebrow: string
  title: string
  children: ReactNode
  stat?: { label: string; value: string | number }
  extra?: ReactNode
  actions?: ReactNode
  month?: string
}) {
  return <div className={`workspace-hero hero-${type} ${month ? 'month-calendar-hero' : ''}`} style={month ? monthPalette(monthScene(month)) : undefined}>
    {month && <MonthArtwork month={month} side="right" className="month-hero-artwork" />}
    <div className="hero-copy"><div className="hero-eyebrows"><span className="hero-eyebrow"><TypeIcon type={type} size={11} />{eyebrow}</span>{extra}</div>
      <h2>{title}</h2><p>{children}</p>
    </div>
    {stat && <div className="hero-stat"><span>{stat.label}</span><strong>{stat.value}</strong></div>}
    {actions && <div className="hero-actions">{actions}</div>}
  </div>
}

function CalendarEvent({ card, highlighted, onPreview }: { card: EventCard; highlighted: boolean; onPreview: () => void }) {
  const time = card.allDay ? 'All day' : `${formatTime(card.time)}${card.endTime ? ` – ${formatTime(card.endTime)}` : ''}`
  return <article className={`calendar-event calendar-preview-entry ${highlighted ? 'selected-event' : ''}`} data-event-id={card.id}>
    <button type="button" className="calendar-preview-card" onClick={onPreview} aria-label={`Preview ${card.title} details`}>
      <span className="calendar-event-meta"><span><CalendarDays size="0.75rem" />{formatDate(card.date, { weekday: 'short', month: 'short', day: '2-digit' })} <i aria-hidden="true">·</i> {time || 'Time not set'}</span><span className="badge">{card.organization || 'Personal'}</span></span>
      <span className="calendar-preview-title"><strong>{card.title}</strong><ChevronRight size="1rem" aria-hidden="true" /></span>
    </button>
  </article>
}

function sourceEntryDate(entry: CalendarSourceEntry) {
  const start = formatDate(entry.date, { weekday: 'short', month: 'short', day: '2-digit' })
  if (!entry.endDate || entry.endDate === entry.date) return start
  return `${start} – ${formatDate(entry.endDate, { month: 'short', day: '2-digit' })}`
}

function CalendarSourceEvent({ entry, source, onPreview }: { entry: CalendarSourceEntry; source?: CalendarSource; onPreview: () => void }) {
  const isSchoolCalendar = source?.id === 'deped-sy-2026-2027'
  const isLegislated = source?.id === 'deped-legislated-activities'
  const SourceIcon = isSchoolCalendar ? School : isLegislated ? Landmark : FileText
  const visualClass = isSchoolCalendar ? 'source-school-calendar' : isLegislated ? 'source-legislated-activity' : 'source-local-memo'
  return <article className={`calendar-source-event calendar-preview-entry ${visualClass}`} data-source-id={entry.sourceId}>
    <button type="button" className="calendar-preview-card" onClick={onPreview} aria-label={`Preview ${entry.title} reference details`}>
      <span className="calendar-source-event-meta"><span><SourceIcon size="0.75rem" />{sourceEntryDate(entry)}</span><span className="badge">{source?.shortLabel ?? 'Calendar source'}</span></span>
      <span className="calendar-preview-title"><strong>{entry.title}</strong><ChevronRight size="1rem" aria-hidden="true" /></span>
    </button>
  </article>
}

type CalendarAgendaItem = JourneyCard | CalendarSourceEntry

function isCalendarSourceEntry(entry: CalendarAgendaItem): entry is CalendarSourceEntry {
  return 'sourceId' in entry
}

function timelineSourcePreview(entry: CalendarSourceEntry, source?: CalendarSource): TimelineSourceEntry {
  return {
    ...entry,
    sourceLabel: source?.shortLabel ?? 'Calendar source',
    sourceProvenance: [source?.provenance, source?.reference].filter(Boolean).join(' ') || 'Reference date from an enabled calendar source.',
    side: 'left',
    calendarSource: true,
  }
}

type CalendarFilter = 'event' | 'task' | 'project' | 'note' | 'source'

const calendarFilters: { type: CalendarFilter; label: string }[] = [
  { type: 'event', label: 'Events' }, { type: 'task', label: 'Task lists' }, { type: 'project', label: 'Projects' }, { type: 'note', label: 'Journal Notes' }, { type: 'source', label: 'Calendar source' },
]

function isMonthObservance(entry: CalendarSourceEntry) {
  return !!entry.endDate && entry.endDate > entry.date
}

function CalendarDateAddMenu({ date, onCompose }: { date: string; onCompose: (options?: ComposerOptions) => void }) {
  const [open, setOpen] = useState(false)
  const menuId = `calendar-add-${date}`
  const choices: { type: 'event' | 'task' | 'project' | 'note'; label: string }[] = [
    { type: 'event', label: 'Event' }, { type: 'task', label: 'Task list' }, { type: 'project', label: 'Project' }, { type: 'note', label: 'Journal note' },
  ]
  return <div className="calendar-add-menu"><button type="button" className="text-button" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((current) => !current)}><Plus size=".75rem" />Add</button>
    {open && <div id={menuId} className="calendar-add-options" role="group" aria-label={`Add a card on ${formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}`}>
      {choices.map(({ type, label }) => <button key={type} type="button" onClick={() => onCompose({ type, date })}><TypeIcon type={type} size={13} />{label}</button>)}
    </div>}
  </div>
}

function CalendarWorkspace({ cards, calendarSources, cardId, onCompose, onNavigate, onDeleteCard, canEdit }: WorkspaceProps) {
  const initialCard = cards.find((card) => card.id === cardId)
  const navigate = useNavigate()
  const [query] = useSearchParams()
  const [preview, setPreview] = useState<TimelineItem | null>(null)
  const [enabledFilters, setEnabledFilters] = useState<Set<CalendarFilter>>(() => new Set(calendarFilters.map(({ type }) => type)))
  const [observancesOpen, setObservancesOpen] = useState(false)
  const closePreview = useCallback(() => setPreview(null), [])
  const { month, selectedDate } = calendarPeriod(query, initialCard?.date)
  const monthCards = cards.filter((card) => !card.backlog && card.date.startsWith(month))
  const sourceEntries = calendarSourceEntriesForMonth(calendarSources, month)
  const sourceById = new Map(calendarSources.map((source) => [source.id, source]))
  const visibleCards = monthCards.filter((card) => enabledFilters.has(card.type))
  const visibleSources = sourceEntries.filter(() => enabledFilters.has('source'))
  const monthObservances = visibleSources.filter(isMonthObservance).sort((first, second) => first.date.localeCompare(second.date) || first.title.localeCompare(second.title))
  // Without a date in the URL, keep the original useful monthly overview as the fallback.
  const agenda: CalendarAgendaItem[] = selectedDate
    ? [...visibleCards.filter((card) => card.date === selectedDate), ...visibleSources.filter((entry) => entry.date === selectedDate && !isMonthObservance(entry))]
    : [...visibleCards, ...visibleSources.filter((entry) => !isMonthObservance(entry))]
  const sortedAgenda = [...agenda].sort((first, second) => first.date.localeCompare(second.date) || first.title.localeCompare(second.title))
  const previewItems: TimelineItem[] = [...sortedAgenda, ...monthObservances].map((entry) => isCalendarSourceEntry(entry) ? timelineSourcePreview(entry, sourceById.get(entry.sourceId)) : entry)
  const visibleEntryCount = visibleCards.filter((card): card is EventCard => card.type === 'event').length + visibleSources.length
  const changeMonth = (amount: number) => navigate(`/calendar?month=${shiftMonth(month, amount)}`)
  const toggleFilter = (type: CalendarFilter) => setEnabledFilters((current) => {
    const next = new Set(current)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    return next
  })
  const openAgendaEntry = (entry: JourneyCard) => {
    if (entry.type === 'task') { onNavigate({ page: 'tasks', cardId: entry.id }); return }
    if (entry.type === 'project') { onNavigate({ page: 'project', cardId: entry.id }); return }
    setPreview(entry)
  }
  const renderAgendaEntry = (entry: CalendarAgendaItem) => isCalendarSourceEntry(entry)
    ? <CalendarSourceEvent key={entry.id} entry={entry} source={sourceById.get(entry.sourceId)} onPreview={() => setPreview(timelineSourcePreview(entry, sourceById.get(entry.sourceId)))} />
    : entry.type === 'event'
      ? <CalendarEvent key={entry.id} card={entry} highlighted={entry.id === cardId} onPreview={() => setPreview(entry)} />
      : <button key={entry.id} type="button" className={`agenda-item agenda-item-${entry.type}`} onClick={() => openAgendaEntry(entry)} aria-label={`${entry.type === 'task' || entry.type === 'project' ? 'Open' : 'Preview'} ${entry.title || 'Untitled reflection'} details`}>
        <span className="agenda-item-icon"><TypeIcon type={entry.type} size={19} /></span><span><small>{TYPE_CONFIG[entry.type].label}</small><strong>{entry.title || 'Untitled reflection'}</strong></span><ChevronRight size="0.9375rem" aria-hidden="true" />
      </button>
  const selectedHeading = selectedDate ? formatDate(selectedDate, { weekday: 'long', month: 'short', day: 'numeric' }) : 'Connected calendar details'
  if (initialCard?.type === 'event') {
    const event = initialCard
    const time = event.allDay ? 'All day' : `${formatTime(event.time)}${event.endTime ? ` – ${formatTime(event.endTime)}` : ''}`
    return <div className="workspace-content calendar-workspace calendar-event-detail-page">
      <WorkspaceHero type="event" eyebrow="Calendar event" title={event.title || 'Untitled event'} stat={{ label: 'Planned for', value: shortDate(event.date) }} extra={<span className="hero-date">{time || 'Time not set'}</span>}
        actions={<div className="calendar-event-detail-actions"><Link className="button button-soft" to={`/calendar?date=${event.date}`}><CalendarDays size=".8125rem" />View schedule</Link>{canEdit && <CardDeleteAction card={event} onDelete={(card) => { onDeleteCard(card); onNavigate({ page: 'calendar' }) }} />}</div>}>
        {event.context || 'A focused moment in this Space’s shared calendar.'}
      </WorkspaceHero>
      <section className="workspace-panel calendar-event-detail" aria-label={`${event.title || 'Untitled event'} details`}>
        <dl><div><dt>Date</dt><dd>{formatDate(event.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</dd></div><div><dt>Time</dt><dd>{time || 'Time not set'}</dd></div><div><dt>Calendar</dt><dd>{event.organization || 'Personal Calendar'}</dd></div>{event.location && <div><dt>Location</dt><dd>{event.location}</dd></div>}{event.owner && <div><dt>Organizer</dt><dd>{event.owner}</dd></div>}</dl>
        <Link className="text-button" to="/">View on timeline <ArrowRight size=".75rem" /></Link>
      </section>
    </div>
  }
  return <div className="workspace-content calendar-workspace">
    <WorkspaceHero type="event" month={month} eyebrow="Connected Calendar View" title={`${formatDate(`${month}-01`, { month: 'long', year: 'numeric' })} Schedule`}
      stat={{ label: visibleEntryCount === 1 ? 'Entry this month' : 'Entries this month', value: visibleEntryCount }}>
      Your personal plans and any calendar sources you choose to show.
    </WorkspaceHero>
    <section className="workspace-panel calendar-panel" aria-label="Monthly calendar">
      <div className="panel-heading calendar-toolbar"><h3>{formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}</h3>
        <div className="calendar-controls"><button className="text-button" onClick={() => navigate(`/calendar?date=${FOCUS_DATE}`)}>Focus date</button><button className="text-button calendar-today-button" onClick={() => navigate(`/calendar?date=${localDate()}`)}>Today</button>
          <button className="icon-button" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size="1.0625rem" /></button>
          <button className="icon-button" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size="1.0625rem" /></button></div></div>
      <div className="calendar-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day} className="calendar-weekday">{day}</span>)}
        {calendarDays(month).map((date, index) => {
          if (!date) return <span key={`blank-${index}`} className="calendar-blank" />
          const dateCards = visibleCards.filter((card) => card.date === date)
          // A range is represented at its occurrence start, keeping the month grid legible.
          const dateSourceEntries = visibleSources.filter((entry) => entry.date === date)
          const labels = [
            dateCards.length ? `${dateCards.length} personal ${dateCards.length === 1 ? 'card' : 'cards'}` : '',
            dateSourceEntries.length ? `${dateSourceEntries.length} calendar-source ${dateSourceEntries.length === 1 ? 'entry' : 'entries'}` : '',
          ].filter(Boolean).join(', ') || 'no entries'
          return <button key={date} className={`calendar-day ${selectedDate === date ? 'is-selected' : ''} ${date === localDate() ? 'is-today' : ''}`}
            onClick={() => navigate(`/calendar?date=${date}`)} aria-pressed={selectedDate === date}
            aria-label={`${formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}, ${labels}`}>
            <span>{Number(date.slice(8))}</span><span className="calendar-dots">{[...new Set(dateCards.map((card) => card.type))].map((type) => <i key={type} className={`calendar-dot dot-${type}`} />)}{dateSourceEntries.length > 0 && <i className="calendar-dot dot-source" />}</span>
          </button>
        })}
      </div>
      <div className="calendar-legend" role="group" aria-label="Calendar entry filters">{calendarFilters.map(({ type, label }) => <button key={type} type="button" className={`calendar-legend-pill ${enabledFilters.has(type) ? 'is-active' : ''}`} aria-pressed={enabledFilters.has(type)} onClick={() => toggleFilter(type)}><i className={`calendar-dot dot-${type === 'source' ? 'source' : type}`} />{label}</button>)}</div>
    </section>
    <section className="workspace-panel agenda-panel" aria-label={selectedDate ? `${selectedHeading} agenda` : 'Calendar agenda'}>
      <div className="panel-heading agenda-heading"><div>{selectedDate && <span className="eyebrow">Selected date</span>}<h3>{selectedHeading}</h3></div>
        {selectedDate ? <div className="agenda-heading-actions"><CalendarDateAddMenu date={selectedDate} onCompose={onCompose} /></div> : <button className="text-button" onClick={() => navigate(`/calendar?month=${month}`)}>All entries</button>}</div>
      {sortedAgenda.length ? <div className="agenda-list">{sortedAgenda.map(renderAgendaEntry)}</div>
        : selectedDate ? <p className="calendar-date-empty">No items specifically scheduled for this date.</p>
          : <EmptyState title="A little breathing room" action={<button className="button button-soft" onClick={() => onCompose({ type: 'event', date: `${month}-01` })}><Plus size="0.8125rem" />Plan something</button>}>No personal cards or enabled source entries here yet. An open day has its own possibilities.</EmptyState>}
      {monthObservances.length > 0 && <section className="month-observances" aria-labelledby="month-observances-title"><button type="button" className="month-observances-toggle" aria-expanded={observancesOpen} aria-controls="month-observances-list" onClick={() => setObservancesOpen((current) => !current)}><span><span className="eyebrow">Calendar source</span><strong id="month-observances-title">Month Observances</strong><small>{monthObservances.length} multi-day {monthObservances.length === 1 ? 'entry' : 'entries'}</small></span><ChevronDown size=".9375rem" /></button>
        {observancesOpen && <div id="month-observances-list" className="agenda-list month-observances-list">{monthObservances.map(renderAgendaEntry)}</div>}</section>}
      {!selectedDate && sortedAgenda.length > 0 && <button className="text-button agenda-add" onClick={() => onCompose({ type: 'event', date: `${month}-14` })}><Plus size="0.8125rem" />Add a personal event</button>}
    </section>
    <TimelineCardPreview item={preview} items={previewItems} onItemChange={(item) => setPreview(item)} onClose={closePreview} onDeleteCard={onDeleteCard} />
  </div>
}

function localDate(offset = 0) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function taskReminderState(task: TaskCard) {
  if (!task.reminder) return null
  const formatted = formatTime(task.reminder)
  if (task.date !== localDate()) return { text: `${formatted} reminder`, passed: false }
  const [hours, minutes] = task.reminder.split(':').map(Number)
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes() > hours * 60 + minutes
    ? { text: `Passed · ${formatted}`, passed: true }
    : { text: `${formatted} reminder`, passed: false }
}

function InlineComments({ item, cardId, dispatch, author, canEdit }: { item: TaskCard['subtasks'][number] | ProjectCard['subtasks'][number]; cardId: string; dispatch: Dispatch<JourneyAction>; author: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const comments = item.comments ?? []
  const addComment = (event: FormEvent) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body) return
    dispatch({ type: 'update-item', cardId, item: { ...item, comments: [...comments, { id: makeId('comment'), body: body.slice(0, 360), author, createdAt: new Date().toISOString() }] } })
    setDraft('')
    setOpen(true)
  }
  return <div className="inline-comments"><button type="button" className="inline-comments-toggle" aria-expanded={open} onClick={() => setOpen((current) => !current)}><MessageSquareText size=".6875rem" />{comments.length ? `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}` : 'Add comment'}</button>
    {open && <div className="inline-comments-panel">{comments.length > 0 && <ol>{comments.map((comment) => <li key={comment.id}><strong>{comment.author}</strong><span>{comment.body}</span></li>)}</ol>}{canEdit && <form onSubmit={addComment}><label className="sr-only" htmlFor={`comment-${cardId}-${item.id}`}>Add a comment</label><input id={`comment-${cardId}-${item.id}`} value={draft} maxLength={360} placeholder="Add a concise update…" onChange={(event) => setDraft(event.target.value)} /><button type="submit" className="text-button">Send</button></form>}</div>}
  </div>
}

function TaskChecklistRow({ item, index, task, dispatch, members, currentMember, canEdit }: { item: TaskCard['subtasks'][number]; index: number; task: TaskCard; dispatch: Dispatch<JourneyAction>; members: SpaceMember[]; currentMember: SpaceMember; canEdit: boolean }) {
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [draft, setDraft] = useState(() => ({ title: item.title, time: item.time ?? '', note: item.note ?? '', assignee: item.assignee ?? '' }))
  const reset = () => setDraft({ title: item.title, time: item.time ?? '', note: item.note ?? '', assignee: item.assignee ?? '' })
  const save = (event: FormEvent) => {
    event.preventDefault()
    const title = draft.title.trim()
    if (!title) return
    dispatch({ type: 'update-item', cardId: task.id, item: { ...item, title: title.slice(0, 240), time: draft.time || undefined, note: draft.note.trim().slice(0, 240) || undefined, assignee: draft.assignee || undefined } })
    setEditing(false)
  }
  const subtext = [item.time ? formatTime(item.time) : '', item.note].filter(Boolean).join(' · ')
  return <article className={`workspace-check task-check task-check-item ${item.done ? 'is-done' : ''}`}>
    <div className="task-check-row"><label className="task-check-toggle"><input type="checkbox" checked={item.done} disabled={!canEdit} onChange={() => dispatch({ type: 'toggle-item', cardId: task.id, itemId: item.id, actor: currentMember.name })} /><span className="check-copy"><strong>{item.title}</strong>{subtext && <small>{subtext}</small>}{item.assignee && <small className="item-attribution">Assigned to {item.assignee}</small>}{item.done && item.completedBy && <small className="item-attribution is-complete">Completed by {item.completedBy}</small>}</span></label>
      {canEdit && <div className="task-item-actions">{removing ? <span className="task-remove-confirm"><span>Remove?</span><button type="button" className="text-button" onClick={() => setRemoving(false)}>Keep</button><button type="button" className="text-button task-delete-confirm" onClick={() => dispatch({ type: 'delete-item', cardId: task.id, itemId: item.id })}>Delete</button></span> : <><button type="button" className="icon-button" aria-label={`Edit checklist item ${index + 1}`} title="Edit item" onClick={() => { reset(); setEditing(true) }}><Pencil size=".8125rem" /></button><button type="button" className="icon-button" aria-label={`Move checklist item ${index + 1} up`} title="Move up" disabled={index === 0} onClick={() => dispatch({ type: 'move-item', cardId: task.id, itemId: item.id, direction: 'up' })}><ArrowUp size=".8125rem" /></button><button type="button" className="icon-button" aria-label={`Move checklist item ${index + 1} down`} title="Move down" disabled={index === task.subtasks.length - 1} onClick={() => dispatch({ type: 'move-item', cardId: task.id, itemId: item.id, direction: 'down' })}><ArrowDown size=".8125rem" /></button><button type="button" className="icon-button task-delete-button" aria-label={`Delete checklist item ${index + 1}`} title="Delete item" onClick={() => setRemoving(true)}><span aria-hidden="true">×</span></button></>}</div>}
    </div>
    <InlineComments item={item} cardId={task.id} dispatch={dispatch} author={currentMember.name} canEdit={canEdit} />
    {editing && <form className="task-item-editor" onSubmit={save}><div className="task-edit-fields"><label>Item<input aria-label={`Checklist item ${index + 1} title`} required maxLength={240} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label><label>Assignee<select aria-label={`Checklist item ${index + 1} assignee`} value={draft.assignee} onChange={(event) => setDraft((current) => ({ ...current, assignee: event.target.value }))}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}</select></label><label>Time<input aria-label={`Checklist item ${index + 1} time`} type="time" value={draft.time} onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))} /></label></div><label className="task-item-note">Note<input aria-label={`Checklist item ${index + 1} note`} maxLength={240} value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Optional note" /></label><div className="task-item-editor-actions"><button type="button" className="button button-quiet" onClick={() => { reset(); setEditing(false) }}>Cancel</button><button type="submit" className="button button-soft">Save item</button></div></form>}
  </article>
}

function TaskWorkspace({ cards, cardId, dispatch, onCompose, onNavigate, onDeleteCard, members, currentMember, scope, onScopeChange, canEdit }: WorkspaceProps) {
  const tasks = cards.filter((card): card is TaskCard => card.type === 'task' && (scope === 'all' || cardAssignedTo(card, currentMember)))
  const activeId = cardId ?? 'task-grades'
  const selected = tasks.find((card) => card.id === activeId) ?? tasks[0]
  if (!selected) return <div className="workspace-content task-workspace"><TeamScopeToggle scope={scope} memberName={currentMember.name} onChange={onScopeChange} /><EmptyState title={scope === 'assigned' ? `No tasks assigned to ${currentMember.name}` : 'Small steps start here'} action={canEdit ? <button className="button button-dark" onClick={() => onCompose({ type: 'task' })}><Plus size="0.875rem" />Create a task list</button> : undefined}>Keep related, date-specific actions together. Add a reminder when the timing matters.</EmptyState></div>
  const { done, total, percent } = progress(selected.subtasks)
  const unfinished = selected.subtasks.filter((item) => !item.done)
  const reminder = taskReminderState(selected)
  const clearCompleted = () => dispatch({ type: 'update-card', card: { ...selected, subtasks: selected.subtasks.filter((item) => !item.done) } })
  const moveUnfinishedToTomorrow = () => {
    if (!unfinished.length) return
    const tomorrow = localDate(1)
    const movedItems = unfinished.map((item) => ({ ...item, id: makeId('task'), done: false }))
    const existingTomorrow = tasks.find((task) => task.id !== selected.id && task.date === tomorrow)
    if (existingTomorrow) {
      dispatch({ type: 'update-card', card: { ...existingTomorrow, subtasks: [...existingTomorrow.subtasks, ...movedItems] } })
      dispatch({ type: 'update-card', card: { ...selected, subtasks: selected.subtasks.filter((item) => item.done) } })
      onNavigate({ page: 'tasks', cardId: existingTomorrow.id })
      return
    }
    const tomorrowList: TaskCard = { ...selected, id: makeId('task'), title: `${selected.title} · follow-up`, date: tomorrow, side: selected.side === 'left' ? 'right' : 'left', subtasks: movedItems, quiet: false, backlog: false, isCustom: true }
    dispatch({ type: 'add-card', card: tomorrowList })
    dispatch({ type: 'update-card', card: { ...selected, subtasks: selected.subtasks.filter((item) => item.done) } })
    onNavigate({ page: 'tasks', cardId: tomorrowList.id })
  }
  const promoteToProject = () => {
    const project: ProjectCard = { id: makeId('project'), type: 'project', title: selected.title, date: selected.date, dueDate: selected.date, side: selected.side, context: selected.context, quiet: selected.quiet, backlog: selected.backlog, isCustom: true, featured: true, team: members.map((member) => member.name), subtasks: selected.subtasks.map((item) => ({ ...item })) }
    dispatch({ type: 'add-card', card: project })
    dispatch({ type: 'delete-card', id: selected.id })
    onNavigate({ page: 'project', cardId: project.id })
  }
  return <div className="workspace-content task-workspace">
    <div className="workspace-selector"><label htmlFor="task-list-select">Your task list</label><select id="task-list-select" value={selected.id} onChange={(event) => onNavigate({ page: 'tasks', cardId: event.target.value })}>
      {tasks.map((card) => <option key={card.id} value={card.id}>{card.title}</option>)}
    </select></div>
    <TeamScopeToggle scope={scope} memberName={currentMember.name} onChange={onScopeChange} />
    <WorkspaceHero type="task" eyebrow={scope === 'assigned' ? `Tasks assigned to ${currentMember.name}` : 'Task lists · immediate action'} title={selected.title} stat={{ label: 'Completion', value: `${percent}%` }} extra={<span className="hero-date">Planned {shortDate(selected.date)}</span>}>
      {selected.context || 'A focused list for the actions that matter today.'}
    </WorkspaceHero>
    <div className="workspace-desktop-split">
      <section className="workspace-panel checklist-panel">
        <div className="checklist-heading"><div><span className="eyebrow">{formatDate(selected.date, { weekday: 'long', month: 'short', day: 'numeric' })}</span><h3>Checklist</h3></div>
          {reminder && <span className={`reminder-pill ${reminder.passed ? 'is-passed' : ''}`}><Bell size="0.75rem" />{reminder.text}</span>}</div>
        {canEdit && <div className="task-card-actions"><Link className="button button-soft" to={`/new?edit=${encodeURIComponent(selected.id)}`} state={{ from: destinationPath({ page: 'tasks', cardId: selected.id }) }}><Pencil size=".8125rem" />Edit task list</Link>{unfinished.length > 0 && <button type="button" className="button task-rollover-action" onClick={moveUnfinishedToTomorrow}><ArrowRight size=".8125rem" />Move unfinished to tomorrow</button>}<button type="button" className="button button-soft" onClick={promoteToProject}><Zap size=".8125rem" />Promote to project</button><CardDeleteAction card={selected} onDelete={(card) => { onDeleteCard(card); onNavigate({ page: 'tasks' }) }} /></div>}
        <div className="checklist-progress"><ProgressBar value={percent} label="Task list completion" /><span>{done} of {total} completed</span>{canEdit && done > 0 && <button type="button" className="text-button clear-completed" onClick={clearCompleted}>Clear completed</button>}</div>
        <div className="workspace-checklist">{selected.subtasks.map((item, index) => <TaskChecklistRow key={item.id} item={item} index={index} task={selected} dispatch={dispatch} members={members} currentMember={currentMember} canEdit={canEdit} />)}</div>
        {!total && <p className="inline-empty">No items yet. Add the first one below.</p>}
        {canEdit && <AddChecklistItem key={selected.id} placeholder="Add a checklist item…" label="Add item" onAdd={(title) => dispatch({ type: 'add-item', cardId: selected.id, item: { id: makeId('task'), title, done: false, assignee: currentMember.name } })} />}
      </section>
      <aside className="workspace-desktop-aside task-workspace-aside" aria-label="Task list context">
        <section className="workspace-insight-card task-insight-card"><span className="eyebrow"><TypeIcon type="task" size={11} />Task-list plan</span><h3>At a glance</h3><dl className="workspace-insight-list"><div><dt>Planned for</dt><dd>{formatDate(selected.date, { weekday: 'short', month: 'short', day: 'numeric' })}</dd></div><div><dt>Reminder</dt><dd>{reminder?.text ?? 'No reminder'}</dd></div><div><dt>Actions left</dt><dd>{total - done} of {total}</dd></div></dl></section>
        {tasks.length > 1 && <div className="other-lists"><span className="eyebrow">Your other lists</span>{tasks.filter((card) => card.id !== selected.id).map((card) => <Link key={card.id} className="list-summary" to={destinationPath({ page: 'tasks', cardId: card.id })}>
          <span className="list-icon"><TypeIcon type="task" size={17} /></span><span><strong>{card.title}</strong><small>{shortDate(card.date)} · {progress(card.subtasks).done} of {card.subtasks.length} completed</small></span><ChevronRight size="1rem" />
        </Link>)}</div>}
        <p className="workspace-fineprint"><Bell size="0.75rem" />Reminder times are planning labels, not device notifications.</p>
      </aside>
    </div>
  </div>
}

function projectDueStatus(dueDate: string) {
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const due = Date.UTC(Number(dueDate.slice(0, 4)), Number(dueDate.slice(5, 7)) - 1, Number(dueDate.slice(8, 10)))
  const days = Math.round((due - today) / 86_400_000)
  if (days < 0) return { text: `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} overdue`, tone: 'is-overdue' }
  if (days === 0) return { text: 'Due today', tone: 'is-today' }
  if (days === 1) return { text: 'Due tomorrow', tone: 'is-upcoming' }
  return { text: `${days} days remaining`, tone: 'is-upcoming' }
}

function escapePrint(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function printProjectSummary(project: ProjectCard) {
  const { done, total, percent } = progress(project.subtasks)
  const rows = project.subtasks.map((item, index) => `<tr><td>${index + 1}</td><td>${escapePrint(item.title)}</td><td>${escapePrint(item.assignee || '—')}</td><td>${item.targetDate ? escapePrint(formatDate(item.targetDate, { month: 'short', day: 'numeric', year: 'numeric' })) : '—'}</td><td>${item.done ? 'Completed' : 'Open'}</td><td>${escapePrint(item.remarks || '—')}</td></tr>`).join('') || '<tr><td colspan="6">No milestones yet.</td></tr>'
  const summary = window.open('', '_blank')
  if (!summary) return
  summary.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapePrint(project.title)} · Project summary</title><style>body{max-width:58rem;margin:0 auto;padding:2rem;font:15px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#26384d}h1{margin:0;color:#223d58;font:700 32px/1.2 Georgia,serif}h2{margin:2rem 0 .6rem;font-size:16px}.meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem;margin:1.5rem 0;padding:1rem;border:1px solid #cbddeb;border-radius:12px;background:#f6fbff}.meta span{display:block;color:#60758a;font-size:12px;font-weight:700;text-transform:uppercase}.meta strong{display:block;margin-top:.2rem}.team{margin:0;padding:0;list-style:none}.team li{display:inline-block;margin:0 .4rem .4rem 0;padding:.25rem .5rem;border-radius:99px;background:#f0edff;color:#51498c}table{width:100%;border-collapse:collapse}th,td{padding:.65rem;border:1px solid #cbddeb;text-align:left;vertical-align:top}th{background:#eef7fd;color:#385a73;font-size:12px;text-transform:uppercase}@media print{body{padding:0}.print{display:none}}</style></head><body><button class="print" type="button" onclick="window.print()">Print / Save as PDF</button><h1>${escapePrint(project.title)}</h1><p>${escapePrint(project.context || 'No project purpose added.')}</p><section class="meta"><div><span>Start date</span><strong>${escapePrint(formatDate(project.date, { month: 'short', day: 'numeric', year: 'numeric' }))}</strong></div><div><span>Due date</span><strong>${escapePrint(formatDate(project.dueDate, { month: 'short', day: 'numeric', year: 'numeric' }))}</strong></div><div><span>Overall progress</span><strong>${percent}% · ${done} of ${total}</strong></div></section><h2>Planning team</h2><ul class="team">${project.team.map((member) => `<li>${escapePrint(member)}</li>`).join('')}</ul><h2>Milestones</h2><table><thead><tr><th>#</th><th>Milestone</th><th>Assignee</th><th>Target date</th><th>Status</th><th>Remarks</th></tr></thead><tbody>${rows}</tbody></table></body></html>`)
  summary.document.close()
  summary.focus()
}

function ProjectMilestoneRow({ item, index, project, dispatch, members, currentMember, canEdit }: { item: ProjectCard['subtasks'][number]; index: number; project: ProjectCard; dispatch: Dispatch<JourneyAction>; members: SpaceMember[]; currentMember: SpaceMember; canEdit: boolean }) {
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [draft, setDraft] = useState(() => ({ title: item.title, assignee: item.assignee ?? '', targetDate: item.targetDate ?? '', label: item.label ?? '', remarks: item.remarks ?? '' }))
  const reset = () => setDraft({ title: item.title, assignee: item.assignee ?? '', targetDate: item.targetDate ?? '', label: item.label ?? '', remarks: item.remarks ?? '' })
  const save = (event: FormEvent) => {
    event.preventDefault()
    const title = draft.title.trim()
    if (!title) return
    dispatch({ type: 'update-item', cardId: project.id, item: {
      ...item,
      title: title.slice(0, 240),
      assignee: draft.assignee.trim().slice(0, 120) || undefined,
      targetDate: draft.targetDate || undefined,
      label: draft.label.trim().slice(0, 80) || undefined,
      remarks: draft.remarks.trim().slice(0, 240) || undefined,
    } })
    setEditing(false)
  }
  const meta = [item.targetDate ? `Target ${shortDate(item.targetDate)}` : '', item.label ? item.label : ''].filter(Boolean)
  return <article className={`workspace-check project-check project-milestone ${item.done ? 'is-done' : ''}`}>
    <div className="project-milestone-row">
      <label className="project-milestone-toggle"><input type="checkbox" checked={item.done} disabled={!canEdit} onChange={() => dispatch({ type: 'toggle-item', cardId: project.id, itemId: item.id, actor: currentMember.name })} />
        <span className="check-copy"><strong>{index + 1}. {item.title}</strong><small>{item.assignee ? `Assigned to: ${item.assignee}` : 'No assignee yet'}{meta.length ? ` · ${meta.join(' · ')}` : ''}</small>{item.done && item.completedBy && <small className="item-attribution is-complete">Completed by {item.completedBy}</small>}{item.remarks && <em className="milestone-remark"><MessageSquareText size=".6875rem" />{item.remarks}</em>}</span>
      </label>
      {canEdit && <div className="project-milestone-actions">{removing ? <span className="milestone-remove-confirm"><span>Remove?</span><button type="button" className="text-button" onClick={() => setRemoving(false)}>Keep</button><button type="button" className="text-button milestone-delete-confirm" onClick={() => dispatch({ type: 'delete-item', cardId: project.id, itemId: item.id })}>Delete</button></span> : <><button type="button" className="icon-button" aria-label={`Edit milestone ${index + 1}`} title="Edit milestone" onClick={() => { reset(); setEditing(true) }}><Pencil size=".8125rem" /></button><button type="button" className="icon-button milestone-delete-button" aria-label={`Delete milestone ${index + 1}`} title="Delete milestone" onClick={() => setRemoving(true)}><span aria-hidden="true">×</span></button></>}</div>}
    </div>
    <InlineComments item={item} cardId={project.id} dispatch={dispatch} author={currentMember.name} canEdit={canEdit} />
    {editing && <form className="milestone-editor" onSubmit={save}>
      <div className="milestone-edit-fields"><label>Milestone<input aria-label={`Milestone ${index + 1} title`} required maxLength={240} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label><label>Assignee<select aria-label={`Milestone ${index + 1} assignee`} value={draft.assignee} onChange={(event) => setDraft((current) => ({ ...current, assignee: event.target.value }))}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}</select></label><label>Target date<input aria-label={`Milestone ${index + 1} target date`} type="date" min={project.date} value={draft.targetDate} onChange={(event) => setDraft((current) => ({ ...current, targetDate: event.target.value }))} /></label><label>Tag / label<input aria-label={`Milestone ${index + 1} tag`} maxLength={80} value={draft.label} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} placeholder="Q1, MOOE…" /></label></div>
      <label className="milestone-remarks">Remarks<input aria-label={`Milestone ${index + 1} remarks`} maxLength={240} value={draft.remarks} onChange={(event) => setDraft((current) => ({ ...current, remarks: event.target.value }))} placeholder="Optional blocker or status update" /></label>
      <div className="milestone-editor-actions"><button type="button" className="button button-quiet" onClick={() => { reset(); setEditing(false) }}>Cancel</button><button type="submit" className="button button-soft">Save milestone</button></div>
    </form>}
  </article>
}

function ProjectWorkspace({ cards, cardId, dispatch, onCompose, onNavigate, onDeleteCard, members, currentMember, scope, onScopeChange, canEdit, space }: WorkspaceProps) {
  const projects = cards.filter((card): card is ProjectCard => card.type === 'project' && (scope === 'all' || cardAssignedTo(card, currentMember)))
  const activeId = cardId ?? 'proj-tos'
  const selected = projects.find((card) => card.id === activeId) ?? projects[0]
  if (!selected) return <div className="workspace-content project-workspace"><TeamScopeToggle scope={scope} memberName={currentMember.name} onChange={onScopeChange} /><EmptyState icon={<Zap size="1.5rem" />} title={scope === 'assigned' ? `No projects assigned to ${currentMember.name}` : 'Turn a bigger outcome into milestones'} action={canEdit ? <button className="button button-dark" onClick={() => onCompose({ type: 'project' })}><Plus size="0.875rem" />New project</button> : undefined}>Set a start and due date, then build the milestones and collaborators around it.</EmptyState></div>
  const { done, total, percent } = progress(selected.subtasks)
  const nextMilestone = selected.subtasks.find((item) => !item.done)
  const allMilestonesComplete = total > 0 && done === total
  const dueStatus = projectDueStatus(nextMilestone?.targetDate ?? selected.dueDate)
  return <div className="workspace-content project-workspace">
    {projects.length > 1 && <div className="workspace-selector project-selector"><label htmlFor="project-select">Project workspace</label><select id="project-select" value={selected.id} onChange={(event) => onNavigate({ page: 'project', cardId: event.target.value })}>
      {projects.map((card) => <option key={card.id} value={card.id}>{card.title}</option>)}
    </select></div>}
    <TeamScopeToggle scope={scope} memberName={currentMember.name} onChange={onScopeChange} />
    <WorkspaceHero type="project" eyebrow={scope === 'assigned' ? `Projects assigned to ${currentMember.name}` : 'Projects · outcomes over time'} title={selected.title} stat={{ label: 'Project progress', value: `${percent}%` }}
      extra={<><span className="hero-date">Start {shortDate(selected.date)}</span><span className="hero-date">Due {shortDate(selected.dueDate)}</span></>}
      actions={<div className="project-hero-actions">{canEdit && <Link className="button button-soft" to={`/new?edit=${encodeURIComponent(selected.id)}`} state={{ from: destinationPath({ page: 'project', cardId: selected.id }) }}><Pencil size=".8125rem" />Edit project</Link>}<button type="button" className="button hero-print-summary" onClick={() => printProjectSummary(selected)}><Printer size=".8125rem" />Export / Print summary</button>{canEdit && <CardDeleteAction card={selected} onDelete={() => { onDeleteCard(selected); onNavigate({ page: 'project' }) }} />}</div>}>
      {selected.context || 'Guide a larger outcome from its start date to its due date with milestones and collaborators.'}
    </WorkspaceHero>
    <section className={`project-pulse ${allMilestonesComplete ? 'is-complete' : ''}`} aria-label="Project pulse"><div><span className="eyebrow"><Zap size={11} />{allMilestonesComplete ? 'Project complete' : 'Next milestone'}</span><strong>{allMilestonesComplete ? 'All milestones completed' : nextMilestone?.title ?? 'Add your first milestone'}</strong><p>{allMilestonesComplete ? 'Every listed deliverable is complete. Keep this plan as a finished reference.' : nextMilestone?.assignee ? `Owned by ${nextMilestone.assignee}` : nextMilestone ? 'Keep the next meaningful step visible.' : 'A clear next step makes the project easier to move forward.'}</p></div><span className={`project-due-status ${allMilestonesComplete ? 'is-complete' : dueStatus.tone}`}>{allMilestonesComplete ? <Check size=".8125rem" /> : <Clock3 size=".8125rem" />}{allMilestonesComplete ? 'Complete' : dueStatus.text}</span></section>
    <div className="workspace-desktop-split">
      <section className="workspace-panel checklist-panel">
        <div className="panel-heading project-milestone-heading"><div><h3>Milestones & deliverables</h3><span className="count-label">{done} / {total} complete</span></div></div>
        <ProgressBar value={percent} label="Project completion" />
        <div className="workspace-checklist">{selected.subtasks.map((item, index) => <ProjectMilestoneRow key={item.id} item={item} index={index} project={selected} dispatch={dispatch} members={members} currentMember={currentMember} canEdit={canEdit} />)}</div>
        {!total && <p className="inline-empty">Every project starts with one small step. Add a milestone below.</p>}
        {canEdit && <AddChecklistItem key={selected.id} placeholder="Add a project milestone…" label="Add milestone" onAdd={(title) => dispatch({ type: 'add-item', cardId: selected.id, item: { id: makeId('milestone'), title, done: false, assignee: currentMember.name } })} />}
      </section>
      <aside className="workspace-desktop-aside project-workspace-aside" aria-label="Project context">
        <section className="workspace-insight-card project-insight-card"><span className="eyebrow"><Zap size={11} />Project plan</span><h3>At a glance</h3><dl className="workspace-insight-list"><div><dt>Started</dt><dd>{shortDate(selected.date)}</dd></div><div><dt>Due</dt><dd>{shortDate(selected.dueDate)}</dd></div><div><dt>Progress</dt><dd>{percent}% · {done} of {total}</dd></div><div><dt>Next up</dt><dd>{nextMilestone?.title ?? 'Complete'}</dd></div></dl></section>
        {projects.length > 1 && <div className="other-lists project-other-projects"><span className="eyebrow">Other projects</span>{projects.filter((project) => project.id !== selected.id).map((project) => { const milestone = project.subtasks.find((item) => !item.done); const projectProgress = progress(project.subtasks); return <Link key={project.id} className="list-summary" to={destinationPath({ page: 'project', cardId: project.id })}>
          <span className="list-icon"><Zap size={17} /></span><span><strong>{project.title}</strong><small>Due {shortDate(project.dueDate)} · {projectProgress.percent}% complete{milestone ? ` · Next: ${milestone.title}` : ''}</small></span><ChevronRight size="1rem" />
        </Link> })}</div>}
        <div className="team-panel"><span className="eyebrow"><Users size="0.8125rem" />Space members</span><div className="team-members">{members.map((member) => <span className="person-pill" key={member.id}><Avatar name={member.name} />{member.name}<small>{member.role}</small></span>)}{selected.team.filter((name) => !members.some((member) => member.name === name)).map((name) => <span className="person-pill is-project-member" key={name}><Avatar name={name} />{name}<small>project member</small></span>)}</div></div>
        <p className="workspace-fineprint"><Users size=".75rem" />{space.kind === 'shared' ? 'Assignments, comments, and milestone handoffs stay visible to this Space.' : 'Personal Space is private to you. Create a shared Space when you are ready to collaborate.'}</p>
      </aside>
    </div>
  </div>
}

export function WorkspacePage({ page, cards, calendarSources, dispatch, onNavigate, onCompose, onDeleteCard, storageAvailable, cloudSaveState, journalUserId, space, currentMember, members, scope, onScopeChange, canEdit }: {
  page: Workspace
  cards: JourneyCard[]
  calendarSources: CalendarSource[]
  dispatch: Dispatch<JourneyAction>
  onNavigate: (destination: Destination) => void
  onCompose: (options?: ComposerOptions) => void
  onDeleteCard: (card: JourneyCard) => void
  storageAvailable: boolean
  cloudSaveState: CloudSaveState
  journalUserId: string | null
  space: Space
  currentMember: SpaceMember
  members: SpaceMember[]
  scope: 'all' | 'assigned'
  onScopeChange: (scope: 'all' | 'assigned') => void
  canEdit: boolean
}) {
  const { cardId } = useParams()
  const selected = cards.find((card) => card.id === cardId && card.type === WORKSPACE_TYPES[page])
  if (cardId && !selected) return <NotFoundPage card backTo={WORKSPACE_PATHS[page]} />
  const props = { cards, calendarSources, cardId, dispatch, onCompose, onNavigate, onDeleteCard, members, currentMember, scope, onScopeChange, canEdit, space }

  return <main id="main-content" tabIndex={-1} className={`workspace-page workspace-${page}`} aria-label={workspaceNames[page]}>
    <div className="workspace-body" key={`${page}-${cardId ?? 'default'}`}>
      {page === 'calendar' && <CalendarWorkspace {...props} />}
      {page === 'tasks' && <TaskWorkspace {...props} />}
      {page === 'project' && <ProjectWorkspace {...props} />}
      {page === 'journal' && <JournalWorkspace {...props} storageAvailable={storageAvailable} cloudSaveState={cloudSaveState} firestoreUserId={journalUserId} />}
      <div className="workspace-save-footer"><SaveIndicator available={storageAvailable} shared={space.kind === 'shared'} cloud={cloudSaveState} />
        <Link to="/" state={cardId ? { focusCardId: cardId } : null} className="text-button">View your timeline<ArrowRight size="0.75rem" /></Link>
      </div>
    </div>
  </main>
}
