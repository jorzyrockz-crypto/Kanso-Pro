import { useEffect, useLayoutEffect, useState } from 'react'
import { APPEARANCE_STORAGE_KEY, COLOR_SCHEME_QUERY, applyColorScheme, parseAppearancePreferences, resolveColorScheme, serializeAppearancePreferences } from './appearance'
import type { AppearancePreferences, ColorMode } from './appearance'

function systemPrefersDark() {
  try { return window.matchMedia(COLOR_SCHEME_QUERY).matches } catch { return false }
}

/** One controller for the whole app, including guest/auth routes. No account dependency. */
export function useAppearance() {
  const [preferences, setPreferences] = useState<AppearancePreferences>(() => {
    try { return parseAppearancePreferences(localStorage.getItem(APPEARANCE_STORAGE_KEY)) ?? { mode: 'auto', saasWhite: false } } catch { return { mode: 'auto', saasWhite: false } }
  })
  const [systemDark, setSystemDark] = useState(systemPrefersDark)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const { mode, saasWhite } = preferences
  const scheme = resolveColorScheme(mode, systemDark, saasWhite)

  useLayoutEffect(() => { applyColorScheme(mode, systemDark, saasWhite) }, [mode, systemDark, saasWhite])

  useEffect(() => {
    try {
      const next = serializeAppearancePreferences(preferences)
      // Do not echo identical same-origin storage events back to other tabs.
      if (localStorage.getItem(APPEARANCE_STORAGE_KEY) !== next) localStorage.setItem(APPEARANCE_STORAGE_KEY, next)
      setStorageAvailable(true)
    } catch { setStorageAvailable(false) }
  }, [preferences])

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
      const next: AppearancePreferences | null = event.newValue === null ? { mode: 'auto', saasWhite: false } : parseAppearancePreferences(event.newValue)
      if (next) setPreferences(next)
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

  const setMode = (next: ColorMode) => setPreferences(current => current.mode === next ? current : { ...current, mode: next })
  const setSaasWhite = (next: boolean) => setPreferences(current => current.saasWhite === next ? current : { ...current, saasWhite: next })

  return { mode, scheme, saasWhite, setMode, setSaasWhite, storageAvailable }
}

export type AppearanceController = ReturnType<typeof useAppearance>
