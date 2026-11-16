// Like appearance, the desktop rail width is a device preference and is never synced or backed up.
export const NAVIGATION_STORAGE_KEY = 'kanso-pro:navigation:v1'

export function parseNavigationCollapsed(raw: string | null): boolean {
  if (!raw) return false
  try {
    const value: unknown = JSON.parse(raw)
    return !!value && typeof value === 'object' && (value as Record<string, unknown>).version === 1 && (value as Record<string, unknown>).collapsed === true
  } catch { return false }
}

export function applyNavigationCollapsed(collapsed: boolean): void {
  if (collapsed) document.documentElement.dataset.navigation = 'collapsed'
  else delete document.documentElement.dataset.navigation
}

/** Injected before paint so a collapsed rail never flashes open. CSS limits the effect to desktop layouts. */
export function navigationBootstrapScript(): string {
  return `(() => {
    const parseNavigationCollapsed = ${parseNavigationCollapsed.toString()};
    try { if (parseNavigationCollapsed(localStorage.getItem(${JSON.stringify(NAVIGATION_STORAGE_KEY)}))) document.documentElement.dataset.navigation = 'collapsed'; } catch {}
  })();`
}
