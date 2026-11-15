import { ArrowLeft, Check, Clock3, Crosshair, Link2, Tablet, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useMatch, useNavigate, useNavigationType } from 'react-router-dom'
import { FOCUS_DATE } from './data'
import type { ComposerOptions, Destination, Filter, JourneyCard, Workspace } from './types'
import { buildTimeline, focusCard, formatDate } from './lib/journey'
import { composerOptions, composerPath, destinationPath, pageForPath, WORKSPACE_PATHS, WORKSPACE_TYPES } from './lib/navigation'
import { useJourneyStore } from './lib/store'
import { useAccount } from './lib/useAccount'
import { AccountPage } from './components/AccountPage'
import { SignInHeader } from './components/SignInPage'
import { calendarPeriod, monthAtPosition } from './lib/months'
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

function StreamHeader({ filter, count, month, bezel, onFilter, onFocus, onToggleFrame }: {
  filter: Filter
  count: number
  month: string
  bezel: boolean
  onFilter: (type: Filter) => void
  onFocus: () => void
  onToggleFrame: () => void
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
        <button className="button button-focus" onClick={onFocus} title="Focus the active card" aria-label="Focus Active"><Crosshair size={14} /><span>Focus Active</span></button>
        <button className={`frame-toggle ${bezel ? 'is-active' : ''}`} onClick={onToggleFrame} aria-pressed={bezel} aria-label="Tablet frame" title="Toggle tablet frame"><Tablet size={15} /></button>
      </div>
    </div>
    <div className="header-bottom">
      <nav className="filter-bar" aria-label="Filter journey cards">{filters.map(({ type, label }) => <button key={type} className={`filter-pill ${filter === type ? 'is-active' : ''}`} onClick={() => onFilter(type)} aria-pressed={filter === type}>
        {type !== 'all' && <span className={`filter-dot dot-${type}`} />}<span>{label}</span>{type === 'all' && <span className="filter-count">{count}</span>}
      </button>)}</nav>
      <span className="connected-label"><Link2 size={12} />All your pages, connected</span>
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
    <button className="text-button return-to-page" onClick={onCancel}><ArrowLeft size={13} />Back to your workspace</button>
    <Composer key={location.key} options={composerOptions(location.search)} cards={cards} onCancel={onCancel} onCreate={onCreate} />
  </main>
}

export default function App() {
  const { state, dispatch, storageAvailable } = useJourneyStore()
  const account = useAccount()
  const location = useLocation()
  const navigate = useNavigate()
  const navigationType = useNavigationType()
  const calendarMatch = useMatch('/calendar/:cardId?')
  const accountMatch = useMatch('/account')
  const signInMatch = useMatch('/sign-in')
  const signInLayout = !!(accountMatch || signInMatch) && !account.user
  const [visibleTimelineMonth, setVisibleTimelineMonth] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [openGaps, setOpenGaps] = useState<string[]>([])
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null)
  const [pendingScroll, setPendingScroll] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const handledFocusKey = useRef<string | null>(null)
  const timelineRef = useRef<HTMLElement>(null)
  const entries = useMemo(() => buildTimeline(state.cards, filter), [state.cards, filter])
  const firstDate = useMemo(() => [...state.cards].sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? FOCUS_DATE, [state.cards])
  const defaultMonth = (entries.find((entry) => entry.kind === 'day')?.date ?? firstDate).slice(0, 7)
  const timelineMonth = visibleTimelineMonth && entries.some((entry) => entry.kind === 'day' && entry.date.startsWith(visibleTimelineMonth)) ? visibleTimelineMonth : defaultMonth
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
      const navTop = document.querySelector('.bottom-bar')?.getBoundingClientRect().top ?? window.innerHeight
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
    return () => {
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [location.pathname, entries, defaultMonth])

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
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const openDestination = (destination: Destination) => navigate(destinationPath(destination))
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
    dispatch({ type: 'add-card', card })
    setFilter('all')
    navigate('/', { replace: true, state: { focusCardId: card.id } })
    setToast({ message: 'A new chapter, added to your journey.', id: Date.now() })
  }
  const focusActive = () => {
    const card = focusCard(state.cards, FOCUS_DATE)
    if (card) { setFilter('all'); setPendingScroll(card.id) }
  }
  const changeFilter = (type: Filter) => {
    setFilter(type)
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  const toggleGap = (key: string) => setOpenGaps((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])

  return <div className={`application ${signInLayout ? 'application-auth' : ''}`}>
    {location.pathname === '/' ? <MonthBackdrop month={timelineMonth} view="timeline" /> : calendarVisible ? <MonthBackdrop month={calendarMonth} view="calendar" /> : null}
    <a className="skip-link" href="#main-content">Skip to page content</a>
    {signInLayout ? <SignInHeader /> : <><AppHeader account={account} onCompose={() => openComposer()} /><BottomNavigation /></>}
    {!storageAvailable && <div className="storage-alert" role="alert"><Clock3 size={15} /><span>Device storage is unavailable. Changes will last only for this session.</span></div>}
    <div className="page-outlet">
      <Routes>
        <Route path="/" element={<main id="main-content" tabIndex={-1} className={`timeline-page app-shell ${state.bezel ? 'ipad-frame-active' : ''}`} aria-labelledby="page-title">
          <StreamHeader filter={filter} count={state.cards.length} month={`${timelineMonth}-01`} bezel={state.bezel} onFilter={changeFilter} onFocus={focusActive} onToggleFrame={() => dispatch({ type: 'toggle-bezel' })} />
          <Timeline entries={entries} filter={filter} onCompose={openComposer} dispatch={dispatch} highlightId={highlightId} containerRef={timelineRef} openGaps={openGaps} onToggleGap={toggleGap} />
        </main>} />
        {(['calendar', 'tasks', 'project', 'journal'] as Workspace[]).map((page) => <Route key={page} path={`${WORKSPACE_PATHS[page]}/:cardId?`}
          element={<WorkspacePage page={page} cards={state.cards} dispatch={dispatch} onNavigate={openDestination} onCompose={openComposer} storageAvailable={storageAvailable} />} />)}
        {['/account', '/sign-in'].map((path) => <Route key={path} path={path} element={<AccountPage account={account} state={state} storageAvailable={storageAvailable} />} />)}
        <Route path="/new" element={<NewCardPage cards={state.cards} onCancel={cancelComposer} onCreate={createJourneyCard} />} />
        <Route path="/timeline" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
    <AppFooter />
    <RouteEffects />
    <div className="toast-region" role="status" aria-live="polite">{toast && <div className="toast" key={toast.id}><span className="toast-icon"><Check size={16} /></span><span>{toast.message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={14} /></button></div>}</div>
  </div>
}
