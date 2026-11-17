import { useEffect } from 'react'
import type { AccountUser } from './account'
import { googleSyncUser } from './workspaceSync'
import type { Space, SpaceMember, SpacePresence } from '../types'

function activePresence(online: boolean): SpacePresence['presence'] {
  return online && document.visibilityState === 'visible' ? 'online' : 'away'
}

/**
 * Keeps a Shared Space's header presence compact and ephemeral. The heartbeat is only
 * enabled for a Google-issued session; local-first work never waits on it.
 */
export function useSpacePresence(account: AccountUser | null, space: Space, member: SpaceMember, online: boolean, status: string) {
  const uid = googleSyncUser(account)

  useEffect(() => {
    if (!uid || !account?.email || space.kind !== 'shared') return
    let active = true
    const publish = () => {
      if (!active) return
      void import('./firestore').then(({ writeSpacePresence }) => writeSpacePresence(uid, { id: space.id, kind: space.kind }, {
        email: account.email!.trim().toLocaleLowerCase(),
        name: member.name,
        status: status.slice(0, 120),
        presence: activePresence(online),
        activeAt: Date.now(),
      })).catch(() => {
        // Presence is decorative. Collaboration remains usable if it cannot update.
      })
    }
    publish()
    document.addEventListener('visibilitychange', publish)
    const timer = window.setInterval(publish, 45_000)
    return () => {
      active = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', publish)
    }
  }, [uid, account?.email, space.id, space.kind, member.name, online, status])
}
