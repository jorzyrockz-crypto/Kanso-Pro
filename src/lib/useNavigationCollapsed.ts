import { useCallback, useLayoutEffect, useState } from 'react'
import { applyNavigationCollapsed, NAVIGATION_STORAGE_KEY, parseNavigationCollapsed } from './navigationPreference'

export function useNavigationCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return parseNavigationCollapsed(localStorage.getItem(NAVIGATION_STORAGE_KEY)) } catch { return false }
  })

  useLayoutEffect(() => { applyNavigationCollapsed(collapsed) }, [collapsed])

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current
      try { localStorage.setItem(NAVIGATION_STORAGE_KEY, JSON.stringify({ version: 1, collapsed: next })) } catch { /* private mode: keep the session choice */ }
      return next
    })
  }, [])

  return [collapsed, toggle] as const
}
