import { useEffect, useState } from 'react'
import { currentLocalMonth, nextLocalDayDelay } from './currentMonth'

/** Keep an open sign-in page current across midnight, tab suspension, and clock changes. */
export function useCurrentMonth() {
  const [month, setMonth] = useState(currentLocalMonth)

  useEffect(() => {
    let timer: number
    const refresh = () => {
      const now = new Date()
      setMonth(currentLocalMonth(now))
      window.clearTimeout(timer)
      timer = window.setTimeout(refresh, nextLocalDayDelay(now))
    }
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return month
}
