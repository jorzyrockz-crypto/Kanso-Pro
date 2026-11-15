import { useEffect, useLayoutEffect, useState } from 'react'
import { APPEARANCE_STORAGE_KEY, COLOR_SCHEME_QUERY, applyColorScheme, parseColorMode, resolveColorScheme, serializeColorMode } from './appearance'
import type { ColorMode } from './appearance'

function systemPrefersDark() {
  try { return window.matchMedia(COLOR_SCHEME_QUERY).matches } catch { return false }
}

/** One controller for the whole app, including guest/auth routes. No account dependency. */
export function useAppearance() {
  const [mode, setMode] = useState<ColorMode>(() => {
    try { return parseColorMode(localStorage.getItem(APPEARANCE_STORAGE_KEY)) ?? 'auto' } catch { return 'auto' }
  })
  const [systemDark, setSystemDark] = useState(systemPrefersDark)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const scheme = resolveColorScheme(mode, systemDark)

  useLayoutEffect(() => { applyColorScheme(mode, systemDark) }, [mode, systemDark])

  useEffect(() => {
    try {
      const next = serializeColorMode(mode)
      // Do not echo identical same-origin storage events back to other tabs.
      if (localStorage.getItem(APPEARANCE_STORAGE_KEY) !== next) localStorage.setItem(APPEARANCE_STORAGE_KEY, next)
      setStorageAvailable(true)
    } catch { setStorageAvailable(false) }
  }, [mode])

  useEffect(() => {
    let media: MediaQueryList | undefined
    try { media = window.matchMedia(COLOR_SCHEME_QUERY) } catch { /* Auto safely falls back to Light. */ }
    const refresh = () => setSystemDark(media?.matches ?? systemPrefersDark())
    // Listen even in explicit modes, so choosing Auto uses the latest device setting.
    if (media?.addEventListener) media.addEventListener('change', refresh)
    else media?.addListener?.(refresh)
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    document.addEventListener('visibilitychange', visible)
    const sync = (event: StorageEvent) => {
      if (event.key !== APPEARANCE_STORAGE_KEY && event.key !== null) return
      // Ignore sessionStorage events and tolerate browsers that block the getter.
      try { if (event.storageArea && event.storageArea !== localStorage) return } catch { return }
      const next = event.newValue === null ? 'auto' : parseColorMode(event.newValue)
      if (next) setMode(next)
    }
    window.addEventListener('storage', sync)
    return () => {
      if (media?.removeEventListener) media.removeEventListener('change', refresh)
      else media?.removeListener?.(refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return { mode, scheme, setMode, storageAvailable }
}

export type AppearanceController = ReturnType<typeof useAppearance>
