import { Check, Download, RefreshCw, WifiOff } from 'lucide-react'
import type { PwaController } from '../lib/usePwa'

export function PwaSettings({ pwa }: { pwa: PwaController }) {
  return <div className="pwa-settings">
    <div className="pwa-settings-heading"><strong>Keep Kanso Pro close.</strong>{pwa.installed && <span><Check size={13} aria-hidden="true" />Installed app</span>}</div>
    <p>Install Kanso Pro for its own window and quick access from your home screen. After the first online visit finishes setup, your local planner can open offline too.</p>
    {pwa.canInstall && !pwa.installed ? <button type="button" className="button settings-secondary" disabled={pwa.installing} onClick={() => void pwa.install()}><Download size={15} aria-hidden="true" />{pwa.installing ? 'Opening install…' : 'Install Kanso Pro'}</button> : !pwa.installed && <p className="pwa-install-help">On iPhone or iPad: open in Safari, tap Share, then Add to Home Screen. On other supported browsers, use the address-bar install icon or the browser menu’s Install app / Add to Home Screen option. Installation may require opening this site outside an embedded preview.</p>}
    <p className="pwa-state" role="status">{!pwa.online && <WifiOff size={14} aria-hidden="true" />}{pwa.development ? 'Offline installation is enabled in the production build, not the development server.' : pwa.offlineReady ? `${pwa.online ? 'Ready offline on this device.' : 'You’re offline. Your saved plans are still available.'} Sign-in and account changes need internet.` : 'Connect to the internet and keep this page open to finish offline setup.'}</p>
    {pwa.updateReady && <div className="pwa-update"><strong>A fresh version is ready.</strong><p>Finish any unsaved New card or sign-in form first. Reloading keeps your saved cards and preferences, but clears unfinished fields.</p><button type="button" className="button settings-secondary" onClick={pwa.update}><RefreshCw size={15} aria-hidden="true" />Reload to update</button></div>}
    {pwa.error && <p className="account-feedback is-error" role="status">{pwa.error}</p>}
  </div>
}
