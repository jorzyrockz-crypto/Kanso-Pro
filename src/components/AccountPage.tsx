import { ArrowRight, BadgeCheck, Check, Download, HardDrive, KeyRound, LoaderCircle, LogOut, Mail, RefreshCw, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { JourneyState } from '../types'
import { accountError, accountInitials, accountMode, accountName } from '../lib/account'
import type { AccountController } from '../lib/useAccount'
import { SaveIndicator } from './Common'
import { PageHeader } from './PageHeader'
import { SignInPage } from './SignInPage'

type Feedback = { kind: 'error' | 'success'; message: string } | null

/** Keep account action feedback alive while switching between entry and profile pages. */
export function AccountPage({ account, state, storageAvailable }: { account: AccountController; state: JourneyState; storageAvailable: boolean }) {
  const [query] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const mode = accountMode(query.get('mode'))
  const [profileName, setProfileName] = useState('')
  const [feedback, setFeedback] = useState<Feedback>(null)
  const feedbackRef = useRef<HTMLParagraphElement>(null)
  const { user, busy } = account
  const disabled = account.phase !== 'ready' || busy !== null

  useEffect(() => { setProfileName(user?.displayName ?? '') }, [user?.uid, user?.displayName])
  // Changing auth modes clears old feedback, but a successful sign-in must retain it.
  useEffect(() => { if (!user) setFeedback(null) }, [mode])
  useEffect(() => { if (feedback?.kind === 'error') feedbackRef.current?.focus() }, [feedback])
  useLayoutEffect(() => {
    if (account.phase === 'loading') return
    // A Link can update browser history before React commits the new route.
    // Never let an older account redirect replace a more recent user navigation.
    if (`${location.pathname}${location.search}${location.hash}` !== `${window.location.pathname}${window.location.search}${window.location.hash}`) return
    const pathname = user ? '/account' : '/sign-in'
    if (location.pathname.replace(/\/+$/, '').toLowerCase() === pathname) return
    const search = !user && mode !== 'sign-in' ? `?mode=${mode}` : ''
    // Normalize before painting an interactive form, with no extra Back-history step.
    navigate({ pathname, search }, { replace: true })
  }, [account.phase, user, mode, location.pathname, location.search, location.hash, navigate])

  const perform = async (action: () => Promise<unknown>, success: string) => {
    setFeedback(null)
    try {
      await action()
      setFeedback({ kind: 'success', message: success })
    } catch (error) {
      setFeedback({ kind: 'error', message: accountError(error) })
    }
  }
  const exportWorkspace = () => {
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `kanso-pro-journey-${new Date().toISOString().slice(0, 10)}.json`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setFeedback({ kind: 'success', message: 'Your device workspace backup is ready. Keep the downloaded file somewhere private.' })
    } catch {
      setFeedback({ kind: 'error', message: 'We could not download the backup in this browser. Your workspace is unchanged.' })
    }
  }
  const notices = <>
    {account.phase === 'loading' && <p className="account-loading" role="status"><LoaderCircle size={15} />Checking your sign-in… Your plans are still available.</p>}
    {account.phase === 'error' && <div className="account-connection-error" role="alert"><p>{account.initializationError}</p><button className="button button-soft" onClick={account.retry}>Retry connection<RefreshCw size={14} /></button></div>}
    {feedback && <p ref={feedbackRef} tabIndex={-1} className={`account-feedback ${feedback.kind === 'error' ? 'is-error' : ''}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.kind === 'success' && <Check size={15} />}{feedback.message}</p>}
  </>
  const deviceWorkspace = <aside className="account-device-panel" aria-labelledby="device-workspace-title">
    <span className="account-device-icon"><HardDrive size={23} /></span><span className="eyebrow">Your device workspace</span><h2 id="device-workspace-title">A little room for your plans.</h2>
    <p>These cards live in this browser, whether you’re a guest or signed in.</p>
    <div className="account-device-stats">{([['event', 'Events'], ['task', 'Task lists'], ['project', 'Projects'], ['note', 'Notes']] as const).map(([type, label]) => <div key={type}><strong>{state.cards.filter((card) => card.type === type).length}</strong><span>{label}</span></div>)}</div>
    <div className="account-device-save"><SaveIndicator available={storageAvailable} /><span>{state.cards.length} cards in this browser</span></div>
    <div className="account-local-notice"><ShieldCheck size={17} /><div><strong>Sign-in is not cloud sync.</strong><p>Signing in or out does not upload, transfer, hide, or delete these cards. Anyone using this browser profile can access them. Use a separate browser profile on shared devices.</p></div></div>
    <button className="button account-export" onClick={exportWorkspace}><Download size={15} />Export device backup</button>
    <p className="account-backup-note">A JSON copy of all card content. Keep the file private. It does not contain your sign-in tokens or password.</p>
    {user && <Link className="button button-soft account-continue" to="/">Back to your timeline<ArrowRight size={14} /></Link>}
  </aside>

  if (!user) return <SignInPage account={account} mode={mode} notices={notices} deviceWorkspace={deviceWorkspace} onAction={perform} />

  return <main id="main-content" tabIndex={-1} className="workspace-page account-page" aria-labelledby="page-title">
    <PageHeader title="My workspace" breadcrumb="Account & workspace" description="Your personal account, and the plans you’re making room for." />
    <div className="account-layout">
      <section className="account-card" aria-labelledby="account-title">
        <div className="account-card-heading"><span className="account-heading-icon"><UserRound size={22} /></span><span className="eyebrow">Personal account</span></div>
        <h2 id="account-title">Good to have you here.</h2>
        <p className="account-intro">Manage your identity and how you sign in.</p>
        {notices}
        <div className="account-identity"><span className="account-large-avatar" aria-hidden="true">{accountInitials(user)}</span><div><strong>{accountName(user)}</strong><span>{user.email ?? 'Firebase account'}</span><small>{user.providers.includes('google.com') ? 'Google' : 'Email & password'}{user.providers.includes('google.com') && user.providers.includes('password') && ' · Email & password'}</small></div></div>
        <div className={`account-verification ${user.emailVerified ? 'is-verified' : ''}`}>
          <div><BadgeCheck size={17} /><span><strong>{user.emailVerified ? 'Email verified' : 'Verify your email'}</strong><small>{user.emailVerified ? 'Your email address is confirmed.' : 'Open the verification email, then check your status here.'}</small></span></div>
          {!user.emailVerified && <div className="account-inline-actions"><button className="button button-soft" disabled={disabled} onClick={() => void perform(account.sendVerification, 'Verification email sent. Open the link in your inbox, then choose Check verification.')}>{busy === 'verify' ? 'Sending…' : 'Send verification email'}<Mail size={13} /></button><button className="button button-quiet" disabled={disabled} onClick={() => void perform(account.refresh, 'Your verification status has been refreshed.')}>{busy === 'refresh' ? 'Checking…' : 'Check verification'}<RefreshCw size={13} /></button></div>}
        </div>
        <form className="account-form account-profile-form" method="post" aria-label="Profile details" aria-busy={!!busy} onSubmit={(event) => { event.preventDefault(); if (!disabled) void perform(() => account.saveName(profileName), 'Your display name has been saved to your account.') }}>
          <h3>Profile details</h3><div className="form-field"><label htmlFor="profile-name">Display name</label><input id="profile-name" name="displayName" autoComplete="name" required maxLength={80} value={profileName} disabled={disabled} onChange={(event) => setProfileName(event.target.value)} /></div>
          <p className="account-field-hint">This name appears in your account badge. It does not rename existing cards.</p>
          <button className="button button-dark" disabled={disabled || profileName.trim() === (user.displayName ?? '').trim()} type="submit">{busy === 'save-name' ? 'Saving…' : 'Save profile'}<Check size={14} /></button>
        </form>
        <div className="account-security"><h3>Sign-in & security</h3><p>Your sign-in stays on this browser when site storage is available. Use a trusted browser profile and sign out on shared devices.</p>
          <div className="account-inline-actions">{user.providers.includes('password') && user.email && <button className="button button-quiet" disabled={disabled} onClick={() => void perform(() => account.resetPassword(user.email!), 'If an account exists for that email, password reset instructions have been sent.')}><KeyRound size={14} />{busy === 'reset' ? 'Sending…' : 'Email a password reset'}</button>}
            <button className="button account-sign-out" disabled={disabled} onClick={() => void perform(account.signOut, 'You’re signed out. Your device plans are still here.')}><LogOut size={14} />{busy === 'sign-out' ? 'Signing out…' : 'Sign out'}</button></div>
        </div>
      </section>
      {deviceWorkspace}
    </div>
  </main>
}
