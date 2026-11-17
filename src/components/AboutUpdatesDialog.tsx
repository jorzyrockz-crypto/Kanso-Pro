import { CheckCircle2, Github, RefreshCw, Share2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { PwaController } from '../lib/usePwa'
import releases from '../lib/whats-new.json'

const repository = 'https://github.com/jorzyrockz-crypto/Kanso-Pro'
const focusable = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

function versionLabel(build: string, fallback: string) {
  if (!build || build === 'development') return fallback
  return build.split('+')[0].replace(/^v/i, '')
}

/** A focused, shareable release note shown from Settings or immediately after an update. */
export function AboutUpdatesDialog({ open, onClose, pwa, justUpdated = false }: { open: boolean; onClose: () => void; pwa: PwaController; justUpdated?: boolean }) {
  const headingId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [shareStatus, setShareStatus] = useState('Share app link')
  const latest = releases[0]
  const build = versionLabel(pwa.build, latest.version)

  useEffect(() => {
    if (!open) return
    const focusedBeforeOpen = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus({ preventScroll: true })
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusable) ?? [])
      if (!controls.length) return
      const first = controls[0]
      const last = controls.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', keyboard)
      if (focusedBeforeOpen?.isConnected) focusedBeforeOpen.focus({ preventScroll: true })
    }
  }, [open, onClose])

  useEffect(() => { if (!open) setShareStatus('Share app link') }, [open])

  if (!open) return null

  const share = async () => {
    const url = window.location.origin
    try {
      if (navigator.share) await navigator.share({ title: 'Kanso Pro', text: 'A calm planning space for the things that matter.', url })
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setShareStatus('Link copied')
      } else setShareStatus('Copy this page URL')
    } catch {
      // Dismissing a platform share sheet is a normal user choice.
    }
  }

  const statusCopy = pwa.updateReady
    ? { title: 'A new version is ready', detail: 'Restart when you are ready. Your saved plans stay available on this device.', action: 'Restart now' }
    : { title: `App version ${build}`, detail: pwa.checkStatus || (justUpdated ? 'Your app is up to date. Keep planning with the newest improvements.' : 'Check for a newer version when you are online.'), action: pwa.checking ? 'Checking…' : 'Check for updates' }

  return <div className="about-updates-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="about-updates-dialog" role="dialog" aria-modal="true" aria-labelledby={headingId} aria-describedby={descriptionId}>
      <div className="about-updates-banner">
        <img src="/images/kanso-pro-web-banner.jpg" alt="Kanso Pro across desktop and mobile" />
        <button ref={closeRef} type="button" className="about-updates-close" aria-label="Close About and what’s new" onClick={onClose}><X size="1rem" aria-hidden="true" /></button>
      </div>
      <div className="about-updates-body">
        <header className="about-updates-intro">
          <h2 id={headingId}>Kanso Pro <span>· Planning Space</span></h2>
          <p id={descriptionId}>{justUpdated ? 'Your calm planning space has been refreshed with the latest improvements.' : 'Keep your timeline, calendar, tasks, projects, and journal together in one quiet workspace.'}</p>
        </header>

        <section className={`about-update-status ${pwa.updateReady ? 'about-update-ready' : ''}`} aria-label="App update status">
          <span className="about-update-icon" aria-hidden="true">{pwa.updateReady ? <RefreshCw size="1rem" /> : <CheckCircle2 size="1rem" />}</span>
          <div><strong>{statusCopy.title}</strong><p role="status">{statusCopy.detail}</p></div>
          <button type="button" className="button about-update-action" disabled={!pwa.updateReady && pwa.checking} onClick={pwa.updateReady ? pwa.update : () => void pwa.checkForUpdates()}>{statusCopy.action}</button>
        </section>

        <section className="about-release-section" aria-labelledby={`${headingId}-changes`}>
          <span className="about-section-label" id={`${headingId}-changes`}>What’s new</span>
          <h3>{latest.title}</h3>
          <ul>{latest.changes.map((change) => <li key={change}>{change}</li>)}</ul>
        </section>

        <footer className="about-updates-actions">
          <button type="button" className="button about-share-action" onClick={() => void share()}><Share2 size=".875rem" aria-hidden="true" />{shareStatus}</button>
          <a className="button about-github-action" href={repository} target="_blank" rel="noopener noreferrer"><Github size=".875rem" aria-hidden="true" />GitHub<span className="sr-only"> (opens in a new tab)</span></a>
        </footer>
      </div>
    </section>
  </div>
}
