export type ColorMode = 'light' | 'dark' | 'auto'
export type ColorScheme = 'light' | 'dark'
export type BackgroundGradient = 'sky' | 'dawn' | 'lagoon' | 'twilight'

export interface AppearancePreferences {
  mode: ColorMode
  background: BackgroundGradient
}

// Appearance is a device preference, not part of the version-one journey or its backup.
export const APPEARANCE_STORAGE_KEY = 'kanso-pro:appearance:v1'
export const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'
export const DEFAULT_BACKGROUND: BackgroundGradient = 'sky'

export function parseAppearancePreferences(raw: string | null): AppearancePreferences | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const setting = value as Record<string, unknown>
    const mode = setting.mode
    if (!['light', 'dark', 'auto'].includes(String(mode))) return null
    // Version one saved only color mode. Its visual equivalent is the original Sky canvas.
    if (setting.version === 1) return { mode: mode as ColorMode, background: 'sky' }
    const background = setting.background
    return setting.version === 2 && ['sky', 'dawn', 'lagoon', 'twilight'].includes(String(background))
      ? { mode: mode as ColorMode, background: background as BackgroundGradient }
      : null
  } catch { return null }
}

/** Compatibility helper for callers that only need the color choice. */
export function parseColorMode(raw: string | null): ColorMode | null {
  return parseAppearancePreferences(raw)?.mode ?? null
}

/** Version-one serialization remains available for compatibility with older callers and saved-fixture setup. */
export function serializeColorMode(mode: ColorMode): string {
  return JSON.stringify({ version: 1, mode })
}

export function serializeAppearancePreferences(preferences: AppearancePreferences): string {
  return JSON.stringify({ version: 2, mode: preferences.mode, background: preferences.background })
}

export function resolveColorScheme(mode: ColorMode, systemDark: boolean): ColorScheme {
  return mode === 'auto' ? systemDark ? 'dark' : 'light' : mode
}

export function appearanceThemeColor(scheme: ColorScheme, background: BackgroundGradient): string {
  if (scheme === 'dark') {
    if (background === 'dawn') return '#2b1e2a'
    if (background === 'lagoon') return '#102d35'
    if (background === 'twilight') return '#211d42'
    return '#0c1724'
  }
  if (background === 'dawn') return '#fff4ed'
  if (background === 'lagoon') return '#e7f8f5'
  if (background === 'twilight') return '#f0efff'
  return '#eaf5fc'
}

export function applyAppearance(mode: ColorMode, background: BackgroundGradient, systemDark: boolean): void {
  const scheme = resolveColorScheme(mode, systemDark)
  document.documentElement.dataset.colorMode = mode
  document.documentElement.dataset.theme = scheme
  document.documentElement.dataset.background = background
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', appearanceThemeColor(scheme, background))
}

/** Retained for consumers that only set a color mode. */
export function applyColorScheme(mode: ColorMode, systemDark: boolean): void {
  applyAppearance(mode, 'sky', systemDark)
}

/** Vite injects this small synchronous head script before styles/body in dev AND builds.
 * Serialize the same validation/resolution functions used at runtime: no second ruleset,
 * remote request, unsafe HTML, account data, or flash of the wrong saved appearance.
 */
export function appearanceBootstrapScript(): string {
  return `(() => {
    const parseAppearancePreferences = ${parseAppearancePreferences.toString()};
    const resolveColorScheme = ${resolveColorScheme.toString()};
    const appearanceThemeColor = ${appearanceThemeColor.toString()};
    const applyAppearance = ${applyAppearance.toString()};
    let appearance = { mode: 'auto', background: 'sky' };
    let dark = false;
    try { appearance = parseAppearancePreferences(localStorage.getItem(${JSON.stringify(APPEARANCE_STORAGE_KEY)})) || appearance; } catch {}
    try { dark = window.matchMedia(${JSON.stringify(COLOR_SCHEME_QUERY)}).matches; } catch {}
    applyAppearance(appearance.mode, appearance.background, dark);
  })();`
}
