import { CheckCircle2, Clock3, Github, RefreshCw, Share2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { PwaController } from '../lib/usePwa'
import releases from '../lib/whats-new.json'

const repository = 'https://github.com/jorzyrockz-crypto/Kanso-Pro'
const focusable = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

function releaseDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

export function AboutUpdatesDialog({ open, onClose, pwa }: { open: boolean; onClose: () => void; pwa: PwaController }) {
  const headingId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [shareStatus, setShareStatus] = useState('Share app link')

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
      if (navigator.share) await navigator.share({ title: 'Kanso Pro', text: 'Your personal planning space.', url })
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setShareStatus('Link copied')
      } else setShareStatus('Copy this page URL')
    } catch {
      // Closing the native share sheet is an expected user action.
    }
  }

  return <div className="about-updates-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="about-updates-dialog" role="dialog" aria-modal="true" aria-labelledby={headingId} aria-describedby={descriptionId}>
      <div className="about-updates-banner">
        <img src="/images/kanso-pro-web-banner.jpg" alt="Kanso Pro — Your simplified workspace" />
        <button ref={closeRef} type="button" className="about-updates-close" aria-label="Close About and what’s new" onClick={onClose}><X size="1rem" aria-hidden="true" /></button>
      </div>
      <div className="about-updates-body">
        <header className="about-updates-intro"><p className="about-overline">Kanso Pro</p><h2 id={headingId}>Your personal planning space</h2><p id={descriptionId}>Bring your timeline, calendar, tasks, projects, and journal together in one calm planning space.</p></header>

        {pwa.updateReady ? <div className="about-update-status about-update-ready" role="status"><span className="about-update-icon"><RefreshCw size="1rem" aria-hidden="true" /></span><div><strong>A new version is ready</strong><p>Restart to update. Your saved plans stay available on this device.</p></div><button type="button" className="button about-update-action" onClick={pwa.update}>Restart now</button></div>
          : <div className="about-update-status"><span className="about-update-icon"><CheckCircle2 size="1rem" aria-hidden="true" /></span><div><strong>Version {pwa.build}</strong><p role="status">{pwa.checkStatus || 'You have the latest version available to this app.'}</p></div><button type="button" className="button about-update-action" disabled={pwa.checking} onClick={() => void pwa.checkForUpdates()}>{pwa.checking ? 'Checking…' : 'Check for updates'}</button></div>}

        <p className="about-background-note"><Clock3 size="0.75rem" aria-hidden="true" />Update checks run in the background while Kanso Pro is open and when you return to it.</p>

        <section className="about-release-section" aria-labelledby={`${headingId}-changes`}><span className="about-section-label" id={`${headingId}-changes`}>What’s new</span>
          <div className="about-release-list">{releases.slice(0, 3).map((release, index) => <article className="about-release" key={release.version}>
            <header><div><span>Version {release.version} · {releaseDate(release.date)}</span><h3>{release.title}</h3></div>{index === 0 && <b>Latest</b>}</header>
            <ul>{release.changes.map((change) => <li key={change}>{change}</li>)}</ul>
          </article>)}</div>
        </section>

        <footer className="about-updates-actions"><button type="button" className="button about-share-action" onClick={() => void share()}><Share2 size="0.875rem" aria-hidden="true" />{shareStatus}</button><a className="button about-github-action" href={repository} target="_blank" rel="noopener noreferrer"><Github size="0.875rem" aria-hidden="true" />View source<span className="sr-only"> (opens in a new tab)</span></a></footer>
      </div>
    </section>
  </div>
}
