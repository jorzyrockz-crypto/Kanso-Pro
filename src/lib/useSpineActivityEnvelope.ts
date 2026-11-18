import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SpaceActivity } from '../types'

export const SPINE_ACTIVITY_ENVELOPE_KEY = 'kanso-pro:spine-activity-envelope:v1'
const MAX_ACTIVITY_IDS = 240

export interface SpineActivityLedger {
  known: string[]
  opened: string[]
}

interface SpineActivityEnvelopeState {
  version: 1
  spaces: Record<string, SpineActivityLedger>
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 1024))].slice(0, MAX_ACTIVITY_IDS)
}

function ledger(value: unknown): SpineActivityLedger | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  if (!Array.isArray(candidate.known) || !Array.isArray(candidate.opened)) return null
  return { known: uniqueIds(candidate.known), opened: uniqueIds(candidate.opened) }
}

export function parseSpineActivityEnvelopeState(raw: string | null): SpineActivityEnvelopeState | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const candidate = value as Record<string, unknown>
    if (candidate.version !== 1 || !candidate.spaces || typeof candidate.spaces !== 'object' || Array.isArray(candidate.spaces)) return null
    return {
      version: 1,
      spaces: Object.fromEntries(Object.entries(candidate.spaces as Record<string, unknown>).flatMap(([spaceId, value]) => {
        const parsed = ledger(value)
        return spaceId.length > 0 && spaceId.length <= 180 && parsed ? [[spaceId, parsed]] : []
      })),
    }
  } catch { return null }
}

function loadState(): SpineActivityEnvelopeState {
  try { return parseSpineActivityEnvelopeState(localStorage.getItem(SPINE_ACTIVITY_ENVELOPE_KEY)) ?? { version: 1, spaces: {} } }
  catch { return { version: 1, spaces: {} } }
}

function persistState(next: SpineActivityEnvelopeState) {
  try { localStorage.setItem(SPINE_ACTIVITY_ENVELOPE_KEY, JSON.stringify(next)) } catch { /* The envelope still works until this tab closes. */ }
}

/** Only teammate updates relevant to this member belong in the unopened spine envelope. */
export function relevantSpineActivity(activity: SpaceActivity[], memberName: string) {
  return activity.filter((entry) => entry.actor !== memberName && (!entry.target || entry.target === memberName))
}

/** The first observation is a quiet baseline; later unknown entries become unopened mail. */
export function reconcileSpineActivityLedger(current: SpineActivityLedger | undefined, activity: SpaceActivity[]) {
  const ids = uniqueIds(activity.map((entry) => entry.id))
  if (!current) return { ledger: { known: ids, opened: ids }, incoming: [] as SpaceActivity[] }
  const known = new Set(current.known)
  const incoming = activity.filter((entry) => !known.has(entry.id))
  return {
    ledger: {
      known: uniqueIds([...ids, ...current.known]),
      opened: uniqueIds(current.opened),
    },
    incoming,
  }
}

function sameIds(first: string[], second: string[]) {
  return first.length === second.length && first.every((id, index) => id === second[index])
}

/**
 * Keeps a small, per-Space inbox marker for teammate activity. It deliberately does not
 * reuse route-based activity dots: visiting a destination should not open the envelope.
 */
export function useSpineActivityEnvelope(spaceId: string, shared: boolean, activity: SpaceActivity[], memberName: string) {
  const [state, setState] = useState<SpineActivityEnvelopeState>(loadState)
  const stateRef = useRef(state)
  const [arrivalVersion, setArrivalVersion] = useState(0)
  const relevant = useMemo(() => shared ? relevantSpineActivity(activity, memberName) : [], [activity, memberName, shared])

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => {
    if (!shared) return
    const current = stateRef.current
    const result = reconcileSpineActivityLedger(current.spaces[spaceId], relevant)
    const prior = current.spaces[spaceId]
    if (prior && sameIds(prior.known, result.ledger.known) && sameIds(prior.opened, result.ledger.opened)) return
    const next = { ...current, spaces: { ...current.spaces, [spaceId]: result.ledger } }
    stateRef.current = next
    setState(next)
    persistState(next)
    if (result.incoming.length) setArrivalVersion((version) => version + 1)
  }, [relevant, shared, spaceId])

  const unopened = useMemo(() => {
    const current = state.spaces[spaceId]
    if (!shared || !current) return []
    const known = new Set(current.known)
    const opened = new Set(current.opened)
    return relevant.filter((entry) => known.has(entry.id) && !opened.has(entry.id))
  }, [relevant, shared, spaceId, state.spaces])

  const open = useCallback((ids: string[]) => {
    if (!shared || !ids.length) return
    const current = stateRef.current
    const prior = current.spaces[spaceId]
    if (!prior) return
    const opened = uniqueIds([...ids, ...prior.opened])
    if (sameIds(opened, prior.opened)) return
    const next = { ...current, spaces: { ...current.spaces, [spaceId]: { ...prior, opened } } }
    stateRef.current = next
    setState(next)
    persistState(next)
  }, [shared, spaceId])

  return { unopened, arrivalVersion, open }
}
