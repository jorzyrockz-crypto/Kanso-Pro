import { useEffect, useRef, useState } from 'react'

interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** One app-lifetime registration. Installation/update never touches planner or auth storage. */
export function usePwa() {
  const [installed, setInstalled] = useState(standalone)
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const [offlineReady, setOfflineReady] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [updateReady, setUpdateReady] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState('')
  const registration = useRef<ServiceWorkerRegistration | null>(null)
  const reloadRequested = useRef(false)

  useEffect(() => {
    const offer = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt) }
    const didInstall = () => { setInstalled(true); setInstallPrompt(null) }
    const media = window.matchMedia('(display-mode: standalone)')
    const displayChanged = () => setInstalled(standalone())
    const connection = () => {
      setOnline(navigator.onLine)
      if (navigator.onLine) void registration.current?.update().catch(() => {})
    }
    window.addEventListener('beforeinstallprompt', offer)
    window.addEventListener('appinstalled', didInstall)
    window.addEventListener('online', connection)
    window.addEventListener('offline', connection)
    media.addEventListener('change', displayChanged)
    return () => {
      window.removeEventListener('beforeinstallprompt', offer)
      window.removeEventListener('appinstalled', didInstall)
      window.removeEventListener('online', connection)
      window.removeEventListener('offline', connection)
      media.removeEventListener('change', displayChanged)
    }
  }, [])

  useEffect(() => {
    if (!import.meta.env.PROD || !window.isSecureContext || !('serviceWorker' in navigator)) return
    let disposed = false
    let registered: ServiceWorkerRegistration | undefined
    let installingWorker: ServiceWorker | null = null
    const stateChanged = () => {
      if (disposed) return
      if (installingWorker?.state === 'installed') {
        setOfflineReady(true)
        setUpdateReady(!!navigator.serviceWorker.controller)
      } else if (installingWorker?.state === 'redundant') setError('Offline setup could not finish. Reconnect and reopen the app to try again. Your saved plans are unchanged.')
    }
    const found = () => {
      installingWorker?.removeEventListener('statechange', stateChanged)
      installingWorker = registered?.installing ?? null
      installingWorker?.addEventListener('statechange', stateChanged)
    }
    const controlled = () => {
      setOfflineReady(true)
      setUpdateReady(false)
      if (reloadRequested.current) window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', controlled)
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then((value) => {
      if (disposed) return
      registered = value
      registration.current = value
      setUpdateReady(!!value.waiting)
      setOfflineReady(!!value.active)
      value.addEventListener('updatefound', found)
      found()
      void navigator.serviceWorker.ready.then(() => { if (!disposed) setOfflineReady(true) })
    }).catch(() => { if (!disposed) setError('Offline setup is unavailable in this browser. Your local planner still works while this page is open.') })
    return () => {
      disposed = true
      registered?.removeEventListener('updatefound', found)
      installingWorker?.removeEventListener('statechange', stateChanged)
      navigator.serviceWorker.removeEventListener('controllerchange', controlled)
    }
  }, [])

  const install = async () => {
    if (!installPrompt || installing) return
    setInstalling(true)
    setError('')
    try {
      await installPrompt.prompt()
      if ((await installPrompt.userChoice).outcome === 'accepted') setInstalled(true)
    } catch { setError('Installation could not open. Use your browser’s install or Add to Home Screen menu instead.') }
    finally { setInstallPrompt(null); setInstalling(false) }
  }
  const update = () => {
    if (!registration.current?.waiting) return
    reloadRequested.current = true
    registration.current.waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  return { installed, canInstall: !!installPrompt, installing, install, update, updateReady, offlineReady, online, error, development: import.meta.env.DEV }
}
export type PwaController = ReturnType<typeof usePwa>
