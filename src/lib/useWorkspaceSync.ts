import { useEffect, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import type { AccountUser } from './account'
import { emptyWorkspace, googleSyncUser, isStarterWorkspace, mergeInitialWorkspace, workspaceChangesSince, workspaceFingerprint } from './workspaceSync'
import type { JourneyAction, JourneyState } from '../types'

type FirestoreClient = typeof import('./firestore')

/**
 * Google sign-in silently enables a local-first personal workspace mirror. The hook has
 * no UI state by design: local planning remains usable when Firestore is unavailable.
 */
export function useWorkspaceSync(account: AccountUser | null, state: JourneyState, dispatch: Dispatch<JourneyAction>) {
  const uid = googleSyncUser(account)
  const [ready, setReady] = useState(false)
  const stateRef = useRef(state)
  const clientRef = useRef<FirestoreClient | null>(null)
  const remoteRef = useRef<JourneyState | null>(null)
  const initializedRef = useRef(false)
  const applyingRemoteRef = useRef('')
  const awaitingRemoteHydrationRef = useRef(false)
  const pendingFingerprintRef = useRef('')
  const priorGoogleUserRef = useRef<string | null>(null)
  const [retry, setRetry] = useState(0)

  stateRef.current = state

  useEffect(() => {
    const retryPending = () => setRetry((value) => value + 1)
    window.addEventListener('online', retryPending)
    return () => window.removeEventListener('online', retryPending)
  }, [])

  useEffect(() => {
    setReady(false)
    clientRef.current = null
    remoteRef.current = null
    initializedRef.current = false
    applyingRemoteRef.current = ''
    awaitingRemoteHydrationRef.current = false
    pendingFingerprintRef.current = ''
    if (!uid) return
    const switchedGoogleUser = priorGoogleUserRef.current !== null && priorGoogleUserRef.current !== uid
    priorGoogleUserRef.current = uid

    let active = true
    let unsubscribe: (() => void) | undefined
    void import('./firestore').then((client) => {
      if (!active) return
      clientRef.current = client
      unsubscribe = client.subscribeWorkspace(uid, (remote) => {
        if (!active || remote.fromCache) return
        const local = stateRef.current
        const localIsStarter = isStarterWorkspace(local)
        if (!initializedRef.current) {
          initializedRef.current = true
          let next: JourneyState
          if (!remote.exists) {
            next = localIsStarter || switchedGoogleUser ? emptyWorkspace() : local
            remoteRef.current = next
            pendingFingerprintRef.current = workspaceFingerprint(next)
            void client.createWorkspace(uid, next).catch(() => {})
          } else {
            next = mergeInitialWorkspace(remote.state, local, !switchedGoogleUser && !localIsStarter, remote.deletedCardIds)
            remoteRef.current = next
            const additions = workspaceChangesSince(remote.state, next)
            if (additions.cards.length || additions.deletedCardIds.length || additions.bezelChanged) {
              pendingFingerprintRef.current = workspaceFingerprint(next)
              void client.writeWorkspace(uid, next, additions.cards, additions.deletedCardIds).catch(() => {})
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
      }, () => {})
    }).catch(() => {})

    return () => { active = false; unsubscribe?.() }
  }, [uid, dispatch])

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
      void client.writeWorkspace(uid, state, changes.cards, changes.deletedCardIds).catch(() => {})
    }, 350)
    return () => window.clearTimeout(timer)
  }, [state, ready, uid, retry])
}
