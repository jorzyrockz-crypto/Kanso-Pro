import { ArrowRight, RefreshCw, X } from 'lucide-react'
import { KansoMark } from './AppHeader'
import { Link } from 'react-router-dom'
import type { PwaController } from '../lib/usePwa'
import { updateSurface } from '../lib/updates'
import { confirmNotificationNavigation } from '../lib/notifications'
import { PageHeader } from './PageHeader'
import releases from '../lib/whats-new.json'

export function UpdateChrome({ pwa, signedIn, position }: { pwa: PwaController; signedIn: boolean; position: 'titlebar' | 'banner' }) {
  const surface = updateSurface(pwa.overlay, pwa.coarse, signedIn)
  if (position === 'titlebar') {
    if (!pwa.overlay) return null
    return <div id="titleBar" className="app-titlebar">
      <span className="titlebar-brand"><KansoMark size={16} /><span>Kanso Pro <small>· Your personal planning space</small></span></span>
      {pwa.updateReady && <button type="button" className="titlebar-update" onClick={pwa.update}><RefreshCw size=".75rem" aria-hidden="true" /><span>Update ready · Restart</span></button>}
    </div>
  }
  return pwa.updateReady && surface === 'banner' && !pwa.updateDismissed ? <div className="app-update-banner" role="status"><span><RefreshCw size="1rem" /><strong>A new version is ready.</strong><Link to="/whats-new" onClick={event => { if (!confirmNotificationNavigation(event)) event.preventDefault() }}>What’s new<ArrowRight size=".875rem" /></Link></span><div><button type="button" className="button settings-secondary" onClick={pwa.update}>Restart</button><button type="button" className="icon-button" aria-label="Remind me about this update later" onClick={pwa.dismissUpdate}><X size="1rem" /></button></div></div> : null
}

export function WhatsNewPage() {
  return <main id="main-content" tabIndex={-1} className="workspace-page whats-new-page" aria-labelledby="page-title"><PageHeader title="What’s new" description="Thoughtful changes, with your local plans left just as they are." action={<Link to="/settings#about" className="button settings-secondary">About & updates</Link>} /><div className="release-list">{releases.map(release => <article className="release-card" key={release.version}><span className="eyebrow">Version {release.version} · {release.date}</span><h2>{release.title}</h2><ul>{release.changes.map(change => <li key={change}>{change}</li>)}</ul></article>)}</div></main>
}
