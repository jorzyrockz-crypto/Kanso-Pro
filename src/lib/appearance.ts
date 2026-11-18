export type ColorMode = 'light' | 'dark' | 'auto'
export type ColorScheme = 'light' | 'dark'
export interface AppearancePreferences {
  mode: ColorMode
  /** A crisp, low-decoration light skin for people who prefer a conventional SaaS workspace. */
  saasWhite: boolean
}

// Appearance is a device preference, not part of the version-one journey or its backup.
export const APPEARANCE_STORAGE_KEY = 'kanso-pro:appearance:v1'
export const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'

export function parseAppearancePreferences(raw: string | null): AppearancePreferences | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const setting = value as Record<string, unknown>
    if (setting.version !== 1 || !['light', 'dark', 'auto'].includes(String(setting.mode))) return null
    // Older color-mode-only preferences remain valid and simply receive the standard skin.
    if (setting.saasWhite !== undefined && typeof setting.saasWhite !== 'boolean') return null
    return { mode: setting.mode as ColorMode, saasWhite: setting.saasWhite === true }
  } catch { return null }
}

/** Retained for integrations that only need the original color-mode preference. */
export function parseColorMode(raw: string | null): ColorMode | null {
  return parseAppearancePreferences(raw)?.mode ?? null
}

/** Retained for integrations that only need the original color-mode preference. */
export function serializeColorMode(mode: ColorMode): string {
  return JSON.stringify({ version: 1, mode })
}

export function serializeAppearancePreferences(preferences: AppearancePreferences): string {
  return JSON.stringify({ version: 1, mode: preferences.mode, saasWhite: preferences.saasWhite })
}

export function resolveColorScheme(mode: ColorMode, systemDark: boolean, saasWhite = false): ColorScheme {
  if (saasWhite) return 'light'
  return mode === 'auto' ? systemDark ? 'dark' : 'light' : mode
}

export function applyColorScheme(mode: ColorMode, systemDark: boolean, saasWhite = false): void {
  const scheme = resolveColorScheme(mode, systemDark, saasWhite)
  document.documentElement.dataset.colorMode = mode
  document.documentElement.dataset.theme = scheme
  if (saasWhite) document.documentElement.dataset.saasSkin = 'white'
  else delete document.documentElement.dataset.saasSkin
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', saasWhite ? '#ffffff' : scheme === 'dark' ? '#0c1724' : '#eaf5fc')
}

/** Vite injects this small synchronous head script before styles/body in dev AND builds.
 * Serialize the same validation/resolution functions used at runtime: no second ruleset,
 * remote request, unsafe HTML, account data, or flash of the wrong saved color scheme.
 */
export function appearanceBootstrapScript(): string {
  return `(() => {
    const parseAppearancePreferences = ${parseAppearancePreferences.toString()};
    const resolveColorScheme = ${resolveColorScheme.toString()};
    const applyColorScheme = ${applyColorScheme.toString()};
    let preferences = { mode: 'auto', saasWhite: false };
    let dark = false;
    try { preferences = parseAppearancePreferences(localStorage.getItem(${JSON.stringify(APPEARANCE_STORAGE_KEY)})) || preferences; } catch {}
    try { dark = window.matchMedia(${JSON.stringify(COLOR_SCHEME_QUERY)}).matches; } catch {}
    applyColorScheme(preferences.mode, dark, preferences.saasWhite);
  })();`
}
