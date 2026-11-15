export type ColorMode = 'light' | 'dark' | 'auto'
export type ColorScheme = 'light' | 'dark'

// Appearance is a device preference, not part of the version-one journey or its backup.
export const APPEARANCE_STORAGE_KEY = 'kanso-pro:appearance:v1'
export const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'

export function parseColorMode(raw: string | null): ColorMode | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const setting = value as Record<string, unknown>
    return setting.version === 1 && (setting.mode === 'light' || setting.mode === 'dark' || setting.mode === 'auto') ? setting.mode : null
  } catch { return null }
}

export function serializeColorMode(mode: ColorMode): string {
  return JSON.stringify({ version: 1, mode })
}

export function resolveColorScheme(mode: ColorMode, systemDark: boolean): ColorScheme {
  return mode === 'auto' ? systemDark ? 'dark' : 'light' : mode
}

export function applyColorScheme(mode: ColorMode, systemDark: boolean): void {
  const scheme = resolveColorScheme(mode, systemDark)
  document.documentElement.dataset.colorMode = mode
  document.documentElement.dataset.theme = scheme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', scheme === 'dark' ? '#0c1724' : '#eaf5fc')
}

/** Vite injects this small synchronous head script before styles/body in dev AND builds.
 * Serialize the same validation/resolution functions used at runtime: no second ruleset,
 * remote request, unsafe HTML, account data, or flash of the wrong saved color scheme.
 */
export function appearanceBootstrapScript(): string {
  return `(() => {
    const parseColorMode = ${parseColorMode.toString()};
    const resolveColorScheme = ${resolveColorScheme.toString()};
    const applyColorScheme = ${applyColorScheme.toString()};
    let mode = 'auto';
    let dark = false;
    try { mode = parseColorMode(localStorage.getItem(${JSON.stringify(APPEARANCE_STORAGE_KEY)})) || 'auto'; } catch {}
    try { dark = window.matchMedia(${JSON.stringify(COLOR_SCHEME_QUERY)}).matches; } catch {}
    applyColorScheme(mode, dark);
  })();`
}
