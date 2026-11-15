import { Bell, CircleDashed, Moon, Sun, WifiOff } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import type { AppearanceController } from '../lib/useAppearance'
import type { AccountController } from '../lib/useAccount'
import { useChromeHeight } from '../lib/useChromeHeight'
import { confirmNotificationNavigation } from '../lib/notifications'
import { MoreMenu } from './ProfileMenu'

export function KansoMark({ size = 24 }: { size?: number }) {
  return <img className="kanso-icon" src="/icons/icon-96.png" width={size} height={size} alt="" aria-hidden="true" decoding="async" />
}

const modeDetails = {
  light: { label: 'Light', Icon: Sun },
  dark: { label: 'Dark', Icon: Moon },
  auto: { label: 'Auto', Icon: CircleDashed },
} as const

/** A small, non-modal appearance disclosure that keeps the header's one-row rhythm. */
function HeaderAppearance({ appearance, open, onOpenChange }: { appearance: AppearanceController; open: boolean; onOpenChange: (open: boolean) => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const current = modeDetails[appearance.mode]
  const CurrentIcon = current.Icon

  const close = (returnFocus = false) => {
    onOpenChange(false)
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) close(false)
    }
    const focusOutside = (event: FocusEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) close(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(true)
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', focusOutside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', focusOutside)
      document.removeEventListener('keydown', escape)
    }
  }, [open, onOpenChange])

  return <div className="header-disclosure header-appearance" ref={rootRef}>
    <button ref={triggerRef} type="button" className="header-action appearance-trigger" aria-label={`Appearance, ${current.label}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId} title={`Appearance · ${current.label}`} onClick={() => onOpenChange(!open)}><CurrentIcon size="1.125rem" aria-hidden="true" /></button>
    {open && <section id={panelId} className="header-popover appearance-sheet" role="dialog" aria-label="Appearance">
      <div className="header-popover-heading"><div><strong>Appearance</strong><span>{appearance.scheme === 'dark' ? 'Dark' : 'Light'} now · {current.label}</span></div></div>
      <div className="header-appearance-options" role="radiogroup" aria-label="Color mode">
        {(Object.entries(modeDetails) as [keyof typeof modeDetails, typeof modeDetails[keyof typeof modeDetails]][]).map(([mode, detail]) => {
          const Icon = detail.Icon
          const selected = appearance.mode === mode
          return <button key={mode} type="button" role="radio" aria-checked={selected} className={selected ? 'is-selected' : ''} onClick={() => { appearance.setMode(mode); close(true) }}><Icon size="1rem" aria-hidden="true" /><span>{detail.label}</span></button>
        })}
      </div>
      {!appearance.storageAvailable && <p className="header-appearance-warning" role="status">Not saved · this choice lasts for this session.</p>}
      <Link to="/settings#appearance" onClick={() => close(false)}>More appearance settings</Link>
    </section>}
  </div>
}

export function AppHeader({ account, appearance, storageAvailable, onCompose, onSignOut, unread, updateReady, online, artworkVisible = false, titlebar }: { account: AccountController; appearance: AppearanceController; storageAvailable: boolean; onCompose: () => void; onSignOut: () => Promise<void>; unread: number; updateReady: boolean; online: boolean; artworkVisible?: boolean; titlebar?: ReactNode }) {
  const ref = useChromeHeight<HTMLElement>('--topbar-height')
  const [openMenu, setOpenMenu] = useState<'appearance' | 'more' | null>(null)
  const setAppearanceOpen = (open: boolean) => setOpenMenu(open ? 'appearance' : null)
  const setMoreOpen = (open: boolean) => setOpenMenu(open ? 'more' : null)

  return <header ref={ref} className={`topbar ${artworkVisible ? 'has-backdrop' : ''}`}>
    {titlebar}
    <div className="topbar-inner">
      <Link to="/" className="app-brand" aria-label="Kanso Pro home">
        <span className="brand-mark"><KansoMark /></span>
        <span className="brand-copy"><span className="brand-name">Kanso <span>Pro</span></span><span className="brand-context">Your personal planning space</span></span>
        {!online && <span className="offline-badge" title="Your plans are still saved on this device"><WifiOff size="0.75rem" aria-hidden="true" /><span className="sr-only">Offline. </span>Offline</span>}
      </Link>
      <div className="topbar-actions">
        <HeaderAppearance appearance={appearance} open={openMenu === 'appearance'} onOpenChange={setAppearanceOpen} />
        <NavLink to="/notifications" onClick={event => { if (!confirmNotificationNavigation(event)) event.preventDefault(); else setOpenMenu(null) }} className="notification-bell header-action" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} title="Notifications"><Bell size="1.125rem" aria-hidden="true" />{unread > 0 && <span className="notification-count" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}</NavLink>
        <MoreMenu open={openMenu === 'more'} onOpenChange={setMoreOpen} updateReady={updateReady} account={account} storageAvailable={storageAvailable} onCompose={onCompose} onSignOut={onSignOut} />
      </div>
    </div>
  </header>
}
