import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { pageForPath, SETTINGS_SECTIONS } from '../lib/navigation'

/** Full-page navigation: meaningful titles, focus, and Back/Forward scroll restoration. */
export function RouteEffects({ updateReady = false }: { updateReady?: boolean }) {
  const location = useLocation()
  const navigationType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const activeLocation = useRef(location)
  const previous = useRef<{ path: string; search: string; hash: string } | null>(null)

  useEffect(() => {
    const original = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    // Capture while the page is still mounted, before a shorter page can clamp its scroll.
    const savePosition = () => {
      const active = activeLocation.current
      // React Router can update history before the page transition commits.
      // Ignore layout/scroll events in that interval instead of overwriting the old page.
      if (`${active.pathname}${active.search}${active.hash}` !== `${window.location.pathname}${window.location.search}${window.location.hash}`) return
      positions.current.set(active.key, window.scrollY)
    }
    window.addEventListener('scroll', savePosition, { passive: true })
    return () => {
      window.history.scrollRestoration = original
      window.removeEventListener('scroll', savePosition)
    }
  }, [])

  useEffect(() => {
    document.title = `${updateReady ? 'Update ready · ' : ''}${pageForPath(location.pathname, location.search).label} · Kanso Pro`
  }, [location.pathname, location.search, updateReady])

  useLayoutEffect(() => {
    const last = previous.current
    const pathChanged = last !== null && last.path !== location.pathname
    const onlyHashChanged = last && last.path === location.pathname && last.search === location.search && last.hash !== location.hash
    const savedPosition = positions.current.get(location.key)
    const settingsPage = /^\/settings\/?$/i.test(location.pathname)
    const sectionId = settingsPage ? SETTINGS_SECTIONS.find(({ id }) => location.hash === `#${id}`)?.id : undefined
    activeLocation.current = location

    const frame = requestAnimationFrame(() => {
      const section = sectionId ? document.getElementById(sectionId) : null
      if (section) {
        // Real section URLs work on refresh/new tabs too. Focus without a second
        // browser scroll; CSS scroll margins keep headings below sticky chrome.
        section.focus({ preventScroll: true })
        if (navigationType === 'POP' && savedPosition !== undefined) window.scrollTo({ top: savedPosition, behavior: 'instant' })
        else section.scrollIntoView({ block: 'start', behavior: 'instant' })
      } else if (!onlyHashChanged || (settingsPage && navigationType === 'POP')) {
        // The timeline handles explicit card targets after expanding quiet buffers.
        if ((navigationType === 'POP' || !location.state?.focusCardId) && (pathChanged || navigationType === 'POP')) {
          window.scrollTo({ top: navigationType === 'POP' ? savedPosition ?? 0 : 0, behavior: 'instant' })
        }
        // Keep the browser's natural initial focus so the first Tab reaches the skip link.
        // The creation page may opt in to focusing its title field on a direct visit.
        if (pathChanged || !last || (settingsPage && onlyHashChanged)) {
          const target = document.querySelector<HTMLElement>('[data-page-focus]')
            ?? (pathChanged || onlyHashChanged ? document.querySelector<HTMLElement>('main') : null)
          target?.focus({ preventScroll: true })
        }
      }
      previous.current = { path: location.pathname, search: location.search, hash: location.hash }
    })
    return () => cancelAnimationFrame(frame)
  }, [location.key, location.pathname, location.search, location.hash, location.state, navigationType])

  return null
}
