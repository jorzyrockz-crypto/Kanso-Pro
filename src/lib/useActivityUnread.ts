import { useEffect, useMemo, useRef, useState } from 'react'
import type { SpaceActivity } from '../types'
import { activityModuleForHref } from './collaboration'

const STORAGE_KEY = 'kanso-pro:activity-read:v1'

type ReadState = Record<string, string[]>

function loadReadState(): ReadState {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).flatMap(([spaceId, ids]) =>
      typeof spaceId === 'string' && Array.isArray(ids) ? [[spaceId, ids.filter((id): id is string => typeof id === 'string').slice(-240)]] : [],
    ))
  } catch { return {} }
}

function persist(state: ReadState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* Dots remain useful for this session. */ }
}

/**
 * Sidebar dots track teammate activity by destination. A Space's existing feed is silently
 * baselined on first visit so opening an established shared Space never creates a red wall.
 */
export function useActivityUnread(spaceId: string, activity: SpaceActivity[], memberName: string, pathname: string) {
  const [read, setRead] = useState<ReadState>(loadReadState)
  const initialized = useRef(new Set(Object.keys(read)))

  useEffect(() => {
    if (initialized.current.has(spaceId)) return
    initialized.current.add(spaceId)
    setRead((current) => {
      const next = { ...current, [spaceId]: activity.map((entry) => entry.id).slice(-240) }
      persist(next)
      return next
    })
  }, [spaceId, activity])

  const activeModule = useMemo(() => activityModuleForHref(pathname), [pathname])
  useEffect(() => {
    if (!initialized.current.has(spaceId)) return
    const ids = activity.filter((entry) => activityModuleForHref(entry.href) === activeModule).map((entry) => entry.id)
    if (!ids.length) return
    setRead((current) => {
      const existing = current[spaceId] ?? []
      const merged = [...new Set([...existing, ...ids])].slice(-240)
      if (existing.length === merged.length && existing.every((id, index) => id === merged[index])) return current
      const next = { ...current, [spaceId]: merged }
      persist(next)
      return next
    })
  }, [activity, activeModule, spaceId])

  return useMemo(() => {
    const seen = new Set(read[spaceId] ?? [])
    return Object.fromEntries(['timeline', 'calendar', 'tasks', 'project', 'journal'].map((module) => [module,
      activity.some((entry) => entry.actor !== memberName && activityModuleForHref(entry.href) === module && !seen.has(entry.id)),
    ])) as Record<'timeline' | 'calendar' | 'tasks' | 'project' | 'journal', boolean>
  }, [activity, memberName, read, spaceId])
}
