import { Check, Download, RefreshCw, WifiOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PwaController } from '../lib/usePwa'

export function PwaSettings({ pwa }: { pwa: PwaController }) {
  return <div className="pwa-settings">
    <div className="pwa-settings-heading"><strong>Keep Kanso Pro close.</strong>{pwa.installed && <span><Check size="0.8125rem" aria-hidden="true" />Installed app</span>}</div>
    <p>Install Kanso Pro for its own window and quick access from your home screen. After the first online visit finishes setup, your local planner can open offline too.</p>
    {pwa.canInstall && !pwa.installed ? <button type="button" className="button settings-secondary" disabled={pwa.installing} onClick={() => void pwa.install()}><Download size="0.9375rem" aria-hidden="true" />{pwa.installing ? 'Opening install…' : 'Install Kanso Pro'}</button> : !pwa.installed && <p className="pwa-install-help">On iPhone or iPad: open in Safari, tap Share, then Add to Home Screen. On other supported browsers, use the address-bar install icon or the browser menu’s Install app / Add to Home Screen option. Installation may require opening this site outside an embedded preview.</p>}
    <p className="pwa-state" role="status">{!pwa.online && <WifiOff size="0.875rem" aria-hidden="true" />}{pwa.development ? 'Offline installation is enabled in the production build, not the development server.' : pwa.offlineReady ? `${pwa.online ? 'Ready offline on this device.' : 'You’re offline. Your saved plans are still available.'} Sign-in and account changes need internet.` : 'Connect to the internet and keep this page open to finish offline setup.'}</p>
    <div className="pwa-update"><div className="pwa-update-heading"><strong>{pwa.updateReady ? 'A fresh version is ready.' : 'App updates'}</strong>{pwa.updateReady && <span className="update-badge">Update</span>}</div>
      <p className="pwa-version">Build {pwa.build}</p>
      <p>Checks run when you return (at most every 30 minutes), hourly while the app can run, and whenever you check below. Downloads happen in the background. No closed-app wakeups or push service are configured.</p>
      {pwa.updateReady && <p>Finish any unsaved New card or sign-in form first. Reloading keeps your saved cards and preferences, but clears unfinished fields. A restart from an open form asks for confirmation. Release notes reflect the running app; restart to see the newest notes.</p>}
      <div className="pwa-actions">{pwa.updateReady && <button type="button" className="button settings-secondary" onClick={pwa.update}><RefreshCw size="0.9375rem" aria-hidden="true" />Reload to update</button>}<button type="button" className="button settings-secondary" disabled={pwa.checking || pwa.development} onClick={() => void pwa.checkForUpdates()}><RefreshCw size=".9375rem" />{pwa.checking ? 'Checking…' : 'Check for updates'}</button><Link to="/whats-new" className="button settings-secondary">What’s new{pwa.updateReady && <span className="update-badge">Update</span>}</Link></div>
      {pwa.checkStatus && <p role="status">{pwa.checkStatus}</p>}
    </div>
    {pwa.error && <p className="account-feedback is-error" role="status">{pwa.error}</p>}
  </div>
}
