import { useState, type FocusEvent, type MouseEvent } from 'react'
import { BookOpen, CalendarDays, CircleCheck, PanelLeftClose, PanelLeftOpen, Plus, Waypoints, Zap } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { PAGE_LINKS, pageForPath } from '../lib/navigation'
import { FOCUS_DATE } from '../data'
import { isValidDate } from '../lib/journey'
import type { ComposerOptions } from '../types'
import { useChromeHeight } from '../lib/useChromeHeight'
import { useNavigationCollapsed } from '../lib/useNavigationCollapsed'

const icons = { timeline: Waypoints, calendar: CalendarDays, tasks: CircleCheck, project: Zap, journal: BookOpen }

const composerForPage = {
  calendar: { label: 'New event', type: 'event' },
  tasks: { label: 'New task list', type: 'task' },
  project: { label: 'New project', type: 'project' },
  journal: { label: 'New note', type: 'note' },
} as const

/** The same primary navigation becomes the desktop sidebar through fluid.css.
 * On fine-pointer desktops the sidebar can collapse to an icon rail; labels stay in the
 * accessibility tree and a hover/focus tooltip (shown only by the collapsed-rail CSS) names each icon. */
export function BottomNavigation({ onCompose }: { onCompose: (options?: ComposerOptions) => void }) {
  const ref = useChromeHeight<HTMLDivElement>('--navigation-height')
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
  const [collapsed, toggleCollapsed] = useNavigationCollapsed()
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null)

  const showTip = (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-tip]')
    if (!target) return setTip(null)
    const rect = target.getBoundingClientRect()
    setTip({ label: target.dataset.tip!, top: rect.top + rect.height / 2 })
  }
  const hideTip = () => setTip(null)
  const toggleLabel = collapsed ? 'Expand navigation' : 'Collapse navigation'

  return <div ref={ref} className="bottom-bar" onMouseOver={showTip} onMouseLeave={hideTip} onFocus={showTip} onBlur={hideTip}
    onKeyDown={(event) => { if (event.key === 'Escape') hideTip() }}>
    <div className="navigation-rail-header">
      <p className="navigation-eyebrow" aria-hidden="true">Your workspace</p>
      <button type="button" className="navigation-collapse-toggle" aria-label={toggleLabel} aria-expanded={!collapsed} aria-controls="main-navigation"
        title={collapsed ? undefined : toggleLabel} data-tip={toggleLabel} onClick={() => { toggleCollapsed(); hideTip() }}>
        {collapsed ? <PanelLeftOpen size="1.125rem" strokeWidth={1.8} aria-hidden="true" /> : <PanelLeftClose size="1.125rem" strokeWidth={1.8} aria-hidden="true" />}
      </button>
    </div>
    <nav id="main-navigation" className="bottom-navigation" aria-label="Main navigation">
      {PAGE_LINKS.map(({ path, label, page }) => {
        const Icon = icons[page]
        return <NavLink key={path} to={path} end={path === '/'} data-tip={label}
          className={({ isActive }) => `bottom-nav-link ${isActive ? 'is-active' : ''}`}>
          <Icon size="1.3125rem" strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
        </NavLink>
      })}
      <button type="button" aria-label={create.label} className={`bottom-nav-link bottom-nav-create${'type' in create ? ` is-${create.type}` : ''}`} data-tip={create.label} onClick={() => page === 'journal' ? navigate('/journal?create=menu') : onCompose(options)}>
        <Plus size="1.3125rem" strokeWidth={2} aria-hidden="true" /><span>{create.label}</span>
      </button>
    </nav>
    <p className="navigation-note" aria-hidden="true">A little structure.<br />A lot of possibility.</p>
    {tip && <span className="navigation-tooltip" aria-hidden="true" style={{ top: tip.top }}>{tip.label}</span>}
  </div>
}
