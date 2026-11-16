import { ArrowRight, RefreshCw, X } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { PwaController } from '../lib/usePwa'
import { updateSurface } from '../lib/updates'
import { PageHeader } from './PageHeader'
import { KansoMark } from './AppHeader'
import releases from '../lib/whats-new.json'

export function UpdateChrome({ pwa, signedIn, position, onOpenAbout }: { pwa: PwaController; signedIn: boolean; position: 'titlebar' | 'banner'; onOpenAbout: () => void }) {
  const surface = updateSurface(pwa.overlay, pwa.coarse, signedIn)
  if (position === 'titlebar') {
    if (!pwa.overlay) return null
    return <div id="titleBar" className="app-titlebar">
      <span className="titlebar-brand"><KansoMark size={16} /><span>Kanso Pro <small>· Your personal planning space</small></span></span>
      {pwa.updateReady && <button type="button" className="titlebar-update" onClick={onOpenAbout}><RefreshCw size=".75rem" aria-hidden="true" /><span>Update ready · Review</span></button>}
    </div>
  }
  return pwa.updateReady && surface === 'banner' && !pwa.updateDismissed ? <div className="app-update-banner" role="status"><span><RefreshCw size="1rem" /><strong>A new version is ready.</strong><button type="button" className="app-update-link" onClick={onOpenAbout}>Review update<ArrowRight size=".875rem" /></button></span><div><button type="button" className="button settings-secondary" onClick={pwa.update}>Restart</button><button type="button" className="icon-button" aria-label="Remind me about this update later" onClick={pwa.dismissUpdate}><X size="1rem" /></button></div></div> : null
}

export function WhatsNewPage({ onOpenAbout }: { onOpenAbout: () => void }) {
  useEffect(() => { onOpenAbout() }, [onOpenAbout])
  return <main id="main-content" tabIndex={-1} className="workspace-page whats-new-page" aria-labelledby="page-title">
    <PageHeader title="What’s new" description="Thoughtful changes, with your local plans left just as they are." action={<Link to="/settings#about" className="button settings-secondary">Settings</Link>} />
    <section className="whats-new-hero-card"><img src="/images/kanso-pro-web-banner.jpg" alt="Kanso Pro — Your simplified workspace" /><div><span className="eyebrow">Kanso Pro</span><h2>About &amp; what’s new</h2><p>The update overview is open now. See recent releases, check for updates, or share Kanso Pro.</p><button type="button" className="button settings-secondary" onClick={onOpenAbout}>Open update overview<ArrowRight size=".875rem" aria-hidden="true" /></button></div></section>
    <div className="release-list">{releases.map(release => <article className="release-card" key={release.version}><span className="eyebrow">Version {release.version} · {release.date}</span><h2>{release.title}</h2><ul>{release.changes.map(change => <li key={change}>{change}</li>)}</ul></article>)}</div>
  </main>
}
