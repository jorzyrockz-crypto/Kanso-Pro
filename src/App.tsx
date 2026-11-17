import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, Check, CheckSquare, ChevronDown, Clock3, Eye, EyeOff, Landmark, Pin, ThumbsUp, X } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useMatch, useNavigate, useNavigationType } from 'react-router-dom'
import type { ComposerOptions, Destination, EventCard, Filter, JournalAttachment, JourneyCard, ProjectCard, SpaceNotice, TaskCard, TimelineSourceEntry, Workspace } from './types'
import { buildTimeline, formatDate, rolloverCandidates, shiftMonth } from './lib/journey'
import { composerOptions, composerPath, destinationPath, pageForPath, WORKSPACE_PATHS, WORKSPACE_TYPES } from './lib/navigation'
import { useSpaces } from './lib/useSpaces'
import { cardAssignedTo } from './lib/spaces'
import { useWorkspaceSync } from './lib/useWorkspaceSync'
import { useSpacePresence } from './lib/useSpacePresence'
import { useActivityUnread } from './lib/useActivityUnread'
import { removeJournalAttachment } from './lib/journalAttachments'
import { googleSyncUser } from './lib/workspaceSync'
import { calendarSourceEntriesForMonths, useCalendarSources } from './lib/calendarSources'
import type { CalendarSource } from './lib/calendarSources'
import { DEPED_SY_2026_2027_ENTRIES } from './data/depedSchoolCalendar2026'
import { DEPED_LEGISLATED_ACTIVITY_RULES } from './data/depedLegislatedActivities'
import { useAccount } from './lib/useAccount'
import { useAppearance } from './lib/useAppearance'
import { usePwa } from './lib/usePwa'
import { useNotifications } from './lib/useNotifications'
import { confirmNotificationNavigation, safeNotificationPath } from './lib/notifications'
import { updateSurface } from './lib/updates'
import { NotificationsPage } from './components/NotificationsPage'
import { UpdateChrome, WhatsNewPage } from './components/AppUpdates'
import { AboutUpdatesDialog } from './components/AboutUpdatesDialog'
import { accountError } from './lib/account'
import { SettingsPage } from './components/SettingsPage'
import { AccountPage } from './components/AccountPage'
import { SignInHeader } from './components/SignInPage'
import { calendarPeriod, monthAtPosition, monthRange } from './lib/months'
import { MonthBackdrop } from './components/MonthArtwork'
import { Timeline } from './components/Timeline'
import { Composer } from './components/Composer'
import { WorkspacePage } from './components/Workspaces'
import { AppHeader } from './components/AppHeader'
import { AppSplash } from './components/AppSplash'
import { BottomNavigation } from './components/BottomNavigation'
import { AppFooter, NotFoundPage, PageHeader } from './components/PageHeader'
import { RouteEffects } from './components/RouteEffects'
import { TeamScopeToggle } from './components/Common'
import type { CloudSaveState } from './components/Common'

const filters: { type: Filter; label: string }[] = [
  { type: 'all', label: 'All Stream' }, { type: 'event', label: 'Events' },
  { type: 'task', label: 'Tasks' }, { type: 'project', label: 'Projects' },
  { type: 'note', label: 'Journal Notes' },
]

const TIMELINE_MONTH_STEP = 1
const TIMELINE_MIN_MONTH = '1900-01'
const TIMELINE_MAX_MONTH = '9999-12'

type TimelineWindow = { start: string; end: string }

function currentLocalDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function presenceStatus(pathname: string) {
  const page = pageForPath(pathname).page
  if (page === 'calendar') return 'Reviewing the calendar'
  if (page === 'tasks') return 'Working through tasks'
  if (page === 'project') return 'Reviewing project milestones'
  if (page === 'journal') return 'Writing in Space Notes'
  return 'Reviewing the Journey Stream'
}

function timelineWindowFor(cards: JourneyCard[]): TimelineWindow {
  const months = [...cards.map((card) => card.date.slice(0, 7)), currentLocalDate().slice(0, 7)].sort()
  return { start: months[0], end: months.at(-1)! }
}

function cardOnDate(cards: JourneyCard[], date: string) {
  return cards.find((card) => card.date === date && !card.quiet && !card.backlog)
    ?? cards.find((card) => card.type === 'project' && card.dueDate === date && !card.backlog)
}

function extendTimelineWindow(window: TimelineWindow, direction: 'past' | 'future'): TimelineWindow {
  if (direction === 'past') return window.start === TIMELINE_MIN_MONTH
    ? window
    : { ...window, start: window.start <= '1900-12' ? TIMELINE_MIN_MONTH : shiftMonth(window.start, -TIMELINE_MONTH_STEP) }
  return window.end === TIMELINE_MAX_MONTH
    ? window
    : { ...window, end: window.end >= '9999-01' ? TIMELINE_MAX_MONTH : shiftMonth(window.end, TIMELINE_MONTH_STEP) }
}

function JumpToToday({ direction, onJump }: { direction: 'up' | 'down'; onJump: () => void }) {
  return <button type="button" className={`button button-jump-today timeline-jump-today is-${direction}`} onClick={onJump} title={`Jump ${direction} to today`} aria-label="Jump to Today">
    {direction === 'up' ? <ArrowUp size="0.875rem" aria-hidden="true" /> : <ArrowDown size="0.875rem" aria-hidden="true" />}<span>Jump to Today</span>
  </button>
}

