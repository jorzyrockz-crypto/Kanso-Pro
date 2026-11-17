import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import type { AccountUser } from './account'
import { makeId } from './journey'
import { journeyReducer, parseSavedState } from './store'
import { activeMember, canEditSpace, currentSpace, defaultSpacesState, destinationForCard, newSharedSpace, parseSpacesState, PERSONAL_SPACE_ID, SPACES_STORAGE_KEY } from './spaces'
import type { ChecklistItem, JourneyAction, JourneyState, ProjectCard, SpaceActivity, SpaceMember, SpaceRole, SpacesState, TaskCard } from '../types'
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from '../data'

function userName(account: AccountUser | null) {
  return account?.displayName?.trim() || account?.email?.split('@')[0] || 'You'
}

function activity(id: string, kind: SpaceActivity['kind'], title: string, detail: string, href: string, actor?: string): SpaceActivity {
  return { id, kind, title, detail, href, actor, createdAt: new Date().toISOString() }
}

function recentActivity(current: SpacesState, spaceId: string, next: SpaceActivity): SpacesState {
  const entries = [next, ...(current.activity[spaceId] ?? [])].slice(0, 80)
  return { ...current, activity: { ...current.activity, [spaceId]: entries } }
}

function itemForAction(state: JourneyState, action: Extract<JourneyAction, { type: 'toggle-item' | 'update-item' }>): ChecklistItem | undefined {
  const card = state.cards.find((candidate): candidate is TaskCard | ProjectCard => (candidate.type === 'task' || candidate.type === 'project') && candidate.id === action.cardId)
  if (!card) return undefined
  return action.type === 'update-item' ? card.subtasks.find((item) => item.id === action.item.id) : card.subtasks.find((item) => item.id === action.itemId)
}

/**
 * A small local-first multi-space envelope around the existing Journey reducer. Every
 * space carries its own state, so switching spaces is instant even when sync is offline.
 */
