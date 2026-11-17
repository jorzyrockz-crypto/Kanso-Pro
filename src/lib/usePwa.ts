import { useCallback, useEffect, useRef, useState } from 'react'
import { currentBuild, DISMISSED_UPDATE_KEY, isNewBuild, OPEN_UPDATE_INTERVAL, SEEN_BUILD_KEY, shouldCheckOnResume } from './updates'
import releases from './whats-new.json'

interface InstallPrompt extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
interface WindowOverlay extends EventTarget { visible: boolean }
const overlayApi = () => (navigator as Navigator & { windowControlsOverlay?: WindowOverlay }).windowControlsOverlay
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: window-controls-overlay)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

function workerVersion(worker: ServiceWorker | null): Promise<string | null> {
  if (!worker) return Promise.resolve(null)
  return new Promise(resolve => {
    const channel = new MessageChannel()
    const finish = (version: string | null) => { clearTimeout(timeout); channel.port1.close(); resolve(version) }
    const timeout = window.setTimeout(() => finish(null), 1500)
    channel.port1.onmessage = event => finish(typeof event.data?.version === 'string' ? event.data.version : null)
    try { worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]) } catch { finish(null) }
  })
}
function installedWorker(worker: ServiceWorker): Promise<void> {
  if (['installed', 'activated', 'redundant'].includes(worker.state)) return Promise.resolve()
  return new Promise(resolve => {
    const done = () => { clearTimeout(timeout); worker.removeEventListener('statechange', changed); resolve() }
    const changed = () => { if (['installed', 'activated', 'redundant'].includes(worker.state)) done() }
    const timeout = window.setTimeout(done, 15_000)
    worker.addEventListener('statechange', changed)
  })
}

