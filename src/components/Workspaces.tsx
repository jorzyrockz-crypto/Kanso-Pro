import { ArrowRight, Bell, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, FileText, Landmark, Plus, School, Users, Zap } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Dispatch, ReactNode } from 'react'
import { FOCUS_DATE } from '../data'
import type { ComposerOptions, Destination, EventCard, JourneyAction, JourneyCard, ProjectCard, TaskCard, TimelineItem, TimelineSourceEntry, Workspace } from '../types'
import { calendarDays, formatDate, formatTime, makeId, progress, shiftMonth, shortDate, TYPE_CONFIG } from '../lib/journey'
import { AddChecklistItem, Avatar, EmptyState, ProgressBar, SaveIndicator, TypeIcon } from './Common'
import { NotFoundPage } from './PageHeader'
import { destinationPath, WORKSPACE_PATHS, WORKSPACE_TYPES } from '../lib/navigation'
import { calendarPeriod, monthScene } from '../lib/months'
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
}

function WorkspaceHero({ type, eyebrow, title, children, stat, extra, month }: {
  type: 'event' | 'task' | 'project' | 'note'
  eyebrow: string
  title: string
  children: ReactNode
  stat?: { label: string; value: string | number }
  extra?: ReactNode
  month?: string
}) {
  return <div className={`workspace-hero hero-${type} ${month ? 'month-calendar-hero' : ''}`} style={month ? monthPalette(monthScene(month)) : undefined}>
    {month && <MonthArtwork month={month} side="right" className="month-hero-artwork" />}
    <div className="hero-copy"><div className="hero-eyebrows"><span className="hero-eyebrow"><TypeIcon type={type} size={11} />{eyebrow}</span>{extra}</div>
      <h2>{title}</h2><p>{children}</p>
    </div>
    {stat && <div className="hero-stat"><span>{stat.label}</span><strong>{stat.value}</strong></div>}
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

function entryIncludesDate(entry: CalendarSourceEntry, date: string) {
  return entry.date <= date && (entry.endDate ?? entry.date) >= date
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

function CalendarWorkspace({ cards, calendarSources, cardId, onCompose, onDeleteCard }: WorkspaceProps) {
  const initialCard = cards.find((card) => card.id === cardId)
  const navigate = useNavigate()
  const [query] = useSearchParams()
  const [preview, setPreview] = useState<TimelineItem | null>(null)
  const closePreview = useCallback(() => setPreview(null), [])
  const { month, selectedDate } = calendarPeriod(query, initialCard?.date)
  const monthCards = cards.filter((card) => !card.backlog && card.date.startsWith(month))
  const events = monthCards.filter((card): card is EventCard => card.type === 'event')
  const sourceEntries = calendarSourceEntriesForMonth(calendarSources, month)
  const sourceById = new Map(calendarSources.map((source) => [source.id, source]))
  const agenda: CalendarAgendaItem[] = selectedDate
    ? [...monthCards.filter((card) => card.date === selectedDate), ...sourceEntries.filter((entry) => entryIncludesDate(entry, selectedDate))]
    : [...events, ...sourceEntries]
  const sortedAgenda = [...agenda].sort((first, second) => first.date.localeCompare(second.date) || first.title.localeCompare(second.title))
  const previewItems: TimelineItem[] = sortedAgenda.map((entry) => isCalendarSourceEntry(entry) ? timelineSourcePreview(entry, sourceById.get(entry.sourceId)) : entry)
  const visibleEntryCount = events.length + sourceEntries.length
  const changeMonth = (amount: number) => navigate(`/calendar?month=${shiftMonth(month, amount)}`)
  return <div className="workspace-content calendar-workspace">
    <WorkspaceHero type="event" month={month} eyebrow="Connected Calendar View" title={`${formatDate(`${month}-01`, { month: 'long', year: 'numeric' })} Schedule`}
      stat={{ label: visibleEntryCount === 1 ? 'Entry this month' : 'Entries this month', value: visibleEntryCount }}>
      Your personal plans and any calendar sources you choose to show.
    </WorkspaceHero>
    <section className="workspace-panel calendar-panel" aria-label="Monthly calendar">
      <div className="panel-heading calendar-toolbar"><h3>{formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}</h3>
        <div className="calendar-controls"><button className="text-button" onClick={() => navigate(`/calendar?date=${FOCUS_DATE}`)}>Focus date</button>
          <button className="icon-button" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size="1.0625rem" /></button>
          <button className="icon-button" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size="1.0625rem" /></button></div></div>
      <div className="calendar-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day} className="calendar-weekday">{day}</span>)}
        {calendarDays(month).map((date, index) => {
          if (!date) return <span key={`blank-${index}`} className="calendar-blank" />
          const dateCards = monthCards.filter((card) => card.date === date)
          const dateSourceEntries = sourceEntries.filter((entry) => entryIncludesDate(entry, date))
          const labels = [
            dateCards.length ? `${dateCards.length} personal ${dateCards.length === 1 ? 'card' : 'cards'}` : '',
            dateSourceEntries.length ? `${dateSourceEntries.length} calendar-source ${dateSourceEntries.length === 1 ? 'entry' : 'entries'}` : '',
          ].filter(Boolean).join(', ') || 'no entries'
          return <button key={date} className={`calendar-day ${selectedDate === date ? 'is-selected' : ''} ${date === FOCUS_DATE ? 'is-today' : ''}`}
            onClick={() => navigate(`/calendar?date=${date}`)} aria-pressed={selectedDate === date}
            aria-label={`${formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}, ${labels}`}>
            <span>{Number(date.slice(8))}</span><span className="calendar-dots">{[...new Set(dateCards.map((card) => card.type))].map((type) => <i key={type} className={`calendar-dot dot-${type}`} />)}{dateSourceEntries.length > 0 && <i className="calendar-dot dot-source" />}</span>
          </button>
        })}
      </div>
      <div className="calendar-legend">{(['event', 'task', 'project', 'note'] as const).map((type) => <span key={type}><i className={`calendar-dot dot-${type}`} />{TYPE_CONFIG[type].shortLabel}</span>)}{sourceEntries.length > 0 && <span><i className="calendar-dot dot-source" />Calendar source</span>}</div>
    </section>
    <section className="workspace-panel agenda-panel">
      <div className="panel-heading"><h3>{selectedDate ? `${shortDate(selectedDate)} · Connected agenda` : 'Connected calendar details'}</h3>
        {selectedDate && <button className="text-button" onClick={() => navigate(`/calendar?month=${month}`)}>All entries</button>}</div>
      {sortedAgenda.length ? <div className="agenda-list">{sortedAgenda.map((entry) => isCalendarSourceEntry(entry)
        ? <CalendarSourceEvent key={entry.id} entry={entry} source={sourceById.get(entry.sourceId)} onPreview={() => setPreview(timelineSourcePreview(entry, sourceById.get(entry.sourceId)))} />
        : entry.type === 'event'
          ? <CalendarEvent key={entry.id} card={entry} highlighted={entry.id === cardId} onPreview={() => setPreview(entry)} />
          : <button key={entry.id} type="button" className={`agenda-item agenda-item-${entry.type}`} onClick={() => setPreview(entry)} aria-label={`Preview ${entry.title || 'Untitled reflection'} details`}>
            <span className="agenda-item-icon"><TypeIcon type={entry.type} size={19} /></span><span><small>{TYPE_CONFIG[entry.type].label}</small><strong>{entry.title || 'Untitled reflection'}</strong></span><ChevronRight size="0.9375rem" aria-hidden="true" />
          </button>)}</div>
        : <EmptyState title="A little breathing room" action={<button className="button button-soft" onClick={() => onCompose({ type: 'event', date: selectedDate ?? `${month}-01` })}><Plus size="0.8125rem" />Plan something</button>}>No personal cards or enabled source entries here yet. An open day has its own possibilities.</EmptyState>}
      {sortedAgenda.length > 0 && <button className="text-button agenda-add" onClick={() => onCompose({ type: 'event', date: selectedDate ?? `${month}-14` })}><Plus size="0.8125rem" />Add a personal event</button>}
    </section>
    <TimelineCardPreview item={preview} items={previewItems} onItemChange={(item) => setPreview(item)} onClose={closePreview} onDeleteCard={onDeleteCard} />
  </div>
}

function TaskWorkspace({ cards, cardId, dispatch, onCompose, onNavigate, onDeleteCard }: WorkspaceProps) {
  const tasks = cards.filter((card): card is TaskCard => card.type === 'task')
  const activeId = cardId ?? 'task-grades'
  const selected = tasks.find((card) => card.id === activeId) ?? tasks[0]
  if (!selected) return <EmptyState title="Small steps start here" action={<button className="button button-dark" onClick={() => onCompose({ type: 'task' })}><Plus size="0.875rem" />Create a task list</button>}>Create a date-specific task list, then add the immediate actions that move it forward.</EmptyState>
  const { done, total, percent } = progress(selected.subtasks)
  return <div className="workspace-content task-workspace">
    <WorkspaceHero type="task" eyebrow="Task lists · immediate action" title="Focus for this day" stat={{ label: 'Completion', value: `${percent}%` }}>
      Keep related, date-specific actions together. Add a reminder when the timing matters.
    </WorkspaceHero>
    <div className="workspace-selector"><label htmlFor="task-list-select">Your task list</label><select id="task-list-select" value={selected.id} onChange={(event) => onNavigate({ page: 'tasks', cardId: event.target.value })}>
      {tasks.map((card) => <option key={card.id} value={card.id}>{card.title}</option>)}
    </select></div>
    <div className="workspace-desktop-split">
      <section className="workspace-panel checklist-panel">
        <div className="checklist-heading"><div><span className="eyebrow">{formatDate(selected.date, { weekday: 'long', month: 'short', day: 'numeric' })}</span><h3>{selected.title}</h3></div>
          {selected.reminder && <span className="reminder-pill"><Bell size="0.75rem" />{formatTime(selected.reminder)} reminder</span>}</div>
        <div className="task-card-actions"><Link className="button button-soft" to={`/new?edit=${encodeURIComponent(selected.id)}`} state={{ from: destinationPath({ page: 'tasks', cardId: selected.id }) }}>Edit task list</Link><CardDeleteAction card={selected} onDelete={(card) => { onDeleteCard(card); onNavigate({ page: 'tasks' }) }} /></div>
        <div className="checklist-progress"><ProgressBar value={percent} label="Task list completion" /><span>{done} of {total} completed</span></div>
        <div className="workspace-checklist">{selected.subtasks.map((item) => <label key={item.id} className={`workspace-check task-check ${item.done ? 'is-done' : ''}`}>
          <input type="checkbox" checked={item.done} onChange={() => dispatch({ type: 'toggle-item', cardId: selected.id, itemId: item.id })} />
          <span className="check-copy"><strong>{item.title}</strong><small>{item.done ? 'Complete. A little more room to breathe.' : 'Connected to your timeline task list'}</small></span>
          {item.label && <span className="check-label">{item.done ? <Check size="0.75rem" /> : <Clock3 size="0.6875rem" />}{item.label}</span>}
        </label>)}</div>
        {!total && <p className="inline-empty">No items yet. Add the first one below.</p>}
        <AddChecklistItem key={selected.id} placeholder="Add a checklist item…" label="Add item" onAdd={(title) => dispatch({ type: 'add-item', cardId: selected.id, item: { id: makeId('task'), title, done: false } })} />
      </section>
      <aside className="workspace-desktop-aside task-workspace-aside" aria-label="Task list context">
        <section className="workspace-insight-card task-insight-card"><span className="eyebrow"><TypeIcon type="task" size={11} />Task-list plan</span><h3>At a glance</h3><dl className="workspace-insight-list"><div><dt>Planned for</dt><dd>{formatDate(selected.date, { weekday: 'short', month: 'short', day: 'numeric' })}</dd></div><div><dt>Reminder</dt><dd>{selected.reminder ? formatTime(selected.reminder) : 'No reminder'}</dd></div><div><dt>Actions left</dt><dd>{total - done} of {total}</dd></div></dl></section>
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

function ProjectWorkspace({ cards, cardId, dispatch, onCompose, onNavigate, onDeleteCard }: WorkspaceProps) {
  const projects = cards.filter((card): card is ProjectCard => card.type === 'project')
  const activeId = cardId ?? 'proj-tos'
  const selected = projects.find((card) => card.id === activeId) ?? projects[0]
  if (!selected) return <EmptyState icon={<Zap size="1.5rem" />} title="Turn a bigger outcome into milestones" action={<button className="button button-dark" onClick={() => onCompose({ type: 'project' })}><Plus size="0.875rem" />Start a project</button>}>Set a start and due date, then build the milestones and collaborators around it.</EmptyState>
  const { done, total, percent } = progress(selected.subtasks)
  const nextMilestone = selected.subtasks.find((item) => !item.done)
  const dueStatus = projectDueStatus(selected.dueDate)
  return <div className="workspace-content project-workspace">
    <WorkspaceHero type="project" eyebrow="Projects · outcomes over time" title={selected.title} stat={{ label: 'Project progress', value: `${percent}%` }}
      extra={<span className="hero-date">Due {shortDate(selected.dueDate)}</span>}>
      {selected.context || 'Guide a larger outcome from its start date to its due date with milestones and collaborators.'}
    </WorkspaceHero>
    {projects.length > 1 && <div className="workspace-selector"><label htmlFor="project-select">Project workspace</label><select id="project-select" value={selected.id} onChange={(event) => onNavigate({ page: 'project', cardId: event.target.value })}>
      {projects.map((card) => <option key={card.id} value={card.id}>{card.title}</option>)}
    </select></div>}
    <section className="project-pulse" aria-label="Project pulse"><div><span className="eyebrow"><Zap size={11} />Next milestone</span><strong>{nextMilestone?.title ?? (total ? 'All milestones are complete' : 'Add your first milestone')}</strong><p>{nextMilestone?.assignee ? `Owned by ${nextMilestone.assignee}` : nextMilestone ? 'Keep the next meaningful step visible.' : 'A clear next step makes the project easier to move forward.'}</p></div><span className={`project-due-status ${dueStatus.tone}`}><Clock3 size=".8125rem" />{dueStatus.text}</span></section>
    <div className="workspace-desktop-split">
      <section className="workspace-panel checklist-panel">
        <div className="panel-heading project-milestone-heading"><div><h3>Milestones & deliverables</h3><span className="count-label">{done} / {total} complete</span></div><div className="project-card-actions"><Link className="button button-soft" to={`/new?edit=${encodeURIComponent(selected.id)}`} state={{ from: destinationPath({ page: 'project', cardId: selected.id }) }}>Edit project</Link><CardDeleteAction card={selected} onDelete={() => { onDeleteCard(selected); onNavigate({ page: 'project' }) }} /></div></div>
        <ProgressBar value={percent} label="Project completion" />
        <div className="workspace-checklist">{selected.subtasks.map((item, index) => <label key={item.id} className={`workspace-check project-check ${item.done ? 'is-done' : ''}`}>
          <input type="checkbox" checked={item.done} onChange={() => dispatch({ type: 'toggle-item', cardId: selected.id, itemId: item.id })} />
          <span className="check-copy"><strong>{index + 1}. {item.title}</strong><small>{item.assignee ? `Assigned to: ${item.assignee} · ` : ''}{item.done ? 'Completed' : 'To do'}</small></span>
          {item.label && <span className="check-label">{item.label}</span>}
        </label>)}</div>
        {!total && <p className="inline-empty">Every project starts with one small step. Add a milestone below.</p>}
        <AddChecklistItem key={selected.id} placeholder="Add a project milestone…" label="Add milestone" onAdd={(title) => dispatch({ type: 'add-item', cardId: selected.id, item: { id: makeId('milestone'), title, done: false, assignee: 'You' } })} />
      </section>
      <aside className="workspace-desktop-aside project-workspace-aside" aria-label="Project context">
        <section className="workspace-insight-card project-insight-card"><span className="eyebrow"><Zap size={11} />Project plan</span><h3>At a glance</h3><dl className="workspace-insight-list"><div><dt>Started</dt><dd>{shortDate(selected.date)}</dd></div><div><dt>Due</dt><dd>{shortDate(selected.dueDate)}</dd></div><div><dt>Progress</dt><dd>{percent}% · {done} of {total}</dd></div><div><dt>Next up</dt><dd>{nextMilestone?.title ?? 'Complete'}</dd></div></dl></section>
        <div className="team-panel"><span className="eyebrow"><Users size="0.8125rem" />Planning team</span><div className="team-members">{selected.team.map((name) => <span className="person-pill" key={name}><Avatar name={name} />{name}</span>)}</div></div>
        <p className="workspace-fineprint"><Users size="0.75rem" />Team names are planning references. This workspace is stored on your device.</p>
      </aside>
    </div>
  </div>
}

export function WorkspacePage({ page, cards, calendarSources, dispatch, onNavigate, onCompose, onDeleteCard, storageAvailable, journalUserId }: {
  page: Workspace
  cards: JourneyCard[]
  calendarSources: CalendarSource[]
  dispatch: Dispatch<JourneyAction>
  onNavigate: (destination: Destination) => void
  onCompose: (options?: ComposerOptions) => void
  onDeleteCard: (card: JourneyCard) => void
  storageAvailable: boolean
  journalUserId: string | null
}) {
  const { cardId } = useParams()
  const selected = cards.find((card) => card.id === cardId && card.type === WORKSPACE_TYPES[page])
  if (cardId && !selected) return <NotFoundPage card backTo={WORKSPACE_PATHS[page]} />
  const props = { cards, calendarSources, cardId, dispatch, onCompose, onNavigate, onDeleteCard }

  return <main id="main-content" tabIndex={-1} className={`workspace-page workspace-${page}`} aria-label={workspaceNames[page]}>
    <div className="workspace-body" key={`${page}-${cardId ?? 'default'}`}>
      {page === 'calendar' && <CalendarWorkspace {...props} />}
      {page === 'tasks' && <TaskWorkspace {...props} />}
      {page === 'project' && <ProjectWorkspace {...props} />}
      {page === 'journal' && <JournalWorkspace {...props} storageAvailable={storageAvailable} firestoreUserId={journalUserId} />}
      <div className="workspace-save-footer"><SaveIndicator available={storageAvailable} />
        <Link to="/" state={cardId ? { focusCardId: cardId } : null} className="text-button">View your timeline<ArrowRight size="0.75rem" /></Link>
      </div>
    </div>
  </main>
}
