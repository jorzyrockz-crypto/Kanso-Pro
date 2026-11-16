import { BookOpen, CalendarDays, CircleCheck, Plus, Waypoints, Zap } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { PAGE_LINKS } from '../lib/navigation'
import { useChromeHeight } from '../lib/useChromeHeight'

const icons = { timeline: Waypoints, calendar: CalendarDays, tasks: CircleCheck, project: Zap, journal: BookOpen }

/** The same primary navigation becomes the desktop sidebar through fluid.css. */
export function BottomNavigation({ onCompose }: { onCompose: () => void }) {
  const ref = useChromeHeight<HTMLDivElement>('--navigation-height')

  return <div ref={ref} className="bottom-bar">
    <p className="navigation-eyebrow" aria-hidden="true">Your workspace</p>
    <nav className="bottom-navigation" aria-label="Main navigation">
      {PAGE_LINKS.map(({ path, label, page }) => {
        const Icon = icons[page]
        return <NavLink key={path} to={path} end={path === '/'}
          className={({ isActive }) => `bottom-nav-link ${isActive ? 'is-active' : ''}`}>
          <Icon size="1.3125rem" strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
        </NavLink>
      })}
      <button type="button" className="bottom-nav-link bottom-nav-create" onClick={onCompose}>
        <Plus size="1.3125rem" strokeWidth={2} aria-hidden="true" /><span>New card</span>
      </button>
    </nav>
    <p className="navigation-note" aria-hidden="true">A little structure.<br />A lot of possibility.</p>
  </div>
}
