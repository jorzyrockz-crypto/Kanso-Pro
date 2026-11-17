import { useEffect, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import type { AccountUser } from './account'
import { emptyWorkspace, googleSyncUser, isStarterWorkspace, mergeInitialWorkspace, workspaceChangesSince, workspaceFingerprint } from './workspaceSync'
import type { JourneyAction, JourneyState, Space, SpaceActivity, SpaceMember, SpacePresence } from '../types'

type FirestoreClient = typeof import('./firestore')

/**
 * A Google-issued token enables a local-first workspace mirror. The returned status lets
 * UI copy distinguish device storage from cloud sync; planning stays usable on failure.
 */
export interface WorkspaceSyncStatus {
  /** True only for an active Firebase token issued by Google. */
  enabled: boolean
  /** The active Space received its first server-backed snapshot. */
  ready: boolean
  /** The latest subscription or write bootstrap failed; local planning remains available. */
  unavailable: boolean
}

export function useWorkspaceSync(account: AccountUser | null, state: JourneyState, dispatch: Dispatch<JourneyAction>, space: Space, onMembers?: (spaceId: string, members: SpaceMember[]) => void, onSpace?: (spaceId: string, updates: Pick<Space, 'name' | 'color' | 'icon'>) => void, activity: SpaceActivity[] = [], onActivity?: (spaceId: string, entries: SpaceActivity[]) => void, onPresence?: (spaceId: string, entries: SpacePresence[]) => void): WorkspaceSyncStatus {
  const uid = googleSyncUser(account)
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const stateRef = useRef(state)
  const membersCallbackRef = useRef(onMembers)
  const spaceCallbackRef = useRef(onSpace)
  const activityCallbackRef = useRef(onActivity)
  const presenceCallbackRef = useRef(onPresence)
  const sentActivityIdsRef = useRef(new Set<string>())
  const remoteActivityIdsRef = useRef(new Set<string>())
  const clientRef = useRef<FirestoreClient | null>(null)
  const remoteRef = useRef<JourneyState | null>(null)
  const initializedRef = useRef(false)
  const applyingRemoteRef = useRef('')
  const awaitingRemoteHydrationRef = useRef(false)
  const pendingFingerprintRef = useRef('')
  const priorGoogleUserRef = useRef<string | null>(null)
  const [retry, setRetry] = useState(0)

  stateRef.current = state
  membersCallbackRef.current = onMembers
  spaceCallbackRef.current = onSpace
  activityCallbackRef.current = onActivity
  presenceCallbackRef.current = onPresence

  useEffect(() => {
    const retryPending = () => setRetry((value) => value + 1)
    window.addEventListener('online', retryPending)
    return () => window.removeEventListener('online', retryPending)
  }, [])

  useEffect(() => {
    setReady(false)
    setUnavailable(false)
    clientRef.current = null
    remoteRef.current = null
    initializedRef.current = false
    applyingRemoteRef.current = ''
    awaitingRemoteHydrationRef.current = false
    pendingFingerprintRef.current = ''
    sentActivityIdsRef.current = new Set()
    remoteActivityIdsRef.current = new Set()
    if (!uid) return
    const switchedGoogleUser = priorGoogleUserRef.current !== null && priorGoogleUserRef.current !== uid
    priorGoogleUserRef.current = uid

    let active = true
    let unsubscribe: (() => void) | undefined
    void import('./firestore').then((client) => {
      if (!active) return
      clientRef.current = client
      unsubscribe = client.subscribeWorkspace(uid, { id: space.id, kind: space.kind }, (remote) => {
        if (!active || remote.fromCache) return
        setUnavailable(false)
        if (space.kind === 'shared' && remote.members) membersCallbackRef.current?.(space.id, remote.members)
        if (space.kind === 'shared' && remote.space) spaceCallbackRef.current?.(space.id, remote.space)
        if (space.kind === 'shared' && remote.activity) {
          remote.activity.forEach((entry) => remoteActivityIdsRef.current.add(entry.id))
          activityCallbackRef.current?.(space.id, remote.activity)
        }
        if (space.kind === 'shared' && remote.presence) presenceCallbackRef.current?.(space.id, remote.presence)
        const local = stateRef.current
        const localIsStarter = isStarterWorkspace(local)
        if (!initializedRef.current) {
          initializedRef.current = true
          let next: JourneyState
          if (!remote.exists) {
            next = localIsStarter || switchedGoogleUser ? emptyWorkspace() : local
            remoteRef.current = next
            pendingFingerprintRef.current = workspaceFingerprint(next)
            const create = () => client.createWorkspace(uid, next, { id: space.id, kind: space.kind })
            void (space.kind === 'shared' ? client.writeSpaceMembers(uid, space).then(create) : create()).catch(() => {
              if (active) setUnavailable(true)
            })
          } else {
            next = mergeInitialWorkspace(remote.state, local, !switchedGoogleUser && !localIsStarter, remote.deletedCardIds)
            remoteRef.current = next
            const additions = workspaceChangesSince(remote.state, next)
            if (additions.cards.length || additions.deletedCardIds.length || additions.bezelChanged) {
              pendingFingerprintRef.current = workspaceFingerprint(next)
              void client.writeWorkspace(uid, next, additions.cards, additions.deletedCardIds, { id: space.id, kind: space.kind }).catch(() => {
                if (active) setUnavailable(true)
              })
            }
          }
          applyingRemoteRef.current = workspaceFingerprint(next)
          if (workspaceFingerprint(local) !== applyingRemoteRef.current) {
            awaitingRemoteHydrationRef.current = true
            dispatch({ type: 'hydrate', state: next })
          }
          setReady(true)
          return
        }

        const localFingerprint = workspaceFingerprint(stateRef.current)
        const remoteFingerprint = workspaceFingerprint(remote.state)
        if (localFingerprint === remoteFingerprint) {
          remoteRef.current = remote.state
          applyingRemoteRef.current = ''
          if (!remote.pendingWrites) pendingFingerprintRef.current = ''
          return
        }
        // A local write is still waiting for acknowledgement. Do not briefly replace it
        // with an older server snapshot; the later merged snapshot will be applied.
        if (pendingFingerprintRef.current === localFingerprint) return
        remoteRef.current = remote.state
        applyingRemoteRef.current = remoteFingerprint
        awaitingRemoteHydrationRef.current = true
        dispatch({ type: 'hydrate', state: remote.state })
      }, () => {
        if (active) setUnavailable(true)
      })
    }).catch(() => {
      if (active) setUnavailable(true)
    })

    return () => { active = false; unsubscribe?.() }
  }, [uid, dispatch, space.id, space.kind])

  useEffect(() => {
    if (!ready || !uid || !clientRef.current || !remoteRef.current) return
    const currentFingerprint = workspaceFingerprint(state)
    if (awaitingRemoteHydrationRef.current) {
      // React can schedule this effect before the reducer hydration commits. Do not turn
      // that brief intermediate local state into an outbound cloud write.
      if (applyingRemoteRef.current !== currentFingerprint) return
      awaitingRemoteHydrationRef.current = false
      applyingRemoteRef.current = ''
      return
    }
    if (applyingRemoteRef.current === currentFingerprint) {
      applyingRemoteRef.current = ''
      return
    }
    const changes = workspaceChangesSince(remoteRef.current, state)
    if (!changes.cards.length && !changes.deletedCardIds.length && !changes.bezelChanged) return
    const timer = window.setTimeout(() => {
      const client = clientRef.current
      if (!client) return
      pendingFingerprintRef.current = currentFingerprint
      void client.writeWorkspace(uid, state, changes.cards, changes.deletedCardIds, { id: space.id, kind: space.kind }).catch(() => setUnavailable(true))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [state, ready, uid, retry, space.id, space.kind])

  useEffect(() => {
    const localRole = space.members.find((member) => member.id === 'local-owner')?.role
    if (!uid || !clientRef.current || space.kind !== 'shared' || localRole !== 'owner') return
    void clientRef.current.writeSpaceMembers(uid, space).catch(() => setUnavailable(true))
  }, [uid, space])

  useEffect(() => {
    if (!ready || !uid || !clientRef.current || space.kind !== 'shared') return
    const pending = activity.filter((entry) => !remoteActivityIdsRef.current.has(entry.id) && !sentActivityIdsRef.current.has(entry.id))
    if (!pending.length) return
    const client = clientRef.current
    for (const entry of pending) {
      sentActivityIdsRef.current.add(entry.id)
      void client.writeSpaceActivity(uid, { id: space.id, kind: space.kind }, entry).catch(() => {
        sentActivityIdsRef.current.delete(entry.id)
        setUnavailable(true)
      })
    }
  }, [ready, uid, space.id, space.kind, activity])

  return { enabled: !!uid, ready, unavailable }
}
