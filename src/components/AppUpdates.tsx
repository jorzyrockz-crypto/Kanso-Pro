import { ArrowRight, RefreshCw, X } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PwaController } from '../lib/usePwa'
import { updateSurface } from '../lib/updates'
import { KansoMark } from './AppHeader'

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
  const navigate = useNavigate()
  useEffect(() => {
    onOpenAbout()
    navigate('/', { replace: true })
  }, [navigate, onOpenAbout])
  return null
}
