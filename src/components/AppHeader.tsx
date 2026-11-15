import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AccountController } from '../lib/useAccount'
import { useChromeHeight } from '../lib/useChromeHeight'
import { ProfileMenu } from './ProfileMenu'

export function KansoMark({ size = 24 }: { size?: number }) {
  return <img className="kanso-icon" src="/icons/icon-96.png" width={size} height={size} alt="" aria-hidden="true" decoding="async" />
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
