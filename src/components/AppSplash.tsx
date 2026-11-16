import { useEffect } from 'react'

const DEVICE_OPENING_MS = 1_200
const DESKTOP_OPENING_MS = 450
const CINEMATIC_EXIT_MS = 720

/** Lets the app paint behind the startup surface, then reveals it with a short, unhurried transition. */
export function AppSplash() {
  useEffect(() => {
    const splash = document.getElementById('app-splash')
    if (!splash) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const deviceLaunch = window.matchMedia('(pointer: coarse)').matches
    const minimumOpening = reducedMotion ? 0 : deviceLaunch ? DEVICE_OPENING_MS : DESKTOP_OPENING_MS
    let openingTimer = 0
    let removalTimer = 0
    let secondFrame = 0
    const revealApp = () => {
      splash.setAttribute('aria-hidden', 'true')
      splash.classList.add('is-ready')
      removalTimer = window.setTimeout(() => splash.remove(), reducedMotion ? 0 : CINEMATIC_EXIT_MS)
    }
    const frame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        openingTimer = window.setTimeout(revealApp, minimumOpening)
      })
    })
    return () => {
      window.cancelAnimationFrame(frame)
      window.cancelAnimationFrame(secondFrame)
      window.clearTimeout(openingTimer)
      window.clearTimeout(removalTimer)
    }
  }, [])

  return null
}
