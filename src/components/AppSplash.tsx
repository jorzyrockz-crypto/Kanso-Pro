import { useEffect } from 'react'

/** Dismisses the no-JavaScript startup surface once the routed app has painted. */
export function AppSplash() {
  useEffect(() => {
    const splash = document.getElementById('app-splash')
    if (!splash) return
    let removal = 0
    const revealApp = () => {
      splash.setAttribute('aria-hidden', 'true')
      splash.classList.add('is-ready')
      removal = window.setTimeout(() => splash.remove(), 360)
    }
    const frame = window.requestAnimationFrame(revealApp)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(removal)
    }
  }, [])

  return null
}
