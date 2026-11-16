import { BookOpen, CalendarDays, CircleCheck, PanelLeftClose, PanelLeftOpen, Plus, Waypoints, Zap } from 'lucide-react'
import { useLayoutEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { PAGE_LINKS, pageForPath } from '../lib/navigation'
import { FOCUS_DATE } from '../data'
import { isValidDate } from '../lib/journey'
import type { ComposerOptions } from '../types'
import { useChromeHeight } from '../lib/useChromeHeight'

const icons = { timeline: Waypoints, calendar: CalendarDays, tasks: CircleCheck, project: Zap, journal: BookOpen }

const composerForPage = {
  calendar: { label: 'New event', type: 'event' },
  tasks: { label: 'New task list', type: 'task' },
  project: { label: 'New project', type: 'project' },
  journal: { label: 'New note', type: 'note' },
} as const

const SIDEBAR_STORAGE_KEY = 'kanso-pro:sidebar-collapsed:v1'

function savedSidebarState() {
  try { return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true' } catch { return false }
}

/** The same primary navigation becomes the desktop sidebar through fluid.css. */
export function BottomNavigation({ onCompose }: { onCompose: (options?: ComposerOptions) => void }) {
  const ref = useChromeHeight<HTMLDivElement>('--navigation-height')
  const [collapsed, setCollapsed] = useState(savedSidebarState)
  const location = useLocation()
  const navigate = useNavigate()
  const page = pageForPath(location.pathname, location.search).page
  const create = page in composerForPage ? composerForPage[page as keyof typeof composerForPage] : { label: 'New card' }
  const calendarQuery = new URLSearchParams(location.search)
  const calendarDate = calendarQuery.get('date')
  const calendarMonth = calendarQuery.get('month')
  const date = page === 'calendar'
    ? isValidDate(calendarDate) ? calendarDate : isValidDate(`${calendarMonth}-01`) ? `${calendarMonth}-14` : FOCUS_DATE
    : page in composerForPage ? FOCUS_DATE : undefined
  const options: ComposerOptions = { ...('type' in create ? { type: create.type } : {}), ...(date ? { date } : {}) }

  useLayoutEffect(() => {
    document.documentElement.dataset.sidebarCollapsed = String(collapsed)
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed)) } catch { /* The visual preference still lasts for this session. */ }
    return () => { delete document.documentElement.dataset.sidebarCollapsed }
  }, [collapsed])

  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose
  return <div ref={ref} className={`bottom-bar ${collapsed ? 'is-collapsed' : ''}`}>
    <div className="sidebar-heading"><p className="navigation-eyebrow" aria-hidden="true">Your workspace</p><button type="button" className="sidebar-collapse" aria-label={collapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'} aria-expanded={!collapsed} title={collapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'} onClick={() => setCollapsed((current) => !current)}><CollapseIcon size="1rem" aria-hidden="true" /></button></div>
    <nav className="bottom-navigation" aria-label="Main navigation">
      {PAGE_LINKS.map(({ path, label, page }) => {
        const Icon = icons[page]
        return <NavLink key={path} to={path} end={path === '/'} title={label}
          className={({ isActive }) => `bottom-nav-link ${isActive ? 'is-active' : ''}`}>
          <Icon size="1.3125rem" strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
        </NavLink>
      })}
      <button type="button" aria-label={create.label} title={create.label} className={`bottom-nav-link bottom-nav-create${'type' in create ? ` is-${create.type}` : ''}`} onClick={() => page === 'journal' ? navigate('/journal?create=menu') : onCompose(options)}>
        <Plus size="1.3125rem" strokeWidth={2} aria-hidden="true" /><span>{create.label}</span>
      </button>
    </nav>
    <p className="navigation-note" aria-hidden="true">A little structure.<br />A lot of possibility.</p>
  </div>
}