function StreamMenu({ children, className, icon, label, open, onOpenChange, summary }: {
  children: ReactNode
  className: string
  icon?: ReactNode
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
  summary: ReactNode
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const close = (returnFocus = false) => {
    onOpenChange(false)
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) close(false)
    }
    const focusOutside = (event: FocusEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) close(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(true) }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', focusOutside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', focusOutside)
      document.removeEventListener('keydown', escape)
    }
  }, [open, onOpenChange])

  return <div className={`stream-dropdown ${className}`} ref={rootRef}>
    <button ref={triggerRef} type="button" className="stream-dropdown-trigger" aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId} onClick={() => onOpenChange(!open)}>
      <span className="stream-dropdown-trigger-copy">{icon}{summary}</span><ChevronDown size=".875rem" aria-hidden="true" />
    </button>
    {open && <section id={panelId} className="stream-dropdown-panel" role="dialog" aria-label={label}>{children}</section>}
  </div>
}

function sourceSummary(source: CalendarSource) {
  return source.recurringRules
    ? `${source.recurringRules.length} annual observances`
    : `${source.entries.length} dated ${source.entries.length === 1 ? 'entry' : 'entries'}`
}

function StreamHeader({ calendarSources, count, filter, scope, memberName, shared, cloudSyncEnabled, month, onFilter, onScopeChange, onSourceEnabled, onSpaceNotice, canManageNotice, hasNotice }: {
  calendarSources: CalendarSource[]
  count: number
  filter: Filter
  scope: 'all' | 'assigned'
  memberName: string
  shared: boolean
  cloudSyncEnabled: boolean
  month: string
  onFilter: (type: Filter) => void
  onScopeChange: (scope: 'all' | 'assigned') => void
  onSourceEnabled: (sourceId: string, enabled: boolean) => void
  onSpaceNotice: (body: string) => void
  canManageNotice: boolean
  hasNotice: boolean
}) {
  const [openMenu, setOpenMenu] = useState<'filter' | 'sources' | null>(null)
  const [spaceUpdateOpen, setSpaceUpdateOpen] = useState(false)
  const [spaceUpdate, setSpaceUpdate] = useState('')
  const [condensed, setCondensed] = useState(false)
  const scrollBeforeCompact = useRef<number | null>(null)
  const activeFilter = filters.find((item) => item.type === filter)!
  useEffect(() => {
    const update = () => {
      const next = window.scrollY > 80
      setCondensed((current) => {
        if (current === next) return current
        // Compact chrome should never nudge the reading position when its height changes.
        scrollBeforeCompact.current = window.scrollY
        return next
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  useLayoutEffect(() => {
    const position = scrollBeforeCompact.current
    if (position === null) return
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: position, behavior: 'instant' })
      scrollBeforeCompact.current = null
    })
    return () => cancelAnimationFrame(frame)
  }, [condensed])
  const shownSources = calendarSources.filter((source) => source.enabled).length
  const submitSpaceNotice = (event: FormEvent) => {
    event.preventDefault()
    if (!spaceUpdate.trim()) return
    onSpaceNotice(spaceUpdate.trim())
    setSpaceUpdate('')
    setSpaceUpdateOpen(false)
  }

  return <header className={`stream-header ${condensed && !openMenu ? 'is-condensed' : ''}`}>
    <div className="header-main">
      <div className="header-identity">
        <div className="month-icon" aria-label={formatDate(month, { month: 'long', year: 'numeric' })}>
          <span>{formatDate(month, { month: 'short' })}</span><strong>{formatDate(month, { year: 'numeric' })}</strong>
        </div>
        <div className="header-copy">
          <div className="header-title-line"><h1 id="page-title">Journey Stream</h1><span className="live-badge" title={shared ? cloudSyncEnabled ? 'This Space can sync through your Google-authenticated session.' : 'This Space is currently local. Continue with Google to enable online sync.' : 'Your four workspaces stay connected on this device'}><span className="live-dot" /><span className="live-text">{shared ? cloudSyncEnabled ? 'Google Sync' : 'Local Space' : 'Live Flow'}</span></span></div>
          <p>Your plans, progress, and reflections. All in one flow.</p>
        </div>
      </div>
    </div>
    <div className="header-bottom">
      <div className="stream-controls">
        <nav className="filter-bar" aria-label="Filter journey cards">{filters.map(({ type, label }) => <button key={type} className={`filter-pill ${filter === type ? 'is-active' : ''}`} onClick={() => onFilter(type)} aria-pressed={filter === type}>
          {type !== 'all' && <span className={`filter-dot dot-${type}`} />}<span>{label}</span>{type === 'all' && <span className="filter-count">{count}</span>}
        </button>)}</nav>
        <StreamMenu className="stream-filter-menu" label={`Filter journey cards: ${activeFilter.label}`} open={openMenu === 'filter'} onOpenChange={(open) => setOpenMenu(open ? 'filter' : null)} summary={<>{activeFilter.label}{filter === 'all' && <span className="stream-dropdown-count">{count}</span>}</>}>
          <div className="stream-dropdown-list" role="listbox" aria-label="Filter journey cards">
            {filters.map(({ type, label }) => <button key={type} type="button" role="option" aria-selected={filter === type} className={filter === type ? 'is-selected' : ''} onClick={() => { onFilter(type); setOpenMenu(null) }}>{type !== 'all' && <span className={`filter-dot dot-${type}`} aria-hidden="true" />}<span>{label}</span>{type === 'all' && <span className="stream-dropdown-option-count">{count}</span>}{filter === type && <Check size=".875rem" aria-hidden="true" />}</button>)}
          </div>
        </StreamMenu>
        <TeamScopeToggle scope={scope} memberName={memberName} onChange={onScopeChange} compact />
        {shared && <div className="space-update-control"><button type="button" className="space-update-trigger" disabled={!canManageNotice} title={canManageNotice ? 'Post or replace the pinned Space notice' : 'Only the Space Owner or a designated Lead can manage the pinned notice'} aria-expanded={spaceUpdateOpen} onClick={() => setSpaceUpdateOpen((open) => !open)}>{hasNotice ? 'Edit notice' : 'Pinned notice'}</button>{spaceUpdateOpen && <form className="space-update-form" onSubmit={submitSpaceNotice}><label className="sr-only" htmlFor="space-update">{hasNotice ? 'Replace the pinned Space notice' : 'Post a pinned Space notice'}</label><input id="space-update" autoFocus maxLength={360} value={spaceUpdate} onChange={(event) => setSpaceUpdate(event.target.value)} placeholder="Share one concise notice…" /><button type="submit" className="button button-accent">{hasNotice ? 'Replace' : 'Post'}</button></form>}</div>}
        <div className="stream-reference-controls">
          <StreamMenu className="stream-sources-menu" label={`Calendar sources, ${shownSources} shown`} icon={<Landmark size=".8125rem" aria-hidden="true" />} open={openMenu === 'sources'} onOpenChange={(open) => setOpenMenu(open ? 'sources' : null)} summary={<><span className="source-summary-label">Calendar sources</span><span className="source-summary-label-compact">Sources</span><span className="stream-dropdown-count">{shownSources} <span className="source-summary-shown">shown</span></span></>}>
            <div className="stream-sources-heading"><strong>Calendar sources</strong><span>Choose what appears as reference-only entries.</span></div>
            <div className="stream-sources-list" role="group" aria-label="Calendar sources">
              {calendarSources.map((source) => <button key={source.id} type="button" role="checkbox" aria-checked={source.enabled} aria-label={`${source.enabled ? 'Hide' : 'Show'} ${source.label} in Calendar and Timeline`} className={source.enabled ? 'is-shown' : ''} onClick={() => onSourceEnabled(source.id, !source.enabled)}>
                <span className="stream-source-check" aria-hidden="true">{source.enabled ? <CheckSquare size="1rem" /> : <span />}</span>
                <span className="stream-source-copy"><strong>{source.label}</strong><small>{sourceSummary(source)}</small></span>
                <span className="stream-source-action">{source.enabled ? <><Eye size=".75rem" aria-hidden="true" />Shown</> : <><EyeOff size=".75rem" aria-hidden="true" />Hidden</>}</span>
              </button>)}
            </div>
          </StreamMenu>
        </div>
      </div>
    </div>
  </header>
}

function noticeTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'recently'
  const today = new Date()
  const sameDay = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
  return sameDay ? `Today at ${time}` : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

function PinnedSpaceNotice({ notice, acknowledgementId, canManage, onAcknowledge, onClear }: {
  notice: SpaceNotice
  acknowledgementId: string
  canManage: boolean
  onAcknowledge: () => void
  onClear: () => void
}) {
  const storageKey = `kanso-pro:space-notice:${notice.id}:${acknowledgementId}:collapsed`
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'true' } catch { return false }
  })
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(storageKey) === 'true') } catch { setCollapsed(false) }
  }, [storageKey])
  const toggle = () => {
    setCollapsed((value) => {
      const next = !value
      try { localStorage.setItem(storageKey, String(next)) } catch { /* Local display preference is optional. */ }
      return next
    })
  }
  const acknowledged = notice.acknowledgements.includes(acknowledgementId)
  const count = notice.acknowledgements.length
  if (collapsed) return <section className="pinned-space-notice is-collapsed" aria-label="Pinned Space Notice">
    <span className="pinned-space-notice-label"><Pin size=".75rem" aria-hidden="true" />Pinned Space Notice</span><span className="pinned-space-notice-count">{count ? `${count} acknowledged` : 'New'}</span><button type="button" className="text-button pinned-space-notice-toggle" onClick={toggle}>Show</button>
  </section>
  return <section className="pinned-space-notice" aria-label="Pinned Space Notice">
    <div className="pinned-space-notice-icon"><Pin size=".9375rem" aria-hidden="true" /></div>
    <div className="pinned-space-notice-copy"><div className="pinned-space-notice-heading"><span>Pinned Space Notice</span><small>Pinned by {notice.postedBy} · {noticeTimestamp(notice.postedAt)}</small></div><p>{notice.body}</p><div className="pinned-space-notice-actions"><button type="button" className={`button button-soft pinned-space-notice-ack${acknowledged ? ' is-acknowledged' : ''}`} aria-pressed={acknowledged} disabled={acknowledged} onClick={onAcknowledge}><ThumbsUp size=".75rem" />{acknowledged ? 'Got it' : 'Got it'}</button><span>{count ? `${count} acknowledged` : 'Be the first to acknowledge'}</span>{canManage && <button type="button" className="text-button pinned-space-notice-clear" onClick={onClear}>Clear</button>}</div></div>
    <button type="button" className="icon-button pinned-space-notice-dismiss" aria-label="Minimize pinned Space notice" title="Minimize" onClick={toggle}><X size=".8125rem" aria-hidden="true" /></button>
  </section>
}

