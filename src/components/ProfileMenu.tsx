import { ArrowRight, LogIn, LogOut, Menu, Settings2, ShieldCheck, UserRound, UserRoundPlus } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { accountName } from '../lib/account'
import type { AccountController } from '../lib/useAccount'
import { AccountAvatar } from './AccountAvatar'

/**
 * One compact disclosure for actions that do not belong in the primary navigation.
 * It intentionally keeps real links and buttons rather than pretending to be an
 * ARIA application menu, so browser affordances and ordinary tab navigation work.
 */
export function MoreMenu({ account, storageAvailable, onSignOut, open, onOpenChange, updateReady = false }: {
  account: AccountController
  storageAvailable: boolean
  onSignOut: () => Promise<void>
  open: boolean
  onOpenChange: (open: boolean) => void
  updateReady?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelHadFocus = useRef(false)
  const panelId = useId()
  const location = useLocation()
  const { user, phase, busy } = account
  const identity = JSON.stringify([phase, user?.uid, user?.displayName, user?.email, user?.photoURL, user?.emailVerified])
  const previous = useRef({ route: location.key, identity })
  const status = user ? 'Personal · Signed in' : phase === 'loading' ? 'Checking account…' : phase === 'error' ? 'Sign-in unavailable' : 'Personal · Guest'

  const close = (returnFocus = false) => {
    panelHadFocus.current = false
    onOpenChange(false)
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true })
  }

  useLayoutEffect(() => {
    const last = previous.current
    if (last.route !== location.key || last.identity !== identity) {
      // RouteEffects handles navigation focus. For a background account change,
      // do not leave focus on a disclosure item that React has just removed.
      if (last.route === location.key && (panelHadFocus.current || panelRef.current?.contains(document.activeElement))) triggerRef.current?.focus({ preventScroll: true })
      panelHadFocus.current = false
      onOpenChange(false)
    }
    previous.current = { route: location.key, identity }
  }, [location.key, identity, onOpenChange])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        const shouldRestoreFocus = !!panelRef.current?.contains(document.activeElement)
        close(shouldRestoreFocus)
      }
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

  return <div className="more-menu profile-menu" ref={rootRef}>
    <button ref={triggerRef} type="button" className="header-action more-trigger" aria-label="More" aria-expanded={open} aria-controls={panelId} title="More" onClick={() => onOpenChange(!open)}>
      <Menu size="1.125rem" aria-hidden="true" /><span className="more-trigger-label">More</span>
    </button>
    {open && <div ref={panelRef} id={panelId} className="more-panel profile-panel" onFocusCapture={() => { panelHadFocus.current = true }} onBlurCapture={(event) => {
      // Remember focus before a background account update removes a panel link.
      if (event.relatedTarget instanceof Node) panelHadFocus.current = event.currentTarget.contains(event.relatedTarget)
    }}>
      <div className="profile-panel-identity"><AccountAvatar user={user} className="workspace-avatar" /><div><strong>{user ? accountName(user) : 'Your personal workspace'}</strong>{user?.email && <span>{user.email}</span>}<small>{status}</small></div></div>
      {!user && <p className="profile-device-status">{storageAvailable ? 'Your plans are saved in this browser.' : 'Session only · device storage is unavailable.'}</p>}
      <nav aria-label="More" className="profile-links">
        {user ? <NavLink to="/account" end onClick={() => close(false)}><UserRound size="1.125rem" aria-hidden="true" /><span>User Profile</span><ArrowRight size="0.875rem" aria-hidden="true" /></NavLink> : <>
          <NavLink to="/sign-in" end onClick={() => close(false)}><LogIn size="1.125rem" aria-hidden="true" /><span>Sign in</span><ArrowRight size="0.875rem" aria-hidden="true" /></NavLink>
          <NavLink to="/sign-in?mode=create" onClick={() => close(false)}><UserRoundPlus size="1.125rem" aria-hidden="true" /><span>Create account</span><ArrowRight size="0.875rem" aria-hidden="true" /></NavLink>
        </>}
        <NavLink to="/settings" end onClick={() => close(false)}><Settings2 size="1.125rem" aria-hidden="true" /><span>Settings</span>{updateReady && <span className="update-badge" aria-hidden="true">Update</span>}<ArrowRight size="0.875rem" aria-hidden="true" /></NavLink>
      </nav>
      {user && <div className="profile-sign-out"><button type="button" disabled={phase !== 'ready' || busy !== null} onClick={() => { close(true); void onSignOut() }}><LogOut size="1.0625rem" aria-hidden="true" /><span>{busy === 'sign-out' ? 'Signing out…' : 'Sign out'}</span></button></div>}
      <p className="profile-local-note"><ShieldCheck size="0.875rem" aria-hidden="true" /><span>Cards stay in this browser. Online sync requires a Google-authenticated session and never locks local plans on a shared device.</span></p>
    </div>}
  </div>
}

/** @deprecated Kept as a source-compatible alias for integrations that imported it. */
export const ProfileMenu = MoreMenu
