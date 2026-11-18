import { ArrowLeft, ArrowRight, BadgeCheck, BookOpen, CalendarDays, Check, Download, ExternalLink, FileText, HardDrive, Info, Laptop, Mail, Palette, ShieldCheck, Sparkles, Trash2, Upload, UserRound } from 'lucide-react'
import type { ChangeEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { version } from '../../package.json'
import type { JourneyState } from '../types'
import { accountName } from '../lib/account'
import { SETTINGS_SECTIONS } from '../lib/navigation'
import { monthScene } from '../lib/months'
import type { AccountController } from '../lib/useAccount'
import { useCurrentMonth } from '../lib/useCurrentMonth'
import { BACKUP_FAILED, BACKUP_READY, downloadWorkspaceBackup } from '../lib/workspaceBackup'
import { DeviceWorkspaceSummary } from './DeviceWorkspace'
import { MonthArtwork, monthPalette } from './MonthArtwork'
import { PageHeader } from './PageHeader'
import { ColorModePicker } from './ColorModePicker'
import { GradientBackgroundPicker } from './GradientBackgroundPicker'
import { AccountAvatar } from './AccountAvatar'
import type { AppearanceController } from '../lib/useAppearance'
import { KansoMark } from './AppHeader'
import { PwaSettings } from './PwaSettings'
import type { PwaController } from '../lib/usePwa'
import type { CalendarSource, CalendarSourcesController } from '../lib/calendarSources'

const icons = { account: UserRound, appearance: Palette, calendar: CalendarDays, workspace: HardDrive, privacy: ShieldCheck, about: Info }
const repository = 'https://github.com/jorzyrockz-crypto/Kanso-Pro'
const sourceRef = __APP_SOURCE_REF__.split('/').map(encodeURIComponent).join('/')
const docs = `${repository}/blob/${sourceRef}`

function SettingsSection({ id, title, description, children }: { id: typeof SETTINGS_SECTIONS[number]['id']; title: string; description: string; children: ReactNode }) {
  const Icon = icons[id]
  return <section id={id} tabIndex={-1} className={`settings-section settings-${id}`} aria-labelledby={`settings-${id}-title`}>
    <div className="settings-section-heading"><span className="settings-section-icon"><Icon size="1.25rem" aria-hidden="true" /></span><div><h2 id={`settings-${id}-title`}>{title}</h2><p>{description}</p></div></div>
    {children}
  </section>
}

function CalendarSourceSwitch({ source, onChange }: { source: CalendarSource; onChange: (enabled: boolean) => void }) {
  const controlId = `calendar-source-${source.id}`
  const sourceSummary = source.recurringRules
    ? `${source.recurringRules.length} permanent recurring observances`
    : `${source.entries.length} ${source.imported ? 'extracted' : 'verified'} dated ${source.entries.length === 1 ? 'entry' : 'entries'}`
  return <div className="calendar-source-switch-row">
    <div><strong>{source.label}</strong><span>{sourceSummary}</span></div>
    <button type="button" id={controlId} className="ios-switch" role="switch" aria-checked={source.enabled} aria-label={`${source.enabled ? 'Hide' : 'Show'} ${source.label} in Calendar`} onClick={() => onChange(!source.enabled)}>
      <span aria-hidden="true" />
      <span className="sr-only">{source.enabled ? 'Shown in Calendar' : 'Hidden from Calendar'}</span>
    </button>
  </div>
}

function CalendarSourcesSettings({ calendarSources }: { calendarSources: CalendarSourcesController }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null)
  const depEd = calendarSources.sources.find((source) => source.id === 'deped-sy-2026-2027')
  const legislated = calendarSources.sources.find((source) => source.id === 'deped-legislated-activities')
  const localSources = calendarSources.sources.filter((source) => source.imported)

  const chooseMemo = () => inputRef.current?.click()
  const importMemo = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!file) return
    setImporting(true)
    setFeedback(null)
    try {
      const result = await calendarSources.importMemo(file)
      setFeedback({ error: false, message: result.message })
    } catch (error) {
      setFeedback({ error: true, message: error instanceof Error ? error.message : 'This memorandum could not be imported.' })
    } finally {
      setImporting(false)
    }
  }

  return <>
    {depEd && <div className="calendar-source-card calendar-source-deped">
      <div className="calendar-source-card-heading"><span className="calendar-source-mark"><CalendarDays size="1rem" aria-hidden="true" /></span><div><span className="calendar-source-kicker">Official calendar source</span><h3>DepEd Calendar · SY 2026–2027</h3></div></div>
      <p>Three-term dates from the supplied memorandum, kept separate from your personal event cards.</p>
      <CalendarSourceSwitch source={depEd} onChange={calendarSources.setDepEdEnabled} />
      <div className="calendar-source-provenance"><FileText size="0.875rem" aria-hidden="true" /><span><strong>Source:</strong> {depEd.provenance} {depEd.reference}</span></div>
    </div>}

    {legislated && <div className="calendar-source-card calendar-source-legislated">
      <div className="calendar-source-card-heading"><span className="calendar-source-mark"><CalendarDays size="1rem" aria-hidden="true" /></span><div><span className="calendar-source-kicker">Permanent calendar source</span><h3>Legislated activities & celebrations</h3></div></div>
      <p>Annual observances recur in every year you browse, while remaining separate from your plans and the school-term schedule.</p>
      <CalendarSourceSwitch source={legislated} onChange={calendarSources.setLegislatedEnabled} />
      <div className="calendar-source-provenance"><FileText size="0.875rem" aria-hidden="true" /><span><strong>Source:</strong> {legislated.provenance} {legislated.reference}</span></div>
    </div>}

    <div className="calendar-import-panel">
      <div><strong>Import a future memorandum</strong><p>Choose a local PDF to read its selectable date text in this browser. Nothing is uploaded. Kanso keeps only the extracted dated entries and the file name—not the PDF itself.</p></div>
      <input ref={inputRef} className="sr-only" type="file" accept="application/pdf,.pdf" aria-label="Choose a local PDF memorandum" onChange={importMemo} />
      <button type="button" className="button settings-secondary" onClick={chooseMemo} disabled={importing}><Upload size="0.9375rem" aria-hidden="true" />{importing ? 'Reading PDF locally…' : 'Choose local PDF'}</button>
    </div>
    <p className="calendar-import-note"><ShieldCheck size="0.8125rem" aria-hidden="true" />Image-only scans need a text-accessible PDF; browser reading does not send your document to an OCR or cloud service.</p>
    {feedback && <p className={`account-feedback calendar-import-feedback ${feedback.error ? 'is-error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{!feedback.error && <Check size="0.9375rem" aria-hidden="true" />}{feedback.message}</p>}

    {localSources.length > 0 && <div className="local-calendar-sources" aria-label="Imported calendar sources">{localSources.map((source) => <div key={source.id} className="local-calendar-source">
      <CalendarSourceSwitch source={source} onChange={(enabled) => calendarSources.setSourceEnabled(source.id, enabled)} />
      <p>{source.provenance}</p>
      <button type="button" className="text-button calendar-source-remove" onClick={() => calendarSources.removeSource(source.id)}><Trash2 size="0.75rem" aria-hidden="true" />Remove source</button>
    </div>)}</div>}
    <p className="settings-preference-status"><span>{calendarSources.storageAvailable ? 'Calendar-source choices stay only in this browser.' : 'Browser storage is unavailable; source choices will last only for this session.'}</span></p>
  </>
}

export function SettingsPage({ account, state, storageAvailable, appearance, pwa, calendarSources, onOpenAbout }: { account: AccountController; state: JourneyState; storageAvailable: boolean; appearance: AppearanceController; pwa: PwaController; calendarSources: CalendarSourcesController; onOpenAbout: () => void }) {
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
    <PageHeader title="Settings" breadcrumb="User Profile & settings" description="A few thoughtful details, to make this space feel like yours." action={<Link className="button settings-back" to="/"><ArrowLeft size="0.875rem" aria-hidden="true" />Back to workspace</Link>} />
    <div className="settings-layout">
      <aside className="settings-sidebar">
        <span className="eyebrow">Your space</span>
        <nav aria-label="Settings sections">{SETTINGS_SECTIONS.map(({ id, label }) => {
          const Icon = icons[id]
          return <Link key={id} to={`#${id}`} aria-current={hash === `#${id}` || (!hash && id === 'account') ? 'location' : undefined}><Icon size="1.125rem" aria-hidden="true" /><span>{label}</span>{id === 'about' && pwa.updateReady && <span className="update-badge" aria-hidden="true">Update</span>}</Link>
        })}</nav>
        <div className="settings-device-note"><Laptop size="1.25rem" aria-hidden="true" /><strong>A little space. On this device.</strong><p>Device preferences and cards are shared within this browser profile.</p></div>
      </aside>
      <div className="settings-content">
        <SettingsSection id="account" title="User Profile" description="Your identity, separate from the plans on this device.">
          <div className="settings-identity"><AccountAvatar user={user} className="account-large-avatar" /><div><strong>{user ? accountName(user) : 'Make yourself at home.'}</strong><span>{user?.email ?? 'You can keep planning without an account.'}</span><small className="settings-status">{user ? <><BadgeCheck size="0.8125rem" aria-hidden="true" />Signed in{user.emailVerified ? ' · Email verified' : ' · Email not yet verified'}</> : phase === 'loading' ? 'Checking account…' : phase === 'error' ? 'Account connection unavailable' : 'Guest workspace'}</small></div></div>
          {phase === 'loading' && <p className="settings-connection-note" role="status">Checking your sign-in. Your device settings are ready to use.</p>}
          {phase === 'error' && <div className="settings-connection-note" role="status"><p>{account.initializationError} Your local settings remain available.</p><button type="button" className="button settings-secondary" onClick={account.retry}>Retry account connection</button></div>}
          <div className="settings-account-actions">{user ? <><p>Manage your display name, email verification, sign-in security, and Google sync status in your account.</p><Link className="button settings-primary" to="/account">Manage account<ArrowRight size="0.875rem" aria-hidden="true" /></Link></> : <><p>Sign in to manage your identity. Only Continue with Google can enable online sync; local cards are never locked by an account.</p><div><Link className="button settings-primary" to="/sign-in">Sign in<ArrowRight size="0.875rem" aria-hidden="true" /></Link><Link className="button settings-secondary" to="/sign-in?mode=create">Create account</Link></div></>}</div>
        </SettingsSection>

        <SettingsSection id="appearance" title="Appearance" description="A familiar place, with room for a little personality.">
          <ColorModePicker appearance={appearance} />
          <GradientBackgroundPicker appearance={appearance} />
          <div className="settings-month-preview" data-settings-month={month} style={monthPalette(scene)}><div><span className="settings-month-label"><Sparkles size="0.8125rem" aria-hidden="true" />Automatic · {scene.name} {month.slice(0, 4)}</span><h3>{scene.title}.</h3><p>Sign-in follows your device’s current month. Timeline and Calendar follow the month you’re viewing above your selected canvas.</p></div><MonthArtwork month={month} side="right" className="settings-month-art" /></div>
        </SettingsSection>

        <SettingsSection id="calendar" title="Calendar sources" description="Show reference dates alongside your plans, without turning them into personal cards.">
          <CalendarSourcesSettings calendarSources={calendarSources} />
        </SettingsSection>

        <SettingsSection id="workspace" title="Device workspace & backup" description="Your plans live here. Keep a copy somewhere you trust.">
          <DeviceWorkspaceSummary state={state} storageAvailable={storageAvailable} />
          <div className="settings-backup-row"><div><strong>A copy of your whole journey.</strong><p>Events, task lists, projects, notes, and your Tablet frame preference.</p></div><button className="button settings-secondary" type="button" onClick={exportWorkspace}><Download size="0.9375rem" aria-hidden="true" />Export device backup</button></div>
          <p className="settings-caption">Downloads a JSON file without sign-in tokens or passwords. Appearance and Calendar-source preferences stay separate and are not included. Imported PDFs are never included. Keep the backup private. This is not cloud sync, and we can’t verify where you save the file.</p>
          {feedback && <p ref={feedbackRef} tabIndex={-1} className={`account-feedback settings-backup-feedback ${feedback.error ? 'is-error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{!feedback.error && <Check size="0.9375rem" aria-hidden="true" />}{feedback.message}</p>}
        </SettingsSection>

        <SettingsSection id="privacy" title="Privacy & storage" description="A clear picture of what stays here, and what signing in does.">
          <div className="settings-privacy-callout"><ShieldCheck size="1.375rem" aria-hidden="true" /><div><strong>Local does not mean locked.</strong><p>Anyone using this browser profile can access its cards, even while signed out. Use a separate browser profile on shared devices.</p></div></div>
          <dl className="settings-data-list">
            <div><dt><HardDrive size="1rem" aria-hidden="true" />Saved in this browser</dt><dd>Your cards, edits, appearance preferences, Timeline frame preference, and Calendar-source choices. Imported memorandum PDFs are read in memory only; Kanso keeps extracted dates, not the PDF. Clearing site data can erase browser-stored data. When storage is blocked, changes last only for the session.</dd></div>
            <div><dt><Mail size="1rem" aria-hidden="true" />Your account & session</dt><dd>Firebase manages your identity and sign-in session. Guests and email/password sessions remain device-local; only a Google-issued Firebase session can sync eligible workspace data online.</dd></div>
            <div><dt><Laptop size="1rem" aria-hidden="true" />A different device or address</dt><dd>A new browser profile, device, or website address starts with its own local workspace. Google-synced Space data can reappear after Google sign-in; export device-only plans before changing hosts.</dd></div>
          </dl>
          <p className="settings-privacy-footer"><Check size="0.875rem" aria-hidden="true" />Analytics is not initialized. Cloud workspace data is only requested for an active Google-authenticated session.</p>
        </SettingsSection>

        <SettingsSection id="about" title="About & help" description="A little structure. A lot of possibility.">
          <div className="settings-about-brand"><span className="brand-mark"><KansoMark /></span><div><strong>Kanso Pro</strong><span>Version {version} · Your personal planning space</span></div></div>
          <p className="settings-caption">Use the navigation to move between your five planning pages. New card adds an event, task list, project, or note to your journey.</p>
          <PwaSettings pwa={pwa} onOpenAbout={onOpenAbout} />
          <div className="settings-help-links"><a href={`${docs}/README.md`} target="_blank" rel="noopener noreferrer"><BookOpen size="1.125rem" aria-hidden="true" /><span>Usage guide</span><ExternalLink size="0.875rem" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a><a href={`${docs}/docs/firebase-setup.md`} target="_blank" rel="noopener noreferrer"><ShieldCheck size="1.125rem" aria-hidden="true" /><span>Account setup guide</span><ExternalLink size="0.875rem" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a><a href={`${repository}/tree/${sourceRef}`} target="_blank" rel="noopener noreferrer"><Info size="1.125rem" aria-hidden="true" /><span>Source code</span><ExternalLink size="0.875rem" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a></div>
          <p className="settings-caption">Help and source links open the project documentation in a new tab.</p>
        </SettingsSection>
      </div>
    </div>
  </main>
}
