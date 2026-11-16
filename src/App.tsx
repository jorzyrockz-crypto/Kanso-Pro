import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, Check, Clock3, Landmark, Link2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useMatch, useNavigate, useNavigationType } from 'react-router-dom'
import { FOCUS_DATE } from './data'
import type { ComposerOptions, Destination, Filter, JourneyCard, TimelineSourceEntry, Workspace } from './types'
import { buildTimeline, focusCard, formatDate, rolloverCandidates, shiftMonth } from './lib/journey'
import { composerOptions, composerPath, destinationPath, pageForPath, WORKSPACE_PATHS, WORKSPACE_TYPES } from './lib/navigation'
import { useJourneyStore } from './lib/store'
import { useWorkspaceSync } from './lib/useWorkspaceSync'
import { calendarSourceEntriesForMonths, useCalendarSources } from './lib/calendarSources'
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
import { BottomNavigation } from './components/BottomNavigation'
import { AppFooter, NotFoundPage, PageHeader } from './components/PageHeader'
import { RouteEffects } from './components/RouteEffects'

const filters: { type: Filter; label: string }[] = [
  { type: 'all', label: 'All Stream' }, { type: 'event', label: 'Events' },
  { type: 'task', label: 'Tasks' }, { type: 'project', label: 'Projects' },
  { type: 'note', label: 'Journal Notes' },
]

const TIMELINE_MONTH_STEP = 1
const TIMELINE_MIN_MONTH = '1900-01'
const TIMELINE_MAX_MONTH = '9999-12'

type TimelineWindow = { start: string; end: string }

function timelineWindowFor(cards: JourneyCard[]): TimelineWindow {
  const months = [...cards.map((card) => card.date.slice(0, 7)), FOCUS_DATE.slice(0, 7)].sort()
  return { start: months[0], end: months.at(-1)! }
}

function extendTimelineWindow(window: TimelineWindow, direction: 'past' | 'future'): TimelineWindow {
  if (direction === 'past') return window.start === TIMELINE_MIN_MONTH
    ? window
    : { ...window, start: window.start <= '1900-12' ? TIMELINE_MIN_MONTH : shiftMonth(window.start, -TIMELINE_MONTH_STEP) }
  return window.end === TIMELINE_MAX_MONTH
    ? window
    : { ...window, end: window.end >= '9999-01' ? TIMELINE_MAX_MONTH : shiftMonth(window.end, TIMELINE_MONTH_STEP) }
}

function StreamHeader({ filter, count, month, showCalendarSources, calendarSourceCount, jumpDirection, onFilter, onJumpToToday, onCalendarSourcesChange }: {
  filter: Filter
  count: number
  month: string
  showCalendarSources: boolean
  calendarSourceCount: number
  jumpDirection: 'up' | 'down'
  onFilter: (type: Filter) => void
  onJumpToToday: () => void
  onCalendarSourcesChange: (show: boolean) => void
}) {
  return <header className="stream-header">
    <div className="header-main">
      <div className="header-identity">
        <div className="month-icon" aria-label={formatDate(month, { month: 'long', year: 'numeric' })}>
          <span>{formatDate(month, { month: 'short' })}</span><strong>{formatDate(month, { year: 'numeric' })}</strong>
        </div>
        <div className="header-copy">
          <div className="header-title-line"><h1 id="page-title">Journey Stream</h1><span className="live-badge" title="Your four workspaces stay connected on this device"><span className="live-dot" /><span className="live-text">Live Flow</span></span></div>
          <p>Your plans, progress, and reflections. All in one flow.</p>
        </div>
      </div>
      <div className="header-actions">
        <button className={`button button-jump-today is-${jumpDirection}`} onClick={onJumpToToday} title={`Jump ${jumpDirection} to today`} aria-label="Jump to Today">
          {jumpDirection === 'up' ? <ArrowUp size="0.875rem" aria-hidden="true" /> : <ArrowDown size="0.875rem" aria-hidden="true" />}<span>Jump to Today</span>
        </button>
      </div>
    </div>
    <div className="header-bottom">
      <nav className="filter-bar" aria-label="Filter journey cards">{filters.map(({ type, label }) => <button key={type} className={`filter-pill ${filter === type ? 'is-active' : ''}`} onClick={() => onFilter(type)} aria-pressed={filter === type}>
        {type !== 'all' && <span className={`filter-dot dot-${type}`} />}<span>{label}</span>{type === 'all' && <span className="filter-count">{count}</span>}
      </button>)}</nav>
      <div className="stream-reference-controls">
        <button type="button" className={`stream-source-toggle ${showCalendarSources ? 'is-active' : ''}`} onClick={() => onCalendarSourcesChange(!showCalendarSources)} aria-pressed={showCalendarSources} title="Show enabled DepEd calendar sources as reference-only cards in the Timeline">
          <Landmark size="0.75rem" aria-hidden="true" /><span className="stream-source-label">Calendar sources</span><span className="stream-source-state">{showCalendarSources ? 'Shown' : 'Hidden'}</span>{calendarSourceCount > 0 && <span className="stream-source-count">{calendarSourceCount}</span>}
        </button>
        <span className="connected-label"><Link2 size="0.75rem" />All your pages, connected</span>
      </div>
    </div>
  </header>
}

