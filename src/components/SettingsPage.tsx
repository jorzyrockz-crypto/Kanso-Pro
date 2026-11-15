import { ArrowLeft, ArrowRight, BadgeCheck, BookOpen, Check, Download, ExternalLink, HardDrive, Info, Laptop, Mail, Palette, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { version } from '../../package.json'
import type { JourneyState } from '../types'
import { accountInitials, accountName } from '../lib/account'
import { SETTINGS_SECTIONS } from '../lib/navigation'
import { monthScene } from '../lib/months'
import type { AccountController } from '../lib/useAccount'
import { useCurrentMonth } from '../lib/useCurrentMonth'
import { BACKUP_FAILED, BACKUP_READY, downloadWorkspaceBackup } from '../lib/workspaceBackup'
import { DeviceWorkspaceSummary } from './DeviceWorkspace'
import { MonthArtwork, monthPalette } from './MonthArtwork'
import { PageHeader } from './PageHeader'
import { SaveIndicator } from './Common'
import { KansoMark } from './AppHeader'

const icons = { account: UserRound, appearance: Palette, workspace: HardDrive, privacy: ShieldCheck, about: Info }
const repository = 'https://github.com/jorzyrockz-crypto/Kanso-Pro'
const sourceRef = __APP_SOURCE_REF__.split('/').map(encodeURIComponent).join('/')
const docs = `${repository}/blob/${sourceRef}`

function SettingsSection({ id, title, description, children }: { id: typeof SETTINGS_SECTIONS[number]['id']; title: string; description: string; children: ReactNode }) {
  const Icon = icons[id]
  return <section id={id} tabIndex={-1} className={`settings-section settings-${id}`} aria-labelledby={`settings-${id}-title`}>
    <div className="settings-section-heading"><span className="settings-section-icon"><Icon size={20} aria-hidden="true" /></span><div><h2 id={`settings-${id}-title`}>{title}</h2><p>{description}</p></div></div>
    {children}
  </section>
}

export function SettingsPage({ account, state, storageAvailable, onToggleFrame }: { account: AccountController; state: JourneyState; storageAvailable: boolean; onToggleFrame: () => void }) {
  const { user, phase } = account
  const { hash } = useLocation()
  const month = useCurrentMonth()
  const scene = monthScene(month)
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null)
  const feedbackRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => { if (feedback?.error) feedbackRef.current?.focus() }, [feedback])
  const exportWorkspace = () => {
    try {
      downloadWorkspaceBackup(state)
      setFeedback({ error: false, message: BACKUP_READY })
    } catch {
      setFeedback({ error: true, message: BACKUP_FAILED })
    }
  }

  return <main id="main-content" tabIndex={-1} className="workspace-page settings-page" aria-labelledby="page-title">
    <PageHeader title="Settings" breadcrumb="Profile & settings" description="A few thoughtful details, to make this space feel like yours." action={<Link className="button settings-back" to="/"><ArrowLeft size={14} aria-hidden="true" />Back to workspace</Link>} />
    <div className="settings-layout">
      <aside className="settings-sidebar">
        <span className="eyebrow">Your space</span>
        <nav aria-label="Settings sections">{SETTINGS_SECTIONS.map(({ id, label }) => {
          const Icon = icons[id]
          return <Link key={id} to={`#${id}`} aria-current={hash === `#${id}` || (!hash && id === 'account') ? 'location' : undefined}><Icon size={18} aria-hidden="true" /><span>{label}</span></Link>
        })}</nav>
        <div className="settings-device-note"><Laptop size={20} aria-hidden="true" /><strong>A little space. On this device.</strong><p>Device preferences and cards are shared within this browser profile.</p></div>
      </aside>
      <div className="settings-content">
        <SettingsSection id="account" title="Profile & account" description="Your identity, separate from the plans on this device.">
          <div className="settings-identity"><span className="account-large-avatar" aria-hidden="true">{accountInitials(user)}</span><div><strong>{user ? accountName(user) : 'Make yourself at home.'}</strong><span>{user?.email ?? 'You can keep planning without an account.'}</span><small className="settings-status">{user ? <><BadgeCheck size={13} aria-hidden="true" />Signed in{user.emailVerified ? ' · Email verified' : ' · Email not yet verified'}</> : phase === 'loading' ? 'Checking account…' : phase === 'error' ? 'Account connection unavailable' : 'Guest workspace'}</small></div></div>
          {phase === 'loading' && <p className="settings-connection-note" role="status">Checking your sign-in. Your device settings are ready to use.</p>}
          {phase === 'error' && <div className="settings-connection-note" role="status"><p>{account.initializationError} Your local settings remain available.</p><button type="button" className="button settings-secondary" onClick={account.retry}>Retry account connection</button></div>}
          <div className="settings-account-actions">{user ? <><p>Manage your display name, email verification, and sign-in security in your account.</p><Link className="button settings-primary" to="/account">Manage account<ArrowRight size={14} aria-hidden="true" /></Link></> : <><p>Sign in to manage your identity. It won’t upload or lock the cards in this browser.</p><div><Link className="button settings-primary" to="/sign-in">Sign in<ArrowRight size={14} aria-hidden="true" /></Link><Link className="button settings-secondary" to="/sign-in?mode=create">Create account</Link></div></>}</div>
        </SettingsSection>

        <SettingsSection id="appearance" title="Appearance" description="A familiar place, with room for a little personality.">
          <label className="settings-preference" htmlFor="settings-tablet-frame"><span><strong id="settings-frame-label">Tablet frame</strong><span id="settings-frame-hint">Add a device-style bezel around your Timeline. Your cards and other pages stay the same.</span></span><span className="settings-switch"><input id="settings-tablet-frame" type="checkbox" role="switch" checked={state.bezel} onChange={onToggleFrame} aria-labelledby="settings-frame-label" aria-describedby="settings-frame-hint" /><span className="settings-switch-track" aria-hidden="true" /></span></label>
          <div className="settings-preference-status"><SaveIndicator available={storageAvailable} /><span>Also available from the Timeline toolbar</span></div>
          <div className="settings-month-preview" data-settings-month={month} style={monthPalette(scene)}><div><span className="settings-month-label"><Sparkles size={13} aria-hidden="true" />Automatic · {scene.name} {month.slice(0, 4)}</span><h3>{scene.title}.</h3><p>Sign-in follows your device’s current month. Timeline and Calendar follow the month you’re viewing.</p></div><MonthArtwork month={month} side="right" className="settings-month-art" /></div>
        </SettingsSection>

        <SettingsSection id="workspace" title="Device workspace & backup" description="Your plans live here. Keep a copy somewhere you trust.">
          <DeviceWorkspaceSummary state={state} storageAvailable={storageAvailable} />
          <div className="settings-backup-row"><div><strong>A copy of your whole journey.</strong><p>Events, task lists, projects, notes, and your Tablet frame preference.</p></div><button className="button settings-secondary" type="button" onClick={exportWorkspace}><Download size={15} aria-hidden="true" />Export device backup</button></div>
          <p className="settings-caption">Downloads a JSON file without sign-in tokens or passwords. Keep it private. This is not cloud sync, and we can’t verify where you save the file.</p>
          {feedback && <p ref={feedbackRef} tabIndex={-1} className={`account-feedback settings-backup-feedback ${feedback.error ? 'is-error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{!feedback.error && <Check size={15} aria-hidden="true" />}{feedback.message}</p>}
        </SettingsSection>

        <SettingsSection id="privacy" title="Privacy & storage" description="A clear picture of what stays here, and what signing in does.">
          <div className="settings-privacy-callout"><ShieldCheck size={22} aria-hidden="true" /><div><strong>Local does not mean locked.</strong><p>Anyone using this browser profile can access its cards, even while signed out. Use a separate browser profile on shared devices.</p></div></div>
          <dl className="settings-data-list">
            <div><dt><HardDrive size={16} aria-hidden="true" />Saved in this browser</dt><dd>Your cards, edits, and Tablet frame preference. Clearing site data can erase them. When storage is blocked, changes last only for the session.</dd></div>
            <div><dt><Mail size={16} aria-hidden="true" />Your account & session</dt><dd>Firebase manages your identity and sign-in session separately. Signing in or out does not upload, transfer, hide, delete, or separate your cards by account.</dd></div>
            <div><dt><Laptop size={16} aria-hidden="true" />A different device or address</dt><dd>A new browser profile, device, or website address has its own workspace. Export important plans before changing hosts; signing in does not move them.</dd></div>
          </dl>
          <p className="settings-privacy-footer"><Check size={14} aria-hidden="true" />Analytics is not initialized. No workspace cards are uploaded.</p>
        </SettingsSection>

        <SettingsSection id="about" title="About & help" description="A little structure. A lot of possibility.">
          <div className="settings-about-brand"><span className="brand-mark"><KansoMark /></span><div><strong>Kanso Pro</strong><span>Version {version} · Your personal planning space</span></div></div>
          <p className="settings-caption">Use the bottom bar to move between your five planning pages. New card adds an event, task list, project, or note to your journey.</p>
          <div className="settings-help-links"><a href={`${docs}/README.md`} target="_blank" rel="noopener noreferrer"><BookOpen size={18} aria-hidden="true" /><span>Usage guide</span><ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a><a href={`${docs}/docs/firebase-setup.md`} target="_blank" rel="noopener noreferrer"><ShieldCheck size={18} aria-hidden="true" /><span>Account setup guide</span><ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a><a href={`${repository}/tree/${sourceRef}`} target="_blank" rel="noopener noreferrer"><Info size={18} aria-hidden="true" /><span>Source code</span><ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a></div>
          <p className="settings-caption">Help and source links open the project documentation in a new tab.</p>
        </SettingsSection>
      </div>
    </div>
  </main>
}
