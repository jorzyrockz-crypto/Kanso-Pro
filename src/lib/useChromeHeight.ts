import { useLayoutEffect, useRef } from 'react'

/** Keep page/scroll insets in sync with navigation, text size, and device safe areas. */
export function useChromeHeight<T extends HTMLElement>(property: '--topbar-height' | '--bottom-bar-height') {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const root = document.documentElement
    const updateHeight = () => root.style.setProperty(property, `${Math.ceil(element.getBoundingClientRect().height)}px`)
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.style.removeProperty(property)
    }
  }, [property])

  return ref
}