export function useSpaces(account: AccountUser | null) {
  const [state, setState] = useState<SpacesState>(() => {
    try {
      const legacy = parseSavedState(localStorage.getItem(STORAGE_KEY))
        ?? parseSavedState(localStorage.getItem(LEGACY_STORAGE_KEY))
      return parseSpacesState(localStorage.getItem(SPACES_STORAGE_KEY), legacy) ?? defaultSpacesState()
    } catch { return defaultSpacesState() }
  })
  const stateRef = useRef(state)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const name = userName(account)
  stateRef.current = state

  useEffect(() => {
    try {
      localStorage.setItem(SPACES_STORAGE_KEY, JSON.stringify(state))
      // Keep the legacy mirror current so an older app installation never loses Personal Space.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.workspaces[PERSONAL_SPACE_ID] ?? state.workspaces[state.activeSpaceId]))
      setStorageAvailable(true)
    } catch { setStorageAvailable(false) }
  }, [state])

  useEffect(() => {
    const stored = (event: StorageEvent) => {
      if (event.key !== SPACES_STORAGE_KEY || !event.newValue) return
      const next = parseSpacesState(event.newValue, null)
      if (next) setState(next)
    }
    window.addEventListener('storage', stored)
    return () => window.removeEventListener('storage', stored)
  }, [])

  // Account names enrich the local owner identity but never replace a teammate's identity.
  useEffect(() => {
    const email = account?.email?.trim() || undefined
    setState((current) => {
      let changed = false
      const spaces = current.spaces.map((space) => {
        const members = space.members.map((member) => {
          if (member.id !== 'local-owner') return member
          if (member.name === name && member.email === email && member.presence === 'online') return member
          changed = true
          return { ...member, name, ...(email ? { email } : {}), ...(email ? {} : { email: undefined }), presence: 'online' as const }
        })
        return changed ? { ...space, members } : space
      })
      return changed ? { ...current, spaces } : current
    })
  }, [name, account?.email])

  const space = currentSpace(state)
  const member = activeMember(space)
  const workspace = state.workspaces[space.id] ?? { version: 1, cards: [], bezel: false }
  const editable = canEditSpace(space)

  const dispatch = useCallback<Dispatch<JourneyAction>>((rawAction) => {
    setState((current) => {
      const selectedSpace = currentSpace(current)
      const selectedMember = activeMember(selectedSpace)
      if (selectedMember.role === 'viewer' && rawAction.type !== 'hydrate') return current
      const before = current.workspaces[selectedSpace.id] ?? { version: 1, cards: [], bezel: false }
      const action: JourneyAction = rawAction.type === 'add-card'
        ? { ...rawAction, card: { ...rawAction.card, authoredBy: rawAction.card.authoredBy ?? selectedMember.name, lastEditedBy: selectedMember.name } }
        : rawAction.type === 'update-card'
          ? { ...rawAction, card: { ...rawAction.card, lastEditedBy: selectedMember.name } }
          : rawAction.type === 'update-note'
            ? { ...rawAction, lastEditedBy: selectedMember.name }
          : rawAction.type === 'toggle-item'
            ? { ...rawAction, actor: rawAction.actor ?? selectedMember.name }
            : rawAction.type === 'add-item'
              ? { ...rawAction, item: { ...rawAction.item, assignee: rawAction.item.assignee ?? selectedMember.name } }
              : rawAction
      const after = journeyReducer(before, action)
      if (after === before) return current
      let next: SpacesState = { ...current, workspaces: { ...current.workspaces, [selectedSpace.id]: after } }
      if (selectedSpace.kind !== 'shared') return next
      if (action.type === 'add-card') {
        next = recentActivity(next, selectedSpace.id, activity(makeId('activity'), action.card.type === 'note' ? 'note' : 'assignment', action.card.type === 'note' ? 'New team note' : 'New shared plan', `${selectedMember.name} added “${action.card.title || 'Untitled'}”.`, destinationForCard(action.card), selectedMember.name))
      }
      if (action.type === 'toggle-item') {
        const priorItem = itemForAction(before, action)
        const card = after.cards.find((candidate): candidate is TaskCard | ProjectCard => (candidate.type === 'task' || candidate.type === 'project') && candidate.id === action.cardId)
        const updatedItem = card?.subtasks.find((item) => item.id === action.itemId)
        if (priorItem && updatedItem?.done && !priorItem.done && card) {
          next = recentActivity(next, selectedSpace.id, activity(makeId('activity'), 'completion', 'Deliverable completed', `${selectedMember.name} completed “${updatedItem.title}”.`, destinationForCard(card), selectedMember.name))
          if (card.type === 'project') {
            const nextMilestone = card.subtasks.find((item) => !item.done)
            if (nextMilestone?.assignee) next = recentActivity(next, selectedSpace.id, activity(makeId('activity'), 'assignment', 'Milestone ready for handoff', `${nextMilestone.assignee}, “${nextMilestone.title}” is ready after the completed milestone.`, destinationForCard(card), selectedMember.name))
          }
        }
      }
      if (action.type === 'update-item') {
        const priorItem = itemForAction(before, action)
        const card = after.cards.find((candidate) => (candidate.type === 'task' || candidate.type === 'project') && candidate.id === action.cardId)
        if (card && action.item.assignee && priorItem?.assignee !== action.item.assignee) next = recentActivity(next, selectedSpace.id, activity(makeId('activity'), 'assignment', 'Assignment updated', `${selectedMember.name} assigned “${action.item.title}” to ${action.item.assignee}.`, destinationForCard(card), selectedMember.name))
        const priorComments = priorItem?.comments?.length ?? 0
        if (card && (action.item.comments?.length ?? 0) > priorComments) next = recentActivity(next, selectedSpace.id, activity(makeId('activity'), 'comment', 'New inline comment', `${selectedMember.name} added a comment to “${action.item.title}”.`, destinationForCard(card), selectedMember.name))
      }
      return next
    })
  }, [])

  const selectSpace = useCallback((id: string) => setState((current) => current.spaces.some((candidate) => candidate.id === id) ? { ...current, activeSpaceId: id } : current), [])
  const joinByCode = useCallback((code: string) => {
    const normalized = code.trim().toUpperCase()
    if (!normalized) return
    setState((current) => {
      const target = current.spaces.find((candidate) => candidate.kind === 'shared' && candidate.joinCode.toUpperCase() === normalized)
      return target ? { ...current, activeSpaceId: target.id } : current
    })
  }, [])
  const joinByInvite = useCallback((spaceId: string, code: string) => {
    const normalizedId = spaceId.trim()
    const normalizedCode = code.trim().toUpperCase()
    if (!normalizedId || !normalizedCode || normalizedId.length > 180) return
    setState((current) => {
      const known = current.spaces.find((candidate) => candidate.id === normalizedId)
      if (known) return { ...current, activeSpaceId: known.id }
      const member: SpaceMember = { id: 'local-owner', name, ...(account?.email?.trim() ? { email: account.email.trim() } : {}), role: 'viewer', presence: 'online' }
      const invitedSpace = { id: normalizedId, name: 'Shared Space', kind: 'shared' as const, ownerId: '', members: [member], joinCode: normalizedCode, createdAt: new Date().toISOString() }
      return { ...current, activeSpaceId: invitedSpace.id, spaces: [...current.spaces, invitedSpace], workspaces: { ...current.workspaces, [invitedSpace.id]: { version: 1, cards: [], bezel: false } }, activity: { ...current.activity, [invitedSpace.id]: [] } }
    })
  }, [name, account?.email])
  const createSpace = useCallback((spaceName: string) => {
    const created = newSharedSpace(spaceName, name)
    setState((current) => ({ ...current, activeSpaceId: created.space.id, spaces: [...current.spaces, created.space], workspaces: { ...current.workspaces, [created.space.id]: created.workspace }, activity: { ...current.activity, [created.space.id]: [activity(makeId('activity'), 'member', 'Shared space created', `${name} created ${created.space.name}.`, '/', name)] } }))
    return created.space
  }, [name])
  const invite = useCallback((invitee: { name: string; email?: string; role: SpaceRole }) => {
    const trimmed = invitee.name.trim().slice(0, 80)
    if (!trimmed) return null
    const memberId = `member-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
    const nextMember: SpaceMember = { id: memberId, name: trimmed, ...(invitee.email?.trim() ? { email: invitee.email.trim().slice(0, 254) } : {}), role: invitee.role, presence: 'offline' }
    setState((current) => {
      const active = currentSpace(current)
      if (active.kind !== 'shared' || activeMember(active).role === 'viewer' || active.members.some((member) => member.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) return current
      const spaces = current.spaces.map((space) => space.id === active.id ? { ...space, members: [...space.members, nextMember] } : space)
      const base = { ...current, spaces }
      return recentActivity(base, active.id, activity(makeId('activity'), 'invite', 'Teammate invited', `${name} invited ${trimmed} as ${invitee.role}.`, '/', name))
    })
    return nextMember
  }, [name])
  const changeRole = useCallback((memberId: string, role: SpaceRole) => setState((current) => {
    const active = currentSpace(current)
    if (activeMember(active).role !== 'owner' || memberId === active.ownerId) return current
    return { ...current, spaces: current.spaces.map((space) => space.id === active.id ? { ...space, members: space.members.map((candidate) => candidate.id === memberId ? { ...candidate, role } : candidate) } : space) }
  }), [])

  const hydrateMembers = useCallback((spaceId: string, remoteMembers: SpaceMember[]) => setState((current) => {
    const local = current.spaces.find((candidate) => candidate.id === spaceId)
    if (!local || !remoteMembers.length) return current
    const localOwner = local.members.find((candidate) => candidate.id === 'local-owner')
    const remoteHasOwner = remoteMembers.some((candidate) => candidate.id === 'local-owner')
    const roleForLocalIdentity = localOwner?.email ? remoteMembers.find((candidate) => candidate.email?.toLocaleLowerCase() === localOwner.email?.toLocaleLowerCase()) : undefined
    const localIdentity = localOwner ? { ...localOwner, ...(roleForLocalIdentity ? { name: roleForLocalIdentity.name, role: roleForLocalIdentity.role } : {}), presence: 'online' as const } : undefined
    const members = (remoteHasOwner || !localIdentity ? remoteMembers : [localIdentity, ...remoteMembers.filter((candidate) => !roleForLocalIdentity || candidate.id !== roleForLocalIdentity.id)]).map((candidate) => candidate.id === 'local-owner' ? { ...candidate, presence: 'online' as const } : candidate)
    if (JSON.stringify(local.members) === JSON.stringify(members)) return current
    return { ...current, spaces: current.spaces.map((candidate) => candidate.id === spaceId ? { ...candidate, members } : candidate) }
  }), [])

  const hydrateActivity = useCallback((spaceId: string, remoteEntries: SpaceActivity[]) => setState((current) => {
    const localEntries = current.activity[spaceId] ?? []
    const byId = new Map([...localEntries, ...remoteEntries].map((entry) => [entry.id, entry]))
    const entries = [...byId.values()].sort((first, second) => second.createdAt.localeCompare(first.createdAt)).slice(0, 80)
    if (JSON.stringify(localEntries) === JSON.stringify(entries)) return current
    return { ...current, activity: { ...current.activity, [spaceId]: entries } }
  }), [])

  const addActivity = useCallback((entry: Omit<SpaceActivity, 'id' | 'createdAt'>) => setState((current) => {
    const active = currentSpace(current)
    if (active.kind !== 'shared') return current
    return recentActivity(current, active.id, activity(makeId('activity'), entry.kind, entry.title, entry.detail, entry.href, entry.actor))
  }), [])

  const activityFeed = state.activity[space.id] ?? []
  return useMemo(() => ({ state, workspace, space, member, members: space.members, activity: activityFeed, canEdit: editable, storageAvailable, dispatch, selectSpace, joinByCode, joinByInvite, createSpace, invite, changeRole, hydrateMembers, hydrateActivity, addActivity }), [state, workspace, space, member, activityFeed, editable, storageAvailable, dispatch, selectSpace, joinByCode, joinByInvite, createSpace, invite, changeRole, hydrateMembers, hydrateActivity, addActivity])
}

export type SpacesController = ReturnType<typeof useSpaces>
