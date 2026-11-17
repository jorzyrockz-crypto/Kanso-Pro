import { ArrowRight, Download, HardDrive, ShieldCheck } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router-dom'
import type { JourneyState } from '../types'
import { SaveIndicator } from './Common'

/** The same live device counts/save status on Account, sign-in, and Settings. */
export function DeviceWorkspaceSummary({ state, storageAvailable }: { state: JourneyState; storageAvailable: boolean }) {
  return <>
    <div className="account-device-stats">{([['event', 'Events'], ['task', 'Task lists'], ['project', 'Projects'], ['note', 'Notes']] as const).map(([type, label]) => <div key={type}><strong>{state.cards.filter((card) => card.type === type).length}</strong><span>{label}</span></div>)}</div>
    <div className="account-device-save"><SaveIndicator available={storageAvailable} /><span>{state.cards.length} cards in this browser</span></div>
  </>
}

/** Account and the monthly sign-in disclosure keep their existing guest backup access. */
export function DeviceWorkspacePanel({ state, storageAvailable, onExport, showReturnLink }: {
  state: JourneyState
  storageAvailable: boolean
  onExport: () => void
  showReturnLink: boolean
}) {
  const titleId = useId()
  return <aside className="account-device-panel" aria-labelledby={titleId}>
    <span className="account-device-icon"><HardDrive size="1.4375rem" aria-hidden="true" /></span><span className="eyebrow">Your device workspace</span><h2 id={titleId}>A little room for your plans.</h2>
    <p>These cards live in this browser, whether you’re a guest or signed in.</p>
    <DeviceWorkspaceSummary state={state} storageAvailable={storageAvailable} />
    <div className="account-local-notice"><ShieldCheck size="1.0625rem" aria-hidden="true" /><div><strong>Google is required for online sync.</strong><p>Email/password accounts and guests stay device-local. Signing in or out never hides or deletes local cards; anyone using this browser profile can still access them.</p></div></div>
    <button className="button account-export" onClick={onExport}><Download size="0.9375rem" aria-hidden="true" />Export device backup</button>
    <p className="account-backup-note">A JSON copy of all card content. Keep the file private. It does not contain your sign-in tokens or password.</p>
    {showReturnLink && <Link className="button button-soft account-continue" to="/">Back to your timeline<ArrowRight size="0.875rem" aria-hidden="true" /></Link>}
  </aside>
}