function NewCardPage({ cards, onCancel, onCreate }: {
  cards: JourneyCard[]
  onCancel: () => void
  onCreate: (card: JourneyCard) => void
}) {
  const location = useLocation()
  return <main id="main-content" tabIndex={-1} className="create-page" aria-labelledby="page-title">
    <PageHeader title="New card" description="An event, a small step, a bigger idea, or a thought worth keeping." />
    <button className="text-button return-to-page" onClick={onCancel}><ArrowLeft size="0.8125rem" />Back to your workspace</button>
    <Composer key={location.key} options={composerOptions(location.search)} cards={cards} onCancel={onCancel} onCreate={onCreate} />
  </main>
}

export default function App() {
  const { state, dispatch, storageAvailable } = useJourneyStore()
  const calendarSources = useCalendarSources(DEPED_SY_2026_2027_ENTRIES, DEPED_LEGISLATED_ACTIVITY_RULES)
  const account = useAccount()
  useWorkspaceSync(account.user, state, dispatch)
  const appearance = useAppearance()
  const pwa = usePwa()
  const notifications = useNotifications(state.cards)
  const location = useLocation()
  const navigate = useNavigate()
  const navigationType = useNavigationType()
  const calendarMatch = useMatch('/calendar/:cardId?')
  const accountMatch = useMatch('/account')
  const signInMatch = useMatch('/sign-in')
  const signInLayout = !!(accountMatch || signInMatch) && !account.user
  const [visibleTimelineMonth, setVisibleTimelineMonth] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [showCalendarSources, setShowCalendarSources] = useState(true)
  const [openGaps, setOpenGaps] = useState<string[]>([])
  const [aboutUpdatesOpen, setAboutUpdatesOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; id: number; kind?: 'error'; href?: string; label?: string; action?: 'update'; notificationId?: string } | null>(null)
  const announcedUpdate = useRef('')
  useEffect(() => {
    if (notifications.announcement) setToast({ ...notifications.announcement, id: Date.now(), label: 'View' })
  }, [notifications.announcement])
  useEffect(() => {
    if (pwa.updatedNotice) setToast({ message: pwa.updatedNotice, id: Date.now(), href: '/whats-new', label: 'What’s new' })
  }, [pwa.updatedNotice])
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
  const jumpTarget = useMemo(() => focusCard(state.cards, FOCUS_DATE), [state.cards])
  const [jumpDirection, setJumpDirection] = useState<'up' | 'down'>('down')
  const [timelineWindow, setTimelineWindow] = useState<TimelineWindow>(() => timelineWindowFor(state.cards))
  const cardTimelineWindow = useMemo(() => timelineWindowFor(state.cards), [state.cards])
  const timelineMonths = useMemo(() => monthRange(timelineWindow.start, timelineWindow.end), [timelineWindow])
  const timelineSourceEntries = useMemo<TimelineSourceEntry[]>(() => {
    if (!showCalendarSources) return []
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
  }, [calendarSources.sources, showCalendarSources, timelineMonths])
  const timelineCards = useMemo(() => state.cards.filter((card) => card.date.slice(0, 7) >= timelineWindow.start && card.date.slice(0, 7) <= timelineWindow.end), [state.cards, timelineWindow])
  const entries = useMemo(() => buildTimeline(timelineCards, filter, timelineSourceEntries), [timelineCards, filter, timelineSourceEntries])
  const overdueCards = useMemo(() => rolloverCandidates(state.cards, FOCUS_DATE), [state.cards])
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
    const updateDirection = () => {
      frame = 0
      const target = jumpTarget && document.getElementById(`card-${jumpTarget.id}`)
      const headerBottom = document.querySelector('.stream-header')?.getBoundingClientRect().bottom ?? 0
      const nextDirection = target && target.getBoundingClientRect().bottom < headerBottom ? 'up' : 'down'
      setJumpDirection((current) => current === nextDirection ? current : nextDirection)
    }
    const requestUpdate = () => { if (!frame) frame = requestAnimationFrame(updateDirection) }
    updateDirection()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    return () => {
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      cancelAnimationFrame(frame)
    }
  }, [filter, jumpTarget, location.pathname, entries])

  useEffect(() => {
    const cardId: unknown = location.state?.focusCardId
    if (navigationType === 'POP' || location.pathname !== '/' || typeof cardId !== 'string' || handledFocusKey.current === location.key) return
    if (!state.cards.some((card) => card.id === cardId)) return
    handledFocusKey.current = location.key
    setFilter('all')
    const gap = buildTimeline(state.cards).find((entry) => entry.kind === 'gap' && entry.cards.some((card) => card.id === cardId))
    if (gap?.kind === 'gap') setOpenGaps((current) => [...new Set([...current, `${gap.start}-${gap.end}`])])
    setPendingScroll(cardId)
  }, [location.key, location.pathname, location.state, navigationType, state.cards])

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
  const openAboutUpdates = useCallback(() => setAboutUpdatesOpen(true), [])
  const closeAboutUpdates = useCallback(() => setAboutUpdatesOpen(false), [])
  const openComposer = (options: ComposerOptions = {}) => {
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
    const month = card.date.slice(0, 7)
    setTimelineWindow((current) => ({ start: month < current.start ? month : current.start, end: month > current.end ? month : current.end }))
    dispatch({ type: 'add-card', card })
    setFilter('all')
    navigate('/', { replace: true, state: { focusCardId: card.id } })
    setToast({ message: 'A new chapter, added to your journey.', id: Date.now() })
  }
  const jumpToToday = () => {
    if (jumpTarget) { setFilter('all'); setPendingScroll(jumpTarget.id) }
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
    {location.pathname === '/' ? <MonthBackdrop month={timelineMonth} view="timeline" /> : calendarVisible ? <MonthBackdrop month={calendarMonth} view="calendar" /> : null}
    <a className="skip-link" href="#main-content">Skip to page content</a>
    {signInLayout ? <><SignInHeader titlebar={titlebar} />{updateBanner}</> : <><AppHeader titlebar={titlebar} artworkVisible={artworkVisible} appearance={appearance} online={pwa.online} updateReady={pwa.updateReady} unread={notifications.unread} account={account} storageAvailable={storageAvailable} onSignOut={signOutFromProfile} />{updateBanner}<BottomNavigation onCompose={() => openComposer()} /></>}
    {!storageAvailable && <div className="storage-alert" role="alert"><Clock3 size="0.9375rem" /><span>Device storage is unavailable. Changes will last only for this session.</span></div>}
    <div className="page-outlet">
      <Routes>
        <Route path="/" element={<main id="main-content" tabIndex={-1} className={`timeline-page app-shell ${state.bezel ? 'ipad-frame-active' : ''}`} aria-labelledby="page-title">
          <StreamHeader filter={filter} count={state.cards.length} month={`${timelineMonth}-01`} showCalendarSources={showCalendarSources} calendarSourceCount={timelineSourceEntries.length} jumpDirection={jumpDirection} onFilter={changeFilter} onJumpToToday={jumpToToday} onCalendarSourcesChange={setShowCalendarSources} />
          <Timeline entries={entries} filter={filter} onCompose={openComposer} dispatch={dispatch} highlightId={highlightId} containerRef={timelineRef} openGaps={openGaps} onToggleGap={toggleGap}
            rolloverCandidates={overdueCards} rolloverDate={FOCUS_DATE} months={timelineMonths} canLoadPast={timelineWindow.start > TIMELINE_MIN_MONTH} canLoadFuture={timelineWindow.end < TIMELINE_MAX_MONTH} onLoadPast={() => extendTimeline('past')} onLoadFuture={() => extendTimeline('future')} />
        </main>} />
        {(['calendar', 'tasks', 'project', 'journal'] as Workspace[]).map((page) => <Route key={page} path={`${WORKSPACE_PATHS[page]}/:cardId?`}
          element={<WorkspacePage page={page} cards={state.cards} calendarSources={calendarSources.sources} dispatch={dispatch} onNavigate={openDestination} onCompose={openComposer} storageAvailable={storageAvailable} />} />)}
        <Route path="/notifications" element={<NotificationsPage notifications={notifications} />} />
        <Route path="/whats-new" element={<WhatsNewPage onOpenAbout={openAboutUpdates} />} />
        <Route path="/settings" element={<SettingsPage account={account} state={state} storageAvailable={storageAvailable} appearance={appearance} pwa={pwa} calendarSources={calendarSources} onOpenAbout={openAboutUpdates} />} />
        {['/account', '/sign-in'].map((path) => <Route key={path} path={path} element={<AccountPage account={account} state={state} storageAvailable={storageAvailable} />} />)}
        <Route path="/new" element={<NewCardPage cards={state.cards} onCancel={cancelComposer} onCreate={createJourneyCard} />} />
        <Route path="/timeline" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
    <AppFooter />
    <AboutUpdatesDialog open={aboutUpdatesOpen} onClose={closeAboutUpdates} pwa={pwa} />
    <RouteEffects updateReady={pwa.updateReady && !pwa.coarse} />
    <div className="toast-region" role={toast?.kind === 'error' ? 'alert' : 'status'} aria-live={toast?.kind === 'error' ? 'assertive' : 'polite'}>{toast && <div className={`toast ${toast.kind === 'error' ? 'is-error' : ''}`} key={toast.id}><span className="toast-icon">{toast.kind === 'error' ? <AlertCircle size="1rem" /> : <Check size="1rem" />}</span><span>{toast.message}</span>{toast.href && <Link className="toast-action" to={toast.href} onClick={event => { if (!confirmNotificationNavigation(event)) { event.preventDefault(); return }; if (toast.notificationId) void notifications.markRead(toast.notificationId) }}>{toast.label ?? 'View'}</Link>}{toast.action === 'update' && <button type="button" className="toast-action" onClick={openAboutUpdates}>Review</button>}<button className="icon-button" aria-label={toast.action === 'update' ? 'Remind me about this update later' : 'Dismiss notification'} onClick={() => { if (toast.action === 'update') pwa.dismissUpdate(); setToast(null) }}><X size="0.875rem" /></button></div>}</div>
  </div>
}
