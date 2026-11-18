import { useEffect, useLayoutEffect, useState } from 'react'
import { APPEARANCE_STORAGE_KEY, COLOR_SCHEME_QUERY, DEFAULT_BACKGROUND, applyAppearance, parseAppearancePreferences, resolveColorScheme, serializeAppearancePreferences } from './appearance'
import type { AppearancePreferences, BackgroundGradient, ColorMode } from './appearance'

function systemPrefersDark() {
  try { return window.matchMedia(COLOR_SCHEME_QUERY).matches } catch { return false }
}

const defaultAppearance = (): AppearancePreferences => ({ mode: 'auto', background: DEFAULT_BACKGROUND })

/** One controller for the whole app, including guest/auth routes. No account dependency. */
export function useAppearance() {
  const [preferences, setPreferences] = useState<AppearancePreferences>(() => {
    try { return parseAppearancePreferences(localStorage.getItem(APPEARANCE_STORAGE_KEY)) ?? defaultAppearance() } catch { return defaultAppearance() }
  })
  const [systemDark, setSystemDark] = useState(systemPrefersDark)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const { mode, background } = preferences
  const scheme = resolveColorScheme(mode, systemDark)

  useLayoutEffect(() => { applyAppearance(mode, background, systemDark) }, [mode, background, systemDark])

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
      const next = event.newValue === null ? defaultAppearance() : parseAppearancePreferences(event.newValue)
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

  const setMode = (nextMode: ColorMode) => setPreferences((current) => current.mode === nextMode ? current : { ...current, mode: nextMode })
  const setBackground = (nextBackground: BackgroundGradient) => setPreferences((current) => current.background === nextBackground ? current : { ...current, background: nextBackground })

  return { mode, background, scheme, setMode, setBackground, storageAvailable }
}

export type AppearanceController = ReturnType<typeof useAppearance>
