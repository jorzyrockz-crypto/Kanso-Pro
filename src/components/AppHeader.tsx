import { Bell, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import type { AccountController } from '../lib/useAccount'
import { useChromeHeight } from '../lib/useChromeHeight'
import { confirmNotificationNavigation } from '../lib/notifications'
import { ProfileMenu } from './ProfileMenu'

export function KansoMark({ size = 24 }: { size?: number }) {
  return <img className="kanso-icon" src="/icons/icon-96.png" width={size} height={size} alt="" aria-hidden="true" decoding="async" />
}

export function AppHeader({ account, storageAvailable, onCompose, onSignOut, unread, updateReady, titlebar, notice }: { account: AccountController; storageAvailable: boolean; onCompose: () => void; onSignOut: () => Promise<void>; unread: number; updateReady: boolean; titlebar?: ReactNode; notice?: ReactNode }) {
  const ref = useChromeHeight<HTMLElement>('--topbar-height')

  return <header ref={ref} className="topbar">
    {titlebar}
    <div className="topbar-inner">
      <Link to="/" className="app-brand" aria-label="Kanso Pro home">
        <span className="brand-mark"><KansoMark /></span>
        <span className="brand-name">Kanso <span>Pro</span></span>
      </Link>
      <div className="topbar-actions">
        <button className="button button-dark global-create" aria-label="New card" onClick={onCompose}><Plus size="1rem" /><span>New card</span></button>
        <NavLink to="/notifications" onClick={event => { if (!confirmNotificationNavigation(event)) event.preventDefault() }} className="notification-bell" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}><Bell size="1.125rem" aria-hidden="true" />{unread > 0 && <span className="notification-count" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}</NavLink>
        <ProfileMenu updateReady={updateReady} account={account} storageAvailable={storageAvailable} onSignOut={onSignOut} />
      </div>
    </div>
    {notice}
  </header>
}
