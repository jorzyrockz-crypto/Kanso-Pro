import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AccountController } from '../lib/useAccount'
import { useChromeHeight } from '../lib/useChromeHeight'
import { ProfileMenu } from './ProfileMenu'

export function KansoMark({ size = 24 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M9 5v22M23 5 11 16l12 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="9" cy="16" r="3" fill="#7dd3fc" />
  </svg>
}

export function AppHeader({ account, storageAvailable, onCompose, onSignOut }: { account: AccountController; storageAvailable: boolean; onCompose: () => void; onSignOut: () => Promise<void> }) {
  const ref = useChromeHeight<HTMLElement>('--topbar-height')

  return <header ref={ref} className="topbar">
    <div className="topbar-inner">
      <Link to="/" className="app-brand" aria-label="Kanso Pro home">
        <span className="brand-mark"><KansoMark /></span>
        <span className="brand-name">Kanso <span>Pro</span></span>
      </Link>
      <div className="topbar-actions">
        <button className="button button-dark global-create" onClick={onCompose}><Plus size={16} /><span>New card</span></button>
        <ProfileMenu account={account} storageAvailable={storageAvailable} onSignOut={onSignOut} />
      </div>
    </div>
  </header>
}
