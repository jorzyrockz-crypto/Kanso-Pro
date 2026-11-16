import { ArrowUpRight, Check, Download, Info, WifiOff } from 'lucide-react'
import type { PwaController } from '../lib/usePwa'

export function PwaSettings({ pwa, onOpenAbout }: { pwa: PwaController; onOpenAbout: () => void }) {
  return <div className="pwa-settings">
    <button type="button" className="about-settings-launcher" onClick={onOpenAbout} aria-label={pwa.updateReady ? 'Review the ready Kanso Pro update' : 'Open About and updates'}>
      <img src="/images/kanso-pro-web-banner.jpg" alt="" />
      <span><small>{pwa.updateReady ? 'Update ready' : 'About & updates'}</small><strong>{pwa.updateReady ? 'A fresh version is ready to restart.' : 'See what is new in Kanso Pro.'}</strong><em>{pwa.updateReady ? 'Review update' : 'Open overview'} <ArrowUpRight size=".8125rem" aria-hidden="true" /></em></span>
    </button>
    <div className="pwa-settings-heading"><strong>Keep Kanso Pro close.</strong>{pwa.installed && <span><Check size="0.8125rem" aria-hidden="true" />Installed app</span>}</div>
    <p>Install Kanso Pro for its own window and quick access from your home screen. After the first online visit finishes setup, your local planner can open offline too.</p>
    {pwa.canInstall && !pwa.installed ? <button type="button" className="button settings-secondary" disabled={pwa.installing} onClick={() => void pwa.install()}><Download size="0.9375rem" aria-hidden="true" />{pwa.installing ? 'Opening install…' : 'Install Kanso Pro'}</button> : !pwa.installed && <p className="pwa-install-help">On iPhone or iPad: open in Safari, tap Share, then Add to Home Screen. On other supported browsers, use the address-bar install icon or the browser menu’s Install app / Add to Home Screen option. Installation may require opening this site outside an embedded preview.</p>}
    <p className="pwa-state" role="status">{!pwa.online && <WifiOff size="0.875rem" aria-hidden="true" />}{pwa.development ? 'Offline installation is enabled in the production build, not the development server.' : pwa.offlineReady ? `${pwa.online ? 'Ready offline on this device.' : 'You’re offline. Your saved plans are still available.'} Sign-in and account changes need internet.` : 'Connect to the internet and keep this page open to finish offline setup.'}</p>
    <button type="button" className="pwa-update-summary" onClick={onOpenAbout}><Info size=".875rem" aria-hidden="true" /><span><strong>{pwa.updateReady ? 'Update ready' : `Version ${pwa.build}`}</strong><small>{pwa.updateReady ? 'Restart from the update overview when you are ready.' : 'Recent releases and update checks are in About & updates.'}</small></span><ArrowUpRight size=".875rem" aria-hidden="true" /></button>
    {pwa.error && <p className="account-feedback is-error" role="status">{pwa.error}</p>}
  </div>
}
