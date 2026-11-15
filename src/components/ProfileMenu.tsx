import { ArrowRight, ChevronDown, LogIn, LogOut, Settings2, ShieldCheck, UserRound, UserRoundPlus } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { accountInitials, accountName } from '../lib/account'
import type { AccountController } from '../lib/useAccount'

/** A navigation disclosure, not an ARIA application menu or a modal. */
export function ProfileMenu({ account, storageAvailable, onSignOut }: {
  account: AccountController
  storageAvailable: boolean
  onSignOut: () => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelHadFocus = useRef(false)
  const panelId = useId()
  const location = useLocation()
  const { user, phase, busy } = account
  const identity = JSON.stringify([phase, user?.uid, user?.displayName, user?.email, user?.emailVerified])
  const previous = useRef({ route: location.key, identity })
  const active = /^\/(account|settings)\/?$/i.test(location.pathname)
  const status = user ? 'Personal · Signed in' : phase === 'loading' ? 'Checking account…' : phase === 'error' ? 'Sign-in unavailable' : 'Personal · Guest'
  const close = () => {
    panelHadFocus.current = false
    setExpanded(false)
    triggerRef.current?.focus({ preventScroll: true })
  }

  useLayoutEffect(() => {
    const last = previous.current
    if (last.route !== location.key || last.identity !== identity) {
      // RouteEffects handles navigation focus. A background account change should
      // not leave focus on a removed menu link, but must not steal it from the page.
      if (last.route === location.key && (panelHadFocus.current || panelRef.current?.contains(document.activeElement))) triggerRef.current?.focus({ preventScroll: true })
      panelHadFocus.current = false
      setExpanded(false)
    }
    previous.current = { route: location.key, identity }
  }, [location.key, identity])

  useEffect(() => {
    if (!expanded) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        if (panelRef.current?.contains(document.activeElement)) triggerRef.current?.focus({ preventScroll: true })
        panelHadFocus.current = false
        setExpanded(false)
      }
    }
    const focusOutside = (event: FocusEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        panelHadFocus.current = false
        setExpanded(false)
      }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        panelHadFocus.current = false
        setExpanded(false)
        triggerRef.current?.focus({ preventScroll: true })
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
  }, [expanded])

  return <div className="profile-menu" ref={rootRef}>
    <button ref={triggerRef} type="button" className={`personal-workspace profile-trigger ${active ? 'is-active' : ''}`} aria-label="Profile menu" aria-expanded={expanded} aria-controls={panelId} title={`Profile & settings · ${user ? accountName(user) : 'Guest'}`} onClick={() => setExpanded((open) => !open)}>
      <span className="workspace-avatar" aria-hidden="true">{accountInitials(user)}</span>
      <span className="workspace-account"><strong>{accountName(user)}</strong><small>{status}</small></span>
      <ChevronDown className="profile-chevron" size={14} aria-hidden="true" />
    </button>
    {expanded && <div ref={panelRef} id={panelId} className="profile-panel" onFocusCapture={() => { panelHadFocus.current = true }} onBlurCapture={(event) => {
      // Remember focus before an account update removes a signed-in-only link.
      // That removal can reset activeElement to body before layout effects run.
      if (event.relatedTarget instanceof Node) panelHadFocus.current = event.currentTarget.contains(event.relatedTarget)
    }}>
      <div className="profile-panel-identity"><span className="workspace-avatar" aria-hidden="true">{accountInitials(user)}</span><div><strong>{user ? accountName(user) : 'Your personal workspace'}</strong>{user?.email && <span>{user.email}</span>}<small>{status}</small></div></div>
      {!user && <p className="profile-device-status">{storageAvailable ? 'Your plans are saved in this browser.' : 'Session only · device storage is unavailable.'}</p>}
      <nav aria-label="Profile" className="profile-links">
        {user ? <NavLink to="/account" end onClick={close}><UserRound size={18} aria-hidden="true" /><span>Profile & account</span><ArrowRight size={14} aria-hidden="true" /></NavLink> : <>
          <NavLink to="/sign-in" end onClick={close}><LogIn size={18} aria-hidden="true" /><span>Sign in</span><ArrowRight size={14} aria-hidden="true" /></NavLink>
          <NavLink to="/sign-in?mode=create" onClick={close}><UserRoundPlus size={18} aria-hidden="true" /><span>Create account</span><ArrowRight size={14} aria-hidden="true" /></NavLink>
        </>}
        <NavLink to="/settings" end onClick={close}><Settings2 size={18} aria-hidden="true" /><span>Settings</span><ArrowRight size={14} aria-hidden="true" /></NavLink>
      </nav>
      {user && <div className="profile-sign-out"><button type="button" disabled={phase !== 'ready' || busy !== null} onClick={() => { close(); void onSignOut() }}><LogOut size={17} aria-hidden="true" /><span>{busy === 'sign-out' ? 'Signing out…' : 'Sign out'}</span></button></div>}
      <p className="profile-local-note"><ShieldCheck size={14} aria-hidden="true" /><span>Cards stay in this browser. Sign-in is not cloud sync or a lock on shared-device plans.</span></p>
    </div>}
  </div>
}
