import { BookOpen, CalendarDays, CircleCheck, Waypoints, Zap } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { PAGE_LINKS } from '../lib/navigation'
import { useChromeHeight } from '../lib/useChromeHeight'

const icons = { timeline: Waypoints, calendar: CalendarDays, tasks: CircleCheck, project: Zap, journal: BookOpen }

export function BottomNavigation() {
  const ref = useChromeHeight<HTMLDivElement>('--bottom-bar-height')

  return <div ref={ref} className="bottom-bar">
    <nav className="bottom-navigation" aria-label="Main navigation">
      {PAGE_LINKS.map(({ path, label, page }) => {
        const Icon = icons[page]
        return <NavLink key={path} to={path} end={path === '/'}
          className={({ isActive }) => `bottom-nav-link ${isActive ? 'is-active' : ''}`}>
          <Icon size={21} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
        </NavLink>
      })}
    </nav>
  </div>
}
