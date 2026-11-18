import { useCallback, useEffect, useRef, useState } from 'react'
import type { JourneyCard, SpaceActivity } from '../types'
import { addNotifications, emptyNotifications, NOTIFICATIONS_KEY, parseNotifications, quietNow, reconcileReminders, safeNotificationPath } from './notifications'
import type { NotificationPreferences, NotificationState, PlannerNotification } from './notifications'

const permissionNow = () => { try { return 'Notification' in window ? Notification.permission : 'unsupported' as const } catch { return 'unsupported' as const } }
type BadgeNavigator = Partial<Pick<Navigator, 'setAppBadge' | 'clearAppBadge'>>
const REMINDER_ATTENTION_DURATION = 800

/** Local workspace notifications deliberately share the same browser/origin scope as cards, not an account. */
export function useNotifications(cards: JourneyCard[]) {
  const [state, setState] = useState(() => { try { return parseNotifications(localStorage.getItem(NOTIFICATIONS_KEY)) ?? emptyNotifications() } catch { return emptyNotifications() } })
  const memory = useRef(state)
  const queue = useRef(Promise.resolve())
  const cardsRef = useRef(cards)
  cardsRef.current = cards
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [permission, setPermission] = useState(permissionNow)
  const [feedback, setFeedback] = useState('')
  const [announcement, setAnnouncement] = useState<{ id: string; message: string; href: string; notificationId?: string } | null>(null)
  const [reminderAttentionIds, setReminderAttentionIds] = useState<string[]>([])
  const reminderAttentionTimer = useRef<number | null>(null)
  const phoneSupported = import.meta.env.PROD && window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator

  const showReminderAttention = useCallback((cardIds: string[]) => {
    if (!cardIds.length) return
    setReminderAttentionIds(current => [...new Set([...current, ...cardIds])])
    if (reminderAttentionTimer.current !== null) window.clearTimeout(reminderAttentionTimer.current)
    reminderAttentionTimer.current = window.setTimeout(() => {
      reminderAttentionTimer.current = null
      setReminderAttentionIds([])
    }, REMINDER_ATTENTION_DURATION)
  }, [])
  useEffect(() => () => {
    if (reminderAttentionTimer.current !== null) window.clearTimeout(reminderAttentionTimer.current)
  }, [])

  const change = useCallback((mutate: (current: NotificationState) => NotificationState | Promise<NotificationState>) => {
    const run = async () => {
      let current = memory.current
      try { current = parseNotifications(localStorage.getItem(NOTIFICATIONS_KEY)) ?? current } catch { setStorageAvailable(false) }
      const next = await mutate(current)
      const raw = JSON.stringify(next)
      memory.current = next
      setState(previous => JSON.stringify(previous) === raw ? previous : next)
      try {
        if (localStorage.getItem(NOTIFICATIONS_KEY) !== raw) localStorage.setItem(NOTIFICATIONS_KEY, raw)
        setStorageAvailable(true)
      } catch { setStorageAvailable(false) }
    }
    const operation = async () => {
      let started = false
      if (navigator.locks) {
        try { await navigator.locks.request(NOTIFICATIONS_KEY, () => { started = true; return run() }); return }
        catch (error) { if (started) throw error } // Restricted locks must not disable a local inbox.
      }
      await run()
    }
    const pending = queue.current.then(operation, operation)
    queue.current = pending.catch(() => { setFeedback('Notification settings could not be saved. Your planner is unchanged.') })
    return queue.current
  }, [])

  const evaluate = useCallback(() => change(async current => {
    const now = new Date()
    const result = reconcileReminders(current, cardsRef.current, now)
    let next = result.state
    const visible = document.visibilityState === 'visible'
    const pending = next.items.filter(item => !item.read && next.pendingPhone.includes(item.id))
    if (visible) {
      const arriving = [...new Map([...pending, ...result.incoming].map(item => [item.id, item])).values()]
      showReminderAttention(result.attentionCardIds)
      if (arriving.length) setAnnouncement({ id: arriving.map(item => item.id).join('|'), message: arriving.length === 1 ? arriving[0].title : `${arriving.length} new planner notifications`, href: arriving.length === 1 ? arriving[0].href : '/notifications', notificationId: arriving.length === 1 ? arriving[0].id : undefined })
      next = { ...next, pendingPhone: [] }
    } else if (next.preferences.phone && permissionNow() === 'granted') {
      const candidates = new Set([...next.pendingPhone, ...result.incoming.map(item => item.id)])
      next = { ...next, pendingPhone: next.items.filter(item => !item.read && candidates.has(item.id)).map(item => item.id) }
      const ready = next.items.filter(item => !item.read && next.pendingPhone.includes(item.id))
      if (phoneSupported && ready.length && !quietNow(next.preferences, now)) {
        try {
          const registration = await navigator.serviceWorker.getRegistration()
          if (registration?.active) {
            // Lock-screen text intentionally omits card titles, account details, and private notes.
            const options = (item: PlannerNotification | null): NotificationOptions => ({ body: item ? 'A plan needs your attention. Open Kanso Pro to view it.' : `${ready.length} planner reminders are ready to review.`, icon: '/icons/icon-192.png', badge: '/icons/icon-96.png', tag: item ? `kanso-pro-${item.id}` : 'kanso-pro-reminder-summary', data: { url: item?.href ?? '/notifications', id: item?.id }, renotify: false } as NotificationOptions)
            if (pending.length || ready.length > 3) await registration.showNotification('Kanso Pro · Reminder summary', options(null))
            else for (const item of ready) await registration.showNotification('Kanso Pro · Planner reminder', options(item))
            next = { ...next, pendingPhone: [] }
          }
        } catch { /* Keep queued reminders for the next opportunity; never block planning. */ }
      }
    } else next = { ...next, pendingPhone: [] }
    return next
  }), [change, phoneSupported, showReminderAttention])

  useEffect(() => { void evaluate() }, [cards, evaluate])
  useEffect(() => {
    const refresh = () => { setPermission(permissionNow()); void evaluate() }
    const stored = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== NOTIFICATIONS_KEY && event.key !== null)) return
      const next = parseNotifications(event.newValue) ?? emptyNotifications()
      memory.current = next
      setState(next)
    }
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', stored)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('storage', stored); document.removeEventListener('visibilitychange', refresh) }
  }, [evaluate])

  const unread = state.items.filter(item => !item.read).length
  useEffect(() => {
    const api = navigator as BadgeNavigator
    try {
      const operation = state.preferences.badges && unread ? api.setAppBadge?.(unread) : api.clearAppBadge?.()
      void operation?.catch(() => {})
    } catch { /* Badging is optional and does not imply notification permission. */ }
  }, [unread, state.preferences.badges])

  const preferences = (patch: Partial<NotificationPreferences>) => {
    // Reflect a native control immediately; serialize persistence/cross-tab merges separately.
    const optimistic = { ...memory.current, preferences: { ...memory.current.preferences, ...patch } }
    memory.current = optimistic
    setState(optimistic)
    return change(current => ({ ...current, preferences: { ...current.preferences, ...patch } }))
  }
  const phone = async (enabled: boolean) => {
    setFeedback('')
    if (!enabled) { await preferences({ phone: false }); return }
    if (!phoneSupported) { setFeedback('Phone notifications need a supported, secure production app. In-app reminders still work.'); return }
    try {
      const result = await Notification.requestPermission() // Directly from the user’s click; never on startup.
      setPermission(result)
      await preferences({ phone: result === 'granted' })
      if (result !== 'granted') setFeedback(result === 'denied' ? 'Notifications are blocked. Allow notifications for this site in your browser or system settings, then try again. On iPhone/iPad, use the installed Home Screen app.' : 'Permission was not granted. You can keep using the bell without phone notifications.')
    } catch { setFeedback('This browser could not enable phone notifications. The in-app bell remains available.') }
  }
  const markRead = useCallback((id?: string) => change(current => ({ ...current, items: current.items.map(item => !id || item.id === id ? { ...item, read: true } : item), pendingPhone: id ? current.pendingPhone.filter(value => value !== id) : [] })), [change])
  const addUpdate = useCallback((version: string, title: string) => change(current => addNotifications(current, [{ id: `update:${version}`, kind: 'update', title: 'A new version of Kanso Pro is ready', detail: title, href: '/settings#about', createdAt: Date.now(), read: false }])), [change])
  const addCollaboration = useCallback((spaceId: string, entry: SpaceActivity) => {
    const href = safeNotificationPath(entry.href) ? entry.href : '/notifications'
    const item: PlannerNotification = { id: `team:${spaceId}:${entry.id}`, kind: 'team', title: entry.title.slice(0, 240), detail: entry.detail.slice(0, 400), href, createdAt: new Date(entry.createdAt).getTime() || Date.now(), read: false }
    void change(current => addNotifications(current, [item]))
    if (document.visibilityState === 'visible') {
      setAnnouncement({ id: item.id, message: item.title, href: item.href, notificationId: item.id })
      return
    }
    if (!state.preferences.phone || permissionNow() !== 'granted' || !phoneSupported) return
    void navigator.serviceWorker.getRegistration().then((registration) => registration?.showNotification('Kanso Pro · Space activity', {
      body: 'A teammate updated your Space. Open Kanso Pro to review it.', icon: '/icons/icon-192.png', badge: '/icons/icon-96.png', tag: `kanso-pro-${item.id}`, data: { url: item.href, id: item.id }, renotify: false,
    } as NotificationOptions)).catch(() => {})
  }, [change, phoneSupported, state.preferences.phone])

  return { state, unread, storageAvailable, permission, phoneSupported, feedback, announcement, reminderAttentionIds, preferences, phone, markRead, addUpdate, addCollaboration }
}
export type NotificationsController = ReturnType<typeof useNotifications>
