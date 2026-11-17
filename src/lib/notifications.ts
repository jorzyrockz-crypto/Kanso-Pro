import type { JourneyCard } from '../types'
import { destinationPath } from './navigation'
import { isValidDate } from './journey'

export const NOTIFICATIONS_KEY = 'kanso-pro:notifications:v1'
export const MAX_NOTIFICATIONS = 60
export type NotificationKind = 'event' | 'task' | 'project' | 'update' | 'team'
export interface PlannerNotification {
  id: string
  kind: NotificationKind
  title: string
  detail: string
  href: string
  createdAt: number
  read: boolean
}
export interface NotificationPreferences {
  phone: boolean
  badges: boolean
  quiet: boolean
  quietStart: string
  quietEnd: string
  events: boolean
  tasks: boolean
  projects: boolean
}
export interface NotificationState {
  version: 1
  initialized: boolean
  seen: Record<string, string>
  items: PlannerNotification[]
  pendingPhone: string[]
  preferences: NotificationPreferences
}
export const defaultPreferences = (): NotificationPreferences => ({ phone: false, badges: true, quiet: true, quietStart: '19:00', quietEnd: '06:00', events: true, tasks: true, projects: true })
export const emptyNotifications = (): NotificationState => ({ version: 1, initialized: false, seen: {}, items: [], pendingPhone: [], preferences: defaultPreferences() })
export const validTime = (time: unknown): time is string => typeof time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)
export const safeNotificationPath = (value: unknown): value is string => typeof value === 'string' && value.length < 4096 && /^\/(?:notifications|settings(?:#about)?|calendar(?:\/[^/?#]+)?|tasks(?:\/[^/?#]+)?|projects?(?:\/[^/?#]+)?|journal(?:\/[^/?#]+)?)$/.test(value)

/** A notification must not silently replace an unfinished form in this window. */
export function confirmNotificationNavigation(event?: Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>): boolean {
  if (event && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return true
  return !document.querySelector('form:not([data-unsaved="false"])') || window.confirm('Open this notification? The unfinished form will close. Your saved plans stay on this device.')
}

export function parseNotifications(raw: string | null): NotificationState | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as NotificationState
    if (!value || value.version !== 1 || typeof value.initialized !== 'boolean' || !Array.isArray(value.items) || !value.preferences || !value.seen || typeof value.seen !== 'object' || Array.isArray(value.seen)) return null
    const p = value.preferences
    if (!['phone', 'badges', 'quiet', 'events', 'tasks', 'projects'].every(key => typeof p[key as keyof NotificationPreferences] === 'boolean') || !validTime(p.quietStart) || !validTime(p.quietEnd) || p.quietStart === p.quietEnd) return null
    const items = value.items.filter(item => item && typeof item.id === 'string' && item.id.length < 4096 && ['event', 'task', 'project', 'update', 'team'].includes(item.kind) && typeof item.title === 'string' && typeof item.detail === 'string' && safeNotificationPath(item.href) && Number.isFinite(item.createdAt) && Number.isFinite(new Date(item.createdAt).getTime()) && typeof item.read === 'boolean')
      .map(item => ({ id: item.id, kind: item.kind, title: item.title.slice(0, 240), detail: item.detail.slice(0, 400), href: item.href, createdAt: item.createdAt, read: item.read }))
    return {
      version: 1, initialized: value.initialized,
      seen: Object.fromEntries(Object.entries(value.seen).filter(([key, entry]) => key.length < 1024 && typeof entry === 'string' && entry.length < 120).slice(0, 10000)),
      items: [...new Map(items.map(item => [item.id, item])).values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_NOTIFICATIONS),
      pendingPhone: Array.isArray(value.pendingPhone) ? value.pendingPhone.filter((id): id is string => typeof id === 'string' && items.some(item => item.id === id && !item.read)).slice(0, MAX_NOTIFICATIONS) : [],
      preferences: { phone: p.phone, badges: p.badges, quiet: p.quiet, quietStart: p.quietStart, quietEnd: p.quietEnd, events: p.events, tasks: p.tasks, projects: p.projects },
    }
  } catch { return null }
}

export function quietNow(preferences: NotificationPreferences, now: Date): boolean {
  if (!preferences.quiet || preferences.quietStart === preferences.quietEnd) return false
  const minutes = now.getHours() * 60 + now.getMinutes()
  const asMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  const start = asMinutes(preferences.quietStart), end = asMinutes(preferences.quietEnd)
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}

export function reminderFor(card: JourneyCard) {
  if (card.type === 'note') return null
  if ((card.type === 'task' || card.type === 'project') && card.subtasks.length > 0 && card.subtasks.every(item => item.done)) return null
  const date = card.type === 'project' ? card.dueDate : card.date
  const time = card.type === 'event' ? card.allDay ? '08:00' : card.time : card.type === 'task' ? card.reminder ?? '09:00' : '09:00'
  if (!isValidDate(date) || !validTime(time)) return null
  const at = new Date(`${date}T${time}:00`).getTime() // Device-local date/time, never UTC midnight.
  if (!Number.isFinite(at)) return null
  return { at, key: `${card.type}:${date}:${time}`, date, time }
}

export function addNotifications(state: NotificationState, incoming: PlannerNotification[]): NotificationState {
  const merged = new Map(state.items.map(item => [item.id, item]))
  for (const item of incoming) if (!merged.has(item.id)) merged.set(item.id, item)
  const items = [...merged.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_NOTIFICATIONS)
  return { ...state, items, pendingPhone: state.pendingPhone.filter(id => items.some(item => item.id === id && !item.read)) }
}

/** First evaluation silently baselines existing deadlines; later openings catch missed deadlines. */
export function reconcileReminders(state: NotificationState, cards: JourneyCard[], now: Date) {
  const ids = new Set(cards.map(card => card.id))
  const seen = Object.fromEntries(Object.entries(state.seen).filter(([id]) => ids.has(id)))
  const incoming: PlannerNotification[] = []
  const retainedIds = new Set(state.items.map(item => item.id))
  for (const card of cards) {
    const reminder = reminderFor(card)
    if (!reminder || reminder.at > now.getTime()) continue
    const previous = Object.prototype.hasOwnProperty.call(seen, card.id) ? seen[card.id] : undefined
    if (previous === reminder.key) continue
    Object.defineProperty(seen, card.id, { value: reminder.key, writable: true, enumerable: true, configurable: true })
    const enabled = card.type === 'event' ? state.preferences.events : card.type === 'task' ? state.preferences.tasks : state.preferences.projects
    if (!state.initialized || !enabled || card.type === 'note') continue
    const id = `${card.type}:${encodeURIComponent(card.id)}:${reminder.at}`
    if (retainedIds.has(id)) continue
    incoming.push({
      id, kind: card.type,
      title: `${card.type === 'event' ? 'Event reminder' : card.type === 'task' ? 'Task reminder' : 'Project due'} · ${card.title || 'Untitled plan'}`.slice(0, 240),
      detail: `${reminder.date} · ${reminder.time} · ${card.type === 'project' ? 'Due date' : 'Your device’s local time'}`,
      href: destinationPath({ page: card.type === 'event' ? 'calendar' : card.type === 'task' ? 'tasks' : 'project', cardId: card.id }),
      createdAt: now.getTime(), read: false,
    })
  }
  return { state: addNotifications({ ...state, seen, initialized: true }, incoming), incoming }
}