function NewCardPage({ cards, members, canEdit, onCancel, onCreate, onUpdate }: {
  cards: JourneyCard[]
  members: string[]
  canEdit: boolean
  onCancel: () => void
  onCreate: (card: JourneyCard) => void
  onUpdate: (card: EventCard | TaskCard | ProjectCard) => void
}) {
  const location = useLocation()
  const editId = new URLSearchParams(location.search).get('edit')
  const candidate = editId ? cards.find((card) => card.id === editId) : undefined
  const editingCard = candidate?.type === 'event' || candidate?.type === 'task' || candidate?.type === 'project' ? candidate : undefined
  if (editId && !editingCard) return <main id="main-content" tabIndex={-1} className="create-page" aria-label="Card not found"><NotFoundPage card backTo="/" /></main>
  if (!canEdit) return <main id="main-content" tabIndex={-1} className="create-page" aria-labelledby="page-title"><PageHeader title="View-only Space" description="You can follow shared work here, but an Owner needs to grant you Editor access before you can create or change plans." /><button className="text-button return-to-page" onClick={onCancel}><ArrowLeft size=".8125rem" />Back to your workspace</button></main>
  const typeLabel = editingCard?.type === 'event' ? 'Event' : editingCard?.type === 'task' ? 'Task list' : editingCard?.type === 'project' ? 'Project' : 'card'
  return <main id="main-content" tabIndex={-1} className="create-page" aria-labelledby="page-title">
    <PageHeader title={editingCard ? `Edit ${typeLabel}` : 'New card'} description={editingCard ? 'Update the details that keep this card useful across your planning space.' : 'An event, a small step, a bigger idea, or a thought worth keeping.'} />
    <button className="text-button return-to-page" onClick={onCancel}><ArrowLeft size="0.8125rem" />Back to your workspace</button>
    <Composer key={location.key} options={composerOptions(location.search)} cards={cards} members={members} editingCard={editingCard} onCancel={onCancel} onCreate={onCreate} onUpdate={onUpdate} />
  </main>
}

