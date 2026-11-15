import { ArrowLeft, ArrowRight, ChevronDown, Eye, EyeOff, HardDrive, LoaderCircle, LogIn, Mail, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AccountMode } from '../lib/account'
import type { AccountController } from '../lib/useAccount'
import { monthScene } from '../lib/months'
import { useCurrentMonth } from '../lib/useCurrentMonth'
import { useChromeHeight } from '../lib/useChromeHeight'
import { KansoMark } from './AppHeader'
import { MonthArtwork, MonthBackdrop, monthPalette } from './MonthArtwork'

function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4c-.2 1.3-1 2.4-2 3.1v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z" /><path fill="#34a853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.9-1.8-5.7-4.2H2.9v2.6A10 10 0 0 0 12 22Z" /><path fill="#fbbc05" d="M6.3 13.8a6 6 0 0 1 0-3.6V7.6H2.9a10 10 0 0 0 0 8.8Z" /><path fill="#ea4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9.1 5.6l3.4 2.6A6 6 0 0 1 12 6Z" /></svg>
}

/** A quiet entry point, separate from the signed-in account/workspace dashboard. */
export function SignInHeader() {
  const ref = useChromeHeight<HTMLElement>('--topbar-height')
  return <header ref={ref} className="sign-in-header">
    <div className="sign-in-header-inner">
      <Link to="/" className="app-brand" aria-label="Kanso Pro home"><span className="brand-mark"><KansoMark /></span><span className="brand-name">Kanso <span>Pro</span></span></Link>
      <Link to="/" className="sign-in-back"><ArrowLeft size={15} /><span>Back to workspace</span></Link>
    </div>
  </header>
}

export function SignInPage({ account, mode, notices, deviceWorkspace, onAction }: {
  account: AccountController
  mode: AccountMode
  notices: ReactNode
  deviceWorkspace: ReactNode
  onAction: (action: () => Promise<unknown>, success: string) => Promise<void>
}) {
  const month = useCurrentMonth()
  const scene = monthScene(month)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { busy } = account
  const disabled = account.phase !== 'ready' || busy !== null
  const title = mode === 'create' ? 'Make yourself at home.' : mode === 'reset' ? 'Let’s get you back in.' : 'Welcome back.'
  const description = mode === 'create' ? 'A little space for your plans, projects, and everyday possibilities.' : mode === 'reset' ? 'Enter your email and we’ll send a secure password reset link.' : 'Your plans, your pace. Sign in to Kanso Pro.'

  useEffect(() => { setPassword(''); setShowPassword(false) }, [mode])
  const perform = async (action: () => Promise<unknown>, success: string) => {
    try { await onAction(action, success) }
    finally { setPassword(''); setShowPassword(false) }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (disabled) return
    if (mode === 'create') void perform(() => account.create(name, email, password), 'Your account is ready. Your existing device plans are still here.')
    else if (mode === 'reset') void perform(() => account.resetPassword(email), 'If an account exists for that email, password reset instructions have been sent. Follow the email link, then return here to sign in.')
    else void perform(() => account.signIn(email, password), 'You’re signed in. Welcome back.')
  }

  return <main id="main-content" tabIndex={-1} className="sign-in-page" aria-labelledby="page-title" data-sign-in-month={month} style={monthPalette(scene)}>
    <MonthBackdrop month={month} view="sign-in" />
    <div className="sign-in-layout">
      <div className="sign-in-story">
        <span className="sign-in-month"><span aria-hidden="true" />{scene.name} {month.slice(0, 4)}</span>
        <div className="sign-in-illustration" aria-hidden="true"><span className="sign-in-art-wash" /><MonthArtwork month={month} side="right" className="sign-in-hero-art" /></div>
        <p className="sign-in-season-title">{scene.title}<span aria-hidden="true">.</span></p>
        <p className="sign-in-story-copy">A little structure.<br />{' '}A lot of possibility.</p>
        <p className="sign-in-season-note">A fresh backdrop for every month.<br />A familiar place to begin again.</p>
      </div>
      <div className="sign-in-form-column">
        <section className="account-card sign-in-card" aria-labelledby="page-title">
          <span className="sign-in-eyebrow"><KansoMark size={16} />Your personal workspace</span>
          <h1 id="page-title">{title}</h1><p className="account-intro">{description}</p>
          {notices}
          {mode !== 'reset' && <nav className="account-modes" aria-label="Account options"><Link to="/sign-in" aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} onClick={(event) => { if (disabled) event.preventDefault() }} aria-current={mode === 'sign-in' ? 'page' : undefined}>Sign in</Link><Link to="/sign-in?mode=create" aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} onClick={(event) => { if (disabled) event.preventDefault() }} aria-current={mode === 'create' ? 'page' : undefined}>Create account</Link></nav>}
          <form className="account-form" method="post" aria-label={mode === 'create' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in with email'} aria-busy={!!busy} onSubmit={submit}>
            {mode === 'create' && <div className="form-field"><label htmlFor="signup-name">Display name</label><input id="signup-name" name="displayName" autoComplete="name" required maxLength={80} disabled={disabled} value={name} onChange={(event) => setName(event.target.value)} placeholder="What should we call you?" /></div>}
            <div className="form-field"><label htmlFor="account-email">Email address</label><input id="account-email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} disabled={disabled} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div>
            {mode !== 'reset' && <div className="form-field"><label htmlFor="account-password">Password</label><div className="account-password-field"><input id="account-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} required minLength={mode === 'create' ? 8 : undefined} maxLength={4096} disabled={disabled} value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby={mode === 'create' ? 'password-hint' : undefined} /><button type="button" className="account-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} disabled={disabled} onClick={() => setShowPassword((current) => !current)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{mode === 'create' && <p id="password-hint" className="account-field-hint">At least 8 characters. A unique passphrase is a good start.</p>}</div>}
            {mode === 'sign-in' && <Link className="account-forgot" to="/sign-in?mode=reset" aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} onClick={(event) => { if (disabled) event.preventDefault() }}>Forgot your password?</Link>}
            <button className="button button-dark account-submit" type="submit" disabled={disabled}>{busy && busy !== 'google' ? <><LoaderCircle size={15} />Working securely…</> : mode === 'create' ? <>Create account<ArrowRight size={15} /></> : mode === 'reset' ? <>Send reset email<Mail size={15} /></> : <>Sign in<LogIn size={15} /></>}</button>
          </form>
          {mode === 'reset' ? <Link className="account-return" to="/sign-in" aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} onClick={(event) => { if (disabled) event.preventDefault() }}>Back to sign in<ArrowRight size={13} /></Link> : <>
            <div className="account-divider"><span />or<span /></div>
            <button type="button" className="button account-google" disabled={disabled} onClick={() => void perform(account.google, 'You’re signed in with Google. Welcome back.')}><GoogleMark />{busy === 'google' ? 'Opening Google…' : 'Continue with Google'}</button>
          </>}
          <p className="account-auth-note"><ShieldCheck size={14} />Secure sign-in with Firebase. Your password is never saved in your workspace.</p>
        </section>
        <div className="sign-in-guest"><span>Just looking for a little focus?</span><Link to="/">Continue as guest<ArrowRight size={14} /></Link></div>
        <p className="sign-in-local-note">Cards stay in this browser. Sign-in does not add cloud sync or hide cards on shared devices.</p>
        <details className="sign-in-device"><summary><HardDrive size={14} /><span>Your device workspace & backup</span><ChevronDown size={14} /></summary>{deviceWorkspace}</details>
      </div>
    </div>
  </main>
}