/** One app-lifetime registration. No automatic reload, planner mutation, or auth caching. */
export function usePwa() {
  const build = import.meta.env.PROD ? currentBuild() : 'development'
  const [installed, setInstalled] = useState(standalone)
  const [overlay, setOverlay] = useState(() => !!overlayApi()?.visible)
  const [coarse, setCoarse] = useState(() => window.matchMedia('(pointer: coarse)').matches)
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const [offlineReady, setOfflineReady] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [updateVersion, setUpdateVersion] = useState('')
  const [installing, setInstalling] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkStatus, setCheckStatus] = useState('')
  const [updatedNotice, setUpdatedNotice] = useState('')
  const [error, setError] = useState('')
  const [dismissed, setDismissed] = useState(() => { try { return sessionStorage.getItem(DISMISSED_UPDATE_KEY) ?? '' } catch { return '' } })
  const registration = useRef<ServiceWorkerRegistration | null>(null)
  const reloadRequested = useRef(false)
  const activatedElsewhere = useRef(false)
  const checkImpl = useRef<((manual: boolean) => Promise<void>) | null>(null)
  const checkForUpdates = useCallback(async () => {
    if (import.meta.env.DEV) { setCheckStatus('Update checks run in the production app, not the development server.'); return }
    if (!checkImpl.current) { setCheckStatus('Offline setup is not ready yet. Reconnect and try again.'); return }
    await checkImpl.current(true)
  }, [])

  useEffect(() => {
    if (import.meta.env.DEV) return
    try {
      const previous = localStorage.getItem(SEEN_BUILD_KEY)
      if (isNewBuild(previous, build)) setUpdatedNotice(previous!.split('+')[0] === build.split('+')[0] ? 'Kanso Pro is up to date.' : `Updated · ${releases[0].title}`)
      localStorage.setItem(SEEN_BUILD_KEY, build)
    } catch { /* Release feedback is optional when browser storage is blocked. */ }
  }, [build])

  useEffect(() => {
    const offer = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt) }
    const didInstall = () => { setInstalled(true); setInstallPrompt(null) }
    const media = window.matchMedia('(display-mode: standalone)')
    const pointer = window.matchMedia('(pointer: coarse)')
    const displayChanged = () => { setInstalled(standalone()); setOverlay(!!overlayApi()?.visible); setCoarse(pointer.matches) }
    const connection = () => { setOnline(navigator.onLine); if (navigator.onLine) void checkImpl.current?.(false) }
    const overlay = overlayApi()
    window.addEventListener('beforeinstallprompt', offer); window.addEventListener('appinstalled', didInstall)
    window.addEventListener('online', connection); window.addEventListener('offline', connection)
    media.addEventListener('change', displayChanged); pointer.addEventListener('change', displayChanged)
    overlay?.addEventListener('geometrychange', displayChanged)
    return () => {
      window.removeEventListener('beforeinstallprompt', offer); window.removeEventListener('appinstalled', didInstall)
      window.removeEventListener('online', connection); window.removeEventListener('offline', connection)
      media.removeEventListener('change', displayChanged); pointer.removeEventListener('change', displayChanged)
      overlay?.removeEventListener('geometrychange', displayChanged)
    }
  }, [])

  useEffect(() => {
    if (!import.meta.env.PROD || !window.isSecureContext || !('serviceWorker' in navigator)) return
    let disposed = false, lastChecked = Date.now(), busy = false
    let registered: ServiceWorkerRegistration | undefined
    let installingWorker: ServiceWorker | null = null
    let hadController = !!navigator.serviceWorker.controller
    const refresh = async () => {
      if (!registered || disposed) return false
      const waiting = registered.waiting
      const waitingVersion = await workerVersion(waiting)
      const activeVersion = waitingVersion === build || activatedElsewhere.current ? await workerVersion(navigator.serviceWorker.controller ?? registered.active) : null
      // Same-version workers are silent, except when a newer page is still controlled by an older shell.
      const ready = waiting && (waitingVersion !== build || activeVersion !== build)
      const version = ready ? waitingVersion ?? 'downloaded-update' : activatedElsewhere.current && activeVersion && activeVersion !== build ? activeVersion : ''
      if (!disposed) { setUpdateVersion(version); setOfflineReady(!!registered.active || !!registered.waiting) }
      return !!version
    }
    const check = async (manual: boolean) => {
      if (busy || !registered) return
      if (!navigator.onLine) { if (manual) setCheckStatus('You’re offline. Reconnect to check for updates; your saved plans are unchanged.'); return }
      busy = true; lastChecked = Date.now()
      if (manual) { setChecking(true); setCheckStatus('Checking for updates…') }
      try {
        await registered.update()
        if (registered.installing) await installedWorker(registered.installing)
        const ready = await refresh()
        if (manual && !disposed) setCheckStatus(ready ? 'A new version is downloaded and ready to restart.' : registered.installing ? 'The new version is still downloading. You can keep working.' : 'Kanso Pro is up to date.')
      } catch { if (manual && !disposed) setCheckStatus('Could not reach the update service. Check your connection and try again. Your plans are safe.') }
      finally { busy = false; if (!disposed) setChecking(false) }
    }
    checkImpl.current = check
    const stateChanged = () => {
      if (disposed) return
      if (installingWorker?.state === 'installed' || installingWorker?.state === 'activated') void refresh()
      else if (installingWorker?.state === 'redundant') setError('Offline setup could not finish. Reconnect and reopen the app to try again. Your saved plans are unchanged.')
    }
    const found = () => { installingWorker?.removeEventListener('statechange', stateChanged); installingWorker = registered?.installing ?? null; installingWorker?.addEventListener('statechange', stateChanged); stateChanged() }
    const controlled = () => {
      if (reloadRequested.current) { window.location.reload(); return }
      activatedElsewhere.current = hadController
      hadController = true
      setOfflineReady(true)
      void refresh()
    }
    const visible = () => { if (document.visibilityState === 'visible' && shouldCheckOnResume(lastChecked, Date.now())) void check(false) }
    const interval = window.setInterval(() => { void check(false) }, OPEN_UPDATE_INTERVAL)
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('focus', visible)
    navigator.serviceWorker.addEventListener('controllerchange', controlled)
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(value => {
      if (disposed) return
      registered = value; registration.current = value
      value.addEventListener('updatefound', found); found(); void refresh()
      // Registration alone is allowed to reuse the browser's normal service-worker
      // freshness window. Ask explicitly once per app launch so a just-deployed shell
      // can become an Update ready banner without waiting for the next timed poll.
      void check(false)
      void navigator.serviceWorker.ready.then(() => { if (!disposed) { setOfflineReady(true); void refresh() } })
    }).catch(() => { if (!disposed) setError('Offline setup is unavailable in this browser. Your local planner still works while this page is open.') })
    return () => {
      disposed = true; checkImpl.current = null; clearInterval(interval)
      document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', visible)
      registered?.removeEventListener('updatefound', found); installingWorker?.removeEventListener('statechange', stateChanged)
      navigator.serviceWorker.removeEventListener('controllerchange', controlled)
    }
  }, [build])

  const install = async () => {
    if (!installPrompt || installing) return
    setInstalling(true); setError('')
    try { await installPrompt.prompt(); if ((await installPrompt.userChoice).outcome === 'accepted') setInstalled(true) }
    catch { setError('Installation could not open. Use your browser’s install or Add to Home Screen menu instead.') }
    finally { setInstallPrompt(null); setInstalling(false) }
  }
  const update = () => {
    if (!registration.current || !updateVersion) return
    if (document.querySelector('form') && !window.confirm('Restart Kanso Pro? The open form will close and unfinished fields will be lost. Your saved cards and preferences stay on this device.')) return
    reloadRequested.current = true
    if (registration.current.waiting) registration.current.waiting.postMessage({ type: 'SKIP_WAITING' })
    else if (activatedElsewhere.current) window.location.reload()
  }
  const dismissUpdate = () => { setDismissed(updateVersion); try { sessionStorage.setItem(DISMISSED_UPDATE_KEY, updateVersion) } catch { /* Session-only fallback. */ } }
  return { installed, overlay, coarse, canInstall: !!installPrompt, installing, install, update, updateReady: !!updateVersion, updateVersion, dismissUpdate, updateDismissed: dismissed === updateVersion, offlineReady, online, error, development: import.meta.env.DEV, build, checking, checkStatus, checkForUpdates, updatedNotice, releaseTitle: releases[0].title }
}
export type PwaController = ReturnType<typeof usePwa>
