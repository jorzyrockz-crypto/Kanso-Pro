import { Plus } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { accountInitials, accountName } from '../lib/account'
import type { AccountController } from '../lib/useAccount'
import { useChromeHeight } from '../lib/useChromeHeight'

export function KansoMark({ size = 24 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M9 5v22M23 5 11 16l12 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="9" cy="16" r="3" fill="#7dd3fc" />
  </svg>
}

export function AppHeader({ account, onCompose }: { account: Pick<AccountController, 'user' | 'phase'>; onCompose: () => void }) {
  const ref = useChromeHeight<HTMLElement>('--topbar-height')

  return <header ref={ref} className="topbar">
    <div className="topbar-inner">
      <Link to="/" className="app-brand" aria-label="Kanso Pro home">
        <span className="brand-mark"><KansoMark /></span>
        <span className="brand-name">Kanso <span>Pro</span></span>
      </Link>
      <div className="topbar-actions">
        <button className="button button-dark global-create" onClick={onCompose}><Plus size={16} /><span>New card</span></button>
        <NavLink to={account.user ? '/account' : '/sign-in'} className={({ isActive }) => `personal-workspace ${isActive ? 'is-active' : ''}`} aria-label={account.user ? `Open ${accountName(account.user)}’s account` : 'Open my workspace and account'} title="Account settings · plans stay in this browser">
          <span className="workspace-avatar" aria-hidden="true">{accountInitials(account.user)}</span>
          <span className="workspace-account"><strong>{accountName(account.user)}</strong><small>{account.user ? 'Personal · Signed in' : account.phase === 'loading' ? 'Checking account…' : account.phase === 'error' ? 'Sign-in unavailable' : 'Personal · Guest'}</small></span>
        </NavLink>
      </div>
    </div>
  </header>
}
