import { useLayoutEffect, useRef } from 'react'

/** Keep page/scroll insets in sync with navigation, text size, and device safe areas. */
export function useChromeHeight<T extends HTMLElement>(property: '--topbar-height' | '--navigation-height') {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const root = document.documentElement
    const updateHeight = () => {
      const height = `${Math.ceil(element.getBoundingClientRect().height)}px`
      root.style.setProperty(property, height)
      // --hdr-h is the public header measurement used by new sticky surfaces.
      // Keep the established --topbar-height alias so existing layouts stay aligned.
      if (property === '--topbar-height') root.style.setProperty('--hdr-h', height)
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.style.removeProperty(property)
      if (property === '--topbar-height') root.style.removeProperty('--hdr-h')
    }
  }, [property])

  return ref
}