export default function App() {
  const account = useAccount()
  const spaces = useSpaces(account.user)
  const { workspace: state, dispatch, space, member, members, activity: teamActivity, canEdit, canManageNotice, storageAvailable } = spaces
  const calendarSources = useCalendarSources(DEPED_SY_2026_2027_ENTRIES, DEPED_LEGISLATED_ACTIVITY_RULES)
  const firestoreUserId = googleSyncUser(account.user)
  const workspaceSync = useWorkspaceSync(account.user, state, dispatch, space, spaces.hydrateMembers, spaces.hydrateSpace, teamActivity, spaces.hydrateActivity, spaces.hydratePresence)
  const appearance = useAppearance()
  const pwa = usePwa()
  const cloudSaveState: CloudSaveState = !workspaceSync.enabled
    ? 'local-only'
    : !pwa.online
      ? 'offline'
      : workspaceSync.unavailable
        ? 'unavailable'
        : workspaceSync.ready ? 'synced' : 'connecting'
  const notifications = useNotifications(state.cards)
  const location = useLocation()
  const unreadActivity = useActivityUnread(space.id, teamActivity, member.name, location.pathname)
  useSpacePresence(account.user, space, member, pwa.online, presenceStatus(location.pathname))
  const navigate = useNavigate()
  const navigationType = useNavigationType()
  const calendarMatch = useMatch('/calendar/:cardId?')
  const accountMatch = useMatch('/account')
  const signInMatch = useMatch('/sign-in')
  const signInLayout = !!(accountMatch || signInMatch) && !account.user
  const [visibleTimelineMonth, setVisibleTimelineMonth] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [teamScope, setTeamScope] = useState<'all' | 'assigned'>('all')
  const [openGaps, setOpenGaps] = useState<string[]>([])
  const [aboutUpdatesOpen, setAboutUpdatesOpen] = useState(false)
  const [aboutUpdatesAfterUpdate, setAboutUpdatesAfterUpdate] = useState(false)
  const [toast, setToast] = useState<{ message: string; id: number; kind?: 'error'; href?: string; label?: string; action?: 'update'; notificationId?: string } | null>(null)
  const announcedUpdate = useRef('')
  const shownUpdatedRelease = useRef('')
  const knownTeamActivity = useRef(new Map<string, Set<string>>())
  useEffect(() => { setTeamScope('all') }, [space.id])
  useEffect(() => {
    const query = new URLSearchParams(location.search)
    const joinCode = query.get('join')
    if (!joinCode) return
    const invitedSpaceId = query.get('space')
    if (invitedSpaceId) spaces.joinByInvite(invitedSpaceId, joinCode)
    else spaces.joinByCode(joinCode)
    query.delete('join')
    query.delete('space')
    navigate(`${location.pathname}${query.size ? `?${query}` : ''}`, { replace: true })
  }, [location.pathname, location.search, navigate, spaces.joinByCode, spaces.joinByInvite])
  useEffect(() => {
    if (notifications.announcement) setToast({ ...notifications.announcement, id: Date.now(), label: 'View' })
  }, [notifications.announcement])
  useEffect(() => {
    const known = knownTeamActivity.current.get(space.id)
    if (!known) {
      knownTeamActivity.current.set(space.id, new Set(teamActivity.map((entry) => entry.id)))
      return
    }
    for (const entry of teamActivity) {
      if (known.has(entry.id)) continue
      known.add(entry.id)
      if (entry.actor === member.name || (entry.target && entry.target !== member.name)) continue
      notifications.addCollaboration(space.id, entry)
    }
  }, [teamActivity, space.id, member.name, notifications.addCollaboration])
  useEffect(() => {
    if (!pwa.updatedNotice || shownUpdatedRelease.current === pwa.updatedNotice) return
    // A completed update deserves a calm arrival, not a transient toast. Return to the
    // timeline first so the release card always sits over the person’s planning context.
    if (location.pathname !== '/') {
      navigate('/', { replace: true })
      return
    }
    shownUpdatedRelease.current = pwa.updatedNotice
    setAboutUpdatesAfterUpdate(true)
    setAboutUpdatesOpen(true)
  }, [location.pathname, navigate, pwa.updatedNotice])
  useEffect(() => {
    if (!pwa.updateReady) return
    if (pwa.coarse && account.user) void notifications.addUpdate(pwa.updateVersion, 'Restart from About when you are ready. Your saved plans stay on this device.')
    if (updateSurface(pwa.overlay, pwa.coarse, !!account.user) === 'toast' && !pwa.updateDismissed && announcedUpdate.current !== pwa.updateVersion) {
      announcedUpdate.current = pwa.updateVersion
      setToast({ message: 'A new version of Kanso Pro is ready.', id: Date.now(), action: 'update', label: 'Review' })
    }
  }, [pwa.updateReady, pwa.updateVersion, pwa.overlay, pwa.coarse, pwa.updateDismissed, account.user, notifications.addUpdate])
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const open = (event: MessageEvent) => {
      if (event.data?.type !== 'OPEN_NOTIFICATION' || !safeNotificationPath(event.data.url)) return
      if (!confirmNotificationNavigation()) return
      if (typeof event.data.id === 'string') void notifications.markRead(event.data.id)
      navigate(event.data.url)
    }
    navigator.serviceWorker.addEventListener('message', open)
    return () => navigator.serviceWorker.removeEventListener('message', open)
  }, [navigate, notifications.markRead])
  useEffect(() => {
    // A closed-app notification opens a new window. Keep the read receipt in the
    // fragment (never sent to a server) and remove it from the visible/history URL.
    if (!location.hash.startsWith('#notification=') || !safeNotificationPath(location.pathname)) return
    try {
      const id = decodeURIComponent(location.hash.slice('#notification='.length))
      if (id && id.length < 4096) void notifications.markRead(id)
    } catch { /* Ignore malformed notification metadata. */ }
    navigate(`${location.pathname}${location.search}`, { replace: true })
  }, [location.pathname, location.search, location.hash, navigate, notifications.markRead])
  const [pendingScroll, setPendingScroll] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const handledFocusKey = useRef<string | null>(null)
  const timelineRef = useRef<HTMLElement>(null)
  const today = currentLocalDate()
  const [jumpDirection, setJumpDirection] = useState<'up' | 'down'>('down')
  const [showJumpToday, setShowJumpToday] = useState(false)
  const [pendingToday, setPendingToday] = useState<string | null>(null)
  // Retired Space-update Notes remain only as inert legacy data; never let them return to
  // the Journey Stream while older cloud documents finish their natural lifecycle.
  const journeyCards = useMemo(() => state.cards.filter((card) => !(card.type === 'note' && card.title === 'Space update' && card.category === 'Space Update' && card.tags.includes('space-update'))), [state.cards])
  const [timelineWindow, setTimelineWindow] = useState<TimelineWindow>(() => timelineWindowFor(journeyCards))
  const cardTimelineWindow = useMemo(() => timelineWindowFor(journeyCards), [journeyCards])
  const timelineMonths = useMemo(() => monthRange(timelineWindow.start, timelineWindow.end), [timelineWindow])
  const timelineSourceEntries = useMemo<TimelineSourceEntry[]>(() => {
    const sourceById = new Map(calendarSources.sources.map((source) => [source.id, source]))
    return calendarSourceEntriesForMonths(calendarSources.sources, timelineMonths).flatMap((entry) => {
      const source = sourceById.get(entry.sourceId)
      if (!source) return []
      return [{
        ...entry,
        sourceLabel: source.shortLabel,
        sourceProvenance: source.provenance,
        side: entry.sourceId === 'deped-legislated-activities' ? 'right' : 'left',
        calendarSource: true,
      }]
    })
  }, [calendarSources.sources, timelineMonths])
  const scopedWorkCards = useMemo(() => teamScope === 'assigned' ? journeyCards.filter((card) => cardAssignedTo(card, member)) : journeyCards, [journeyCards, teamScope, member])
  const timelineCards = useMemo(() => scopedWorkCards.filter((card) => card.date.slice(0, 7) >= timelineWindow.start && card.date.slice(0, 7) <= timelineWindow.end), [scopedWorkCards, timelineWindow])
  const entries = useMemo(() => buildTimeline(timelineCards, filter, timelineSourceEntries), [timelineCards, filter, timelineSourceEntries])
  const overdueCards = useMemo(() => rolloverCandidates(scopedWorkCards, today), [scopedWorkCards, today])
  const defaultMonth = entries.find((entry) => entry.kind === 'day')?.date.slice(0, 7) ?? timelineWindow.start
  const timelineMonth = visibleTimelineMonth && visibleTimelineMonth >= timelineWindow.start && visibleTimelineMonth <= timelineWindow.end ? visibleTimelineMonth : defaultMonth

  useEffect(() => {
    setTimelineWindow((current) => ({
      start: cardTimelineWindow.start < current.start ? cardTimelineWindow.start : current.start,
      end: cardTimelineWindow.end > current.end ? cardTimelineWindow.end : current.end,
    }))
  }, [cardTimelineWindow])
  const calendarCard = state.cards.find((card) => card.type === 'event' && card.id === calendarMatch?.params.cardId)
  const calendarVisible = calendarMatch && (!calendarMatch.params.cardId || calendarCard)
  const { month: calendarMonth } = calendarPeriod(new URLSearchParams(location.search), calendarCard?.date)

  useEffect(() => {
    const timeline = timelineRef.current
    if (!timeline || location.pathname !== '/') return
    // Cache just the first row of each month; avoid measuring every card on scroll.
    const monthRows = Array.from(timeline.querySelectorAll<HTMLElement>('[data-timeline-month]'))
      .filter((row, index, rows) => row.dataset.timelineMonth !== rows[index - 1]?.dataset.timelineMonth)
    let frame = 0
    const update = () => {
      frame = 0
      const bounds = timeline.getBoundingClientRect()
      const value = Math.min(100, Math.max(22, ((window.innerHeight * 0.7 - bounds.top) / bounds.height) * 100))
      timeline.style.setProperty('--scroll-progress', `${value}%`)
      const headerBottom = document.querySelector('.stream-header')?.getBoundingClientRect().bottom ?? 0
      // CSS owns the layout query; a side rail must not shorten the reading viewport.
      const sidebar = getComputedStyle(document.documentElement).getPropertyValue('--navigation-layout').trim() === 'sidebar'
      const navTop = sidebar ? window.innerHeight : document.querySelector('.bottom-bar')?.getBoundingClientRect().top ?? window.innerHeight
      const anchor = headerBottom + Math.max(0, navTop - headerBottom) * .5
      const markers = monthRows.map((row) => ({ month: row.dataset.timelineMonth!, top: row.getBoundingClientRect().top }))
      const atEnd = window.scrollY > 1 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
      setVisibleTimelineMonth(window.scrollY <= 1 ? defaultMonth : monthAtPosition(markers, anchor, defaultMonth, atEnd))
    }
    const requestUpdate = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    const observer = new ResizeObserver(requestUpdate)
    observer.observe(timeline)
    const navigation = document.querySelector('.bottom-bar')
    if (navigation) observer.observe(navigation)
    return () => {
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [location.pathname, entries, defaultMonth])

  useEffect(() => {
    if (location.pathname !== '/') return
    let frame = 0
    const updateJumpControl = () => {
      frame = 0
      const todayNode = document.querySelector<HTMLElement>(`.date-node[data-date="${today}"]`)
      const fallbackMonth = document.querySelector<HTMLElement>(`.month-marker[data-timeline-month="${today.slice(0, 7)}"]`)
      const target = todayNode ?? fallbackMonth
      const headerBottom = document.querySelector('.stream-header')?.getBoundingClientRect().bottom ?? 0
      const sidebar = getComputedStyle(document.documentElement).getPropertyValue('--navigation-layout').trim() === 'sidebar'
      const viewportBottom = sidebar ? window.innerHeight : document.querySelector('.bottom-bar')?.getBoundingClientRect().top ?? window.innerHeight
      const bounds = target?.getBoundingClientRect()
      // A month marker is only a fallback for jumping when today's row is empty. Keep the
      // control available in that case; otherwise it appears only once the actual date node
      // has left the reading viewport.
      const todayIsVisible = !!todayNode && !!bounds && bounds.top >= headerBottom && bounds.bottom <= viewportBottom
      setShowJumpToday((current) => current === !todayIsVisible ? current : !todayIsVisible)
      const nextDirection = bounds && bounds.bottom < headerBottom ? 'up' : 'down'
      setJumpDirection((current) => current === nextDirection ? current : nextDirection)
    }
    const requestUpdate = () => { if (!frame) frame = requestAnimationFrame(updateJumpControl) }
    updateJumpControl()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    return () => {
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      cancelAnimationFrame(frame)
    }
  }, [filter, location.pathname, entries, today])

  useEffect(() => {
    const cardId: unknown = location.state?.focusCardId
    if (navigationType === 'POP' || location.pathname !== '/' || typeof cardId !== 'string' || handledFocusKey.current === location.key) return
    if (!journeyCards.some((card) => card.id === cardId)) return
    handledFocusKey.current = location.key
    setFilter('all')
    const gap = buildTimeline(journeyCards).find((entry) => entry.kind === 'gap' && entry.cards.some((card) => card.id === cardId))
    if (gap?.kind === 'gap') setOpenGaps((current) => [...new Set([...current, `${gap.start}-${gap.end}`])])
    setPendingScroll(cardId)
  }, [location.key, location.pathname, location.state, navigationType, journeyCards])

  useEffect(() => {
    if (!pendingScroll || location.pathname !== '/') return
    const frame = requestAnimationFrame(() => {
      const card = document.getElementById(`card-${pendingScroll}`)
      if (card) {
        card.closest('.journey-row')?.classList.add('is-visible')
        card.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' })
        setHighlightId(pendingScroll)
      }
      setPendingScroll(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [pendingScroll, filter, openGaps, location.pathname, state.cards])

  useEffect(() => {
    if (!pendingToday || location.pathname !== '/') return
    const frame = requestAnimationFrame(() => {
      const node = document.querySelector<HTMLElement>(`.date-node[data-date="${pendingToday}"]`)
      const month = document.querySelector<HTMLElement>(`.month-marker[data-timeline-month="${pendingToday.slice(0, 7)}"]`)
      ;(node ?? month)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: node ? 'center' : 'start' })
      setPendingToday(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [entries, filter, location.pathname, pendingToday, timelineMonths])

  useEffect(() => {
    if (!highlightId) return
    const timer = window.setTimeout(() => setHighlightId(null), 3200)
    return () => window.clearTimeout(timer)
  }, [highlightId])

  useEffect(() => {
    if (!toast || toast.action === 'update') return
    const timer = window.setTimeout(() => setToast(null), toast.kind === 'error' ? 8000 : toast.href ? 12000 : 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const signOutFromProfile = async () => {
    if (!account.user || account.phase !== 'ready' || account.busy !== null) return
    try {
      await account.signOut()
      setToast({ message: 'You’re signed out. Your device plans are still here.', id: Date.now() })
    } catch (error) {
      setToast({ message: accountError(error), kind: 'error', id: Date.now() })
    }
  }

  const openDestination = (destination: Destination) => navigate(destinationPath(destination))
  const openAboutUpdates = useCallback(() => { setAboutUpdatesAfterUpdate(false); setAboutUpdatesOpen(true) }, [])
  const closeAboutUpdates = useCallback(() => { setAboutUpdatesOpen(false); setAboutUpdatesAfterUpdate(false) }, [])
  const openComposer = (options: ComposerOptions = {}) => {
    if (!canEdit) { setToast({ message: 'This Space is view-only for you. Ask an owner to grant Editor access.', kind: 'error', id: Date.now() }); return }
    const active = pageForPath(location.pathname).page
    const defaultType = active in WORKSPACE_TYPES ? WORKSPACE_TYPES[active as Workspace] : filter === 'all' ? 'event' : filter
    const from = location.pathname === '/new' ? location.state?.from : `${location.pathname}${location.search}`
    navigate(composerPath({ type: defaultType, ...options }), { state: { from }, replace: location.pathname === '/new' })
  }
  const cancelComposer = () => {
    if (typeof location.state?.from === 'string') navigate(-1)
    else navigate('/', { replace: true })
  }
  const createJourneyCard = (card: JourneyCard) => {
    if (!canEdit) return
    const month = card.date.slice(0, 7)
    setTimelineWindow((current) => ({ start: month < current.start ? month : current.start, end: month > current.end ? month : current.end }))
    dispatch({ type: 'add-card', card })
    setFilter('all')
    navigate('/', { replace: true, state: { focusCardId: card.id } })
    setToast({ message: 'A new chapter, added to your journey.', id: Date.now() })
  }
  const postSpaceNotice = (body: string) => {
    if (!spaces.postNotice(body)) return
    setToast({ message: space.notice ? 'Pinned Space Notice replaced for the team.' : 'Pinned Space Notice posted for the team.', id: Date.now() })
  }
  const clearSpaceNotice = () => {
    if (!spaces.clearNotice()) return
    setToast({ message: 'Pinned Space Notice cleared.', id: Date.now() })
  }
  const acknowledgeSpaceNotice = () => {
    if (!spaces.acknowledgeNotice()) return
    setToast({ message: 'Acknowledged.', id: Date.now() })
  }
  const updateJourneyCard = (card: EventCard | TaskCard | ProjectCard) => {
    if (!canEdit) return
    dispatch({ type: 'update-card', card })
    const page = card.type === 'event' ? 'calendar' : card.type === 'task' ? 'tasks' : 'project'
    navigate(destinationPath({ page, cardId: card.id }), { replace: true })
    setToast({ message: `${card.type === 'event' ? 'Event' : card.type === 'task' ? 'Task list' : 'Project'} updated.`, id: Date.now() })
  }
  const deleteJourneyCard = (card: JourneyCard) => {
    if (!canEdit) return
    dispatch({ type: 'delete-card', id: card.id })
    const attachments = card.type === 'note'
      ? [...new Map([card.attachment, ...(card.attachments ?? [])].filter((attachment): attachment is JournalAttachment => !!attachment).map((attachment) => [attachment.id, attachment])).values()]
      : []
    for (const attachment of attachments) {
      if (attachment.kind === 'audio') void removeJournalAttachment(attachment.id).catch(() => {})
      if (attachment.kind === 'image' && attachment.storage === 'firestore' && firestoreUserId) void import('./lib/firestore').then(({ deleteJournalImage }) => deleteJournalImage(firestoreUserId, attachment.id, { id: space.id, kind: space.kind })).catch(() => {})
    }
    setToast({ message: `${card.type === 'event' ? 'Event' : card.type === 'task' ? 'Task list' : card.type === 'project' ? 'Project' : 'Journal entry'} deleted.`, id: Date.now() })
  }
  const jumpToToday = () => {
    const currentDate = currentLocalDate()
    const focusMonth = currentDate.slice(0, 7)
    const target = cardOnDate(state.cards, currentDate)
    setFilter('all')
    setTimelineWindow((current) => ({ start: focusMonth < current.start ? focusMonth : current.start, end: focusMonth > current.end ? focusMonth : current.end }))
    if (target) setPendingScroll(target.id)
    else setPendingToday(currentDate)
  }
  const changeFilter = (type: Filter) => {
    setFilter(type)
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  const toggleGap = (key: string) => setOpenGaps((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  const extendTimeline = useCallback((direction: 'past' | 'future') => setTimelineWindow((current) => extendTimelineWindow(current, direction)), [])

  const titlebar = <UpdateChrome pwa={pwa} signedIn={!!account.user} position="titlebar" onOpenAbout={openAboutUpdates} />
  const updateBanner = <UpdateChrome pwa={pwa} signedIn={!!account.user} position="banner" onOpenAbout={openAboutUpdates} />
  const artworkVisible = location.pathname === '/' || !!calendarVisible

  return <div className={`application ${signInLayout ? 'application-auth' : ''}`}>
    <AppSplash />
    {location.pathname === '/' ? <MonthBackdrop month={timelineMonth} view="timeline" /> : calendarVisible ? <MonthBackdrop month={calendarMonth} view="calendar" /> : null}
    <a className="skip-link" href="#main-content">Skip to page content</a>
    {signInLayout ? <><SignInHeader titlebar={titlebar} />{updateBanner}</> : <><AppHeader titlebar={titlebar} artworkVisible={artworkVisible} appearance={appearance} online={pwa.online} syncEnabled={workspaceSync.enabled} updateReady={pwa.updateReady} notifications={notifications} activity={teamActivity} space={space} spaces={spaces.state.spaces} members={members} currentMember={member} canEdit={canEdit} onSelectSpace={spaces.selectSpace} onCreateSpace={spaces.createSpace} onUpdateSpace={spaces.updateSpace} onInvite={spaces.invite} onChangeRole={spaces.changeRole} onRemoveMember={spaces.removeMember} account={account} storageAvailable={storageAvailable} onSignOut={signOutFromProfile} />{updateBanner}<BottomNavigation onCompose={openComposer} canEdit={canEdit} unreadActivity={unreadActivity} /></>}
    {!storageAvailable && <div className="storage-alert" role="alert"><Clock3 size="0.9375rem" /><span>Device storage is unavailable. Changes will last only for this session.</span></div>}
    <div className="page-outlet">
      <Routes>
        <Route path="/" element={<main id="main-content" tabIndex={-1} className={`timeline-page app-shell ${state.bezel ? 'ipad-frame-active' : ''}`} aria-labelledby="page-title">
          <StreamHeader calendarSources={calendarSources.sources} count={scopedWorkCards.length} filter={filter} scope={teamScope} memberName={member.name} shared={space.kind === 'shared'} cloudSyncEnabled={workspaceSync.enabled} month={`${timelineMonth}-01`} onFilter={changeFilter} onScopeChange={setTeamScope} onSourceEnabled={calendarSources.setSourceEnabled} onSpaceNotice={postSpaceNotice} canManageNotice={canManageNotice} hasNotice={!!space.notice} />
          {space.kind === 'shared' && space.notice && <PinnedSpaceNotice notice={space.notice} acknowledgementId={account.user?.email?.trim().toLocaleLowerCase() || member.id} canManage={canManageNotice} onAcknowledge={acknowledgeSpaceNotice} onClear={clearSpaceNotice} />}
          <Timeline cards={scopedWorkCards} entries={entries} filter={filter} onCompose={openComposer} dispatch={dispatch} onDeleteCard={deleteJourneyCard} highlightId={highlightId} containerRef={timelineRef} openGaps={openGaps} onToggleGap={toggleGap}
            rolloverCandidates={overdueCards} rolloverDate={today} months={timelineMonths} canLoadPast={timelineWindow.start > TIMELINE_MIN_MONTH} canLoadFuture={timelineWindow.end < TIMELINE_MAX_MONTH} onLoadPast={() => extendTimeline('past')} onLoadFuture={() => extendTimeline('future')} currentMember={member} canEdit={canEdit} />
        </main>} />
        {(['calendar', 'tasks', 'project', 'journal'] as Workspace[]).map((page) => <Route key={page} path={`${WORKSPACE_PATHS[page]}/:cardId?`}
          element={<WorkspacePage page={page} cards={state.cards} calendarSources={calendarSources.sources} dispatch={dispatch} onNavigate={openDestination} onCompose={openComposer} onDeleteCard={deleteJourneyCard} storageAvailable={storageAvailable} cloudSaveState={cloudSaveState} journalUserId={firestoreUserId} space={space} currentMember={member} members={members} scope={teamScope} onScopeChange={setTeamScope} canEdit={canEdit} />} />)}
        <Route path="/notifications" element={<NotificationsPage notifications={notifications} />} />
        <Route path="/whats-new" element={<WhatsNewPage onOpenAbout={openAboutUpdates} />} />
        <Route path="/settings" element={<SettingsPage account={account} state={state} storageAvailable={storageAvailable} appearance={appearance} pwa={pwa} calendarSources={calendarSources} onOpenAbout={openAboutUpdates} />} />
        {['/account', '/sign-in'].map((path) => <Route key={path} path={path} element={<AccountPage account={account} state={state} storageAvailable={storageAvailable} />} />)}
        <Route path="/new" element={<NewCardPage cards={state.cards} members={members.map((candidate) => candidate.name)} canEdit={canEdit} onCancel={cancelComposer} onCreate={createJourneyCard} onUpdate={updateJourneyCard} />} />
        <Route path="/timeline" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
    {location.pathname === '/' && showJumpToday && <JumpToToday direction={jumpDirection} onJump={jumpToToday} />}
    <AppFooter />
    <AboutUpdatesDialog open={aboutUpdatesOpen} onClose={closeAboutUpdates} pwa={pwa} justUpdated={aboutUpdatesAfterUpdate} />
    <RouteEffects updateReady={pwa.updateReady && !pwa.coarse} />
    <div className="toast-region" role={toast?.kind === 'error' ? 'alert' : 'status'} aria-live={toast?.kind === 'error' ? 'assertive' : 'polite'}>{toast && <div className={`toast ${toast.kind === 'error' ? 'is-error' : ''}`} key={toast.id}><span className="toast-icon">{toast.kind === 'error' ? <AlertCircle size="1rem" /> : <Check size="1rem" />}</span><span>{toast.message}</span>{toast.href && <Link className="toast-action" to={toast.href} onClick={event => { if (!confirmNotificationNavigation(event)) { event.preventDefault(); return }; if (toast.notificationId) void notifications.markRead(toast.notificationId) }}>{toast.label ?? 'View'}</Link>}{toast.action === 'update' && <button type="button" className="toast-action" onClick={openAboutUpdates}>Review</button>}<button className="icon-button" aria-label={toast.action === 'update' ? 'Remind me about this update later' : 'Dismiss notification'} onClick={() => { if (toast.action === 'update') pwa.dismissUpdate(); setToast(null) }}><X size="0.875rem" /></button></div>}</div>
  </div>
}
