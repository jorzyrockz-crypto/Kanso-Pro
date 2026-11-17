import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import type { AccountUser } from './account'
import { makeId } from './journey'
import { journeyReducer, parseSavedState } from './store'
import { activeMember, canEditSpace, canManageSpaceNotice, currentSpace, defaultSpacesState, destinationForCard, newSharedSpace, parseSpacesState, PERSONAL_SPACE_ID, SPACES_STORAGE_KEY } from './spaces'
import { defaultSpaceColor, defaultSpaceIcon } from './spaceAppearance'
import { mentionedMembers } from './collaboration'
import type { ChecklistItem, JourneyAction, JourneyState, NoteCard, ProjectCard, Space, SpaceActivity, SpaceColor, SpaceIcon, SpaceMember, SpacePresence, SpaceRole, SpacesState, TaskCard } from '../types'
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from '../data'

function userName(account: AccountUser | null) {
  return account?.displayName?.trim() || account?.email?.split('@')[0] || 'You'
}

function activity(id: string, kind: SpaceActivity['kind'], title: string, detail: string, href: string, actor?: string, target?: string): SpaceActivity {
  return { id, kind, title, detail, href, actor, ...(target ? { target } : {}), createdAt: new Date().toISOString() }
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
  const canManageNotice = canManageSpaceNotice(space)

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
            if (nextMilestone?.assignee) next = recentActivity(next, selectedSpace.id, activity(makeId('activity'), 'assignment', 'Milestone ready for handoff', `${nextMilestone.assignee}, “${nextMilestone.title}” is ready after the completed milestone.`, destinationForCard(card), selectedMember.name, nextMilestone.assignee))
          }
        }
      }
      if (action.type === 'update-item') {
        const priorItem = itemForAction(before, action)
        const card = after.cards.find((candidate) => (candidate.type === 'task' || candidate.type === 'project') && candidate.id === action.cardId)
        if (card && action.item.assignee && priorItem?.assignee !== action.item.assignee) next = recentActivity(next, selectedSpace.id, activity(makeId('activity'), 'assignment', 'Assignment updated', `${selectedMember.name} assigned “${action.item.title}” to ${action.item.assignee}.`, destinationForCard(card), selectedMember.name, action.item.assignee))
        const priorComments = priorItem?.comments?.length ?? 0
        if (card && (action.item.comments?.length ?? 0) > priorComments) {
          const latestComment = action.item.comments?.at(-1)
          const mentions = latestComment ? mentionedMembers(latestComment.body, selectedSpace.members).filter((candidate) => candidate.name !== selectedMember.name) : []
          next = recentActivity(next, selectedSpace.id, activity(makeId('activity'), 'comment', 'New inline comment', `${selectedMember.name} added a comment to “${action.item.title}”.`, destinationForCard(card), selectedMember.name))
          for (const mentioned of mentions) next = recentActivity(next, selectedSpace.id, activity(makeId('activity'), 'comment', 'You were mentioned', `${selectedMember.name} mentioned you in “${action.item.title}”.`, destinationForCard(card), selectedMember.name, mentioned.name))
        }
        const changedRemarks = card?.type === 'project' && action.item.remarks && action.item.remarks !== priorItem?.remarks
        const changedNote = card?.type === 'task' && action.item.note && action.item.note !== priorItem?.note
        if (card && (changedRemarks || changedNote)) {
          const mentionText = action.item.remarks ?? action.item.note ?? ''
          for (const mentioned of mentionedMembers(mentionText, selectedSpace.members).filter((candidate) => candidate.name !== selectedMember.name)) next = recentActivity(next, selectedSpace.id, activity(makeId('activity'), 'comment', 'You were mentioned', `${selectedMember.name} mentioned you in “${action.item.title}”.`, destinationForCard(card), selectedMember.name, mentioned.name))
        }
      }
      if (action.type === 'update-note') {
        const beforeNote = before.cards.find((candidate): candidate is NoteCard => candidate.type === 'note' && candidate.id === action.id)
        const afterNote = after.cards.find((candidate): candidate is NoteCard => candidate.type === 'note' && candidate.id === action.id)
        if (beforeNote && afterNote) {
          const beforeText = [beforeNote.title, beforeNote.body, beforeNote.context].join('\n')
          const afterText = [afterNote.title, afterNote.body, afterNote.context].join('\n')
          if (beforeText !== afterText) for (const mentioned of mentionedMembers(afterText, selectedSpace.members).filter((candidate) => candidate.name !== selectedMember.name)) next = recentActivity(next, selectedSpace.id, activity(makeId('activity'), 'note', 'You were mentioned in Space Notes', `${selectedMember.name} mentioned you in “${afterNote.title || 'an untitled note'}”.`, destinationForCard(afterNote), selectedMember.name, mentioned.name))
        }
      }
      if (action.type === 'update-card') {
        const priorCard = before.cards.find((candidate) => candidate.id === action.card.id)
        const reactionAdded = (action.card.reactions?.length ?? 0) > (priorCard?.reactions?.length ?? 0)
        const acknowledgementChanged = action.card.type === 'event' && priorCard?.type === 'event' && JSON.stringify(action.card.acknowledgements) !== JSON.stringify(priorCard.acknowledgements)
        if (reactionAdded) next = recentActivity(next, selectedSpace.id, activity(makeId('activity'), 'comment', 'Quick reaction added', `${selectedMember.name} reacted to “${action.card.title}”.`, destinationForCard(action.card), selectedMember.name))
        if (acknowledgementChanged) next = recentActivity(next, selectedSpace.id, activity(makeId('activity'), 'member', 'Event response updated', `${selectedMember.name} responded to “${action.card.title}”.`, destinationForCard(action.card), selectedMember.name))
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
      const invitedSpace = { id: normalizedId, name: 'Shared Space', kind: 'shared' as const, ownerId: '', members: [member], joinCode: normalizedCode, createdAt: new Date().toISOString(), color: defaultSpaceColor('shared'), icon: defaultSpaceIcon('shared') }
      return { ...current, activeSpaceId: invitedSpace.id, spaces: [...current.spaces, invitedSpace], workspaces: { ...current.workspaces, [invitedSpace.id]: { version: 1, cards: [], bezel: false } }, activity: { ...current.activity, [invitedSpace.id]: [] } }
    })
  }, [name, account?.email])
  const createSpace = useCallback((spaceName: string) => {
    const created = newSharedSpace(spaceName, name)
    setState((current) => ({ ...current, activeSpaceId: created.space.id, spaces: [...current.spaces, created.space], workspaces: { ...current.workspaces, [created.space.id]: created.workspace }, activity: { ...current.activity, [created.space.id]: [activity(makeId('activity'), 'member', 'Shared space created', `${name} created ${created.space.name}.`, '/', name)] } }))
    return created.space
  }, [name])
  const updateSpace = useCallback((updates: { name: string; color: SpaceColor; icon: SpaceIcon }) => setState((current) => {
    const active = currentSpace(current)
    if (activeMember(active).role !== 'owner') return current
    const nextName = updates.name.trim().slice(0, 80)
    if (!nextName) return current
    const unchanged = active.name === nextName && active.color === updates.color && active.icon === updates.icon
    if (unchanged) return current
    const spaces = current.spaces.map((candidate) => candidate.id === active.id ? { ...candidate, name: nextName, color: updates.color, icon: updates.icon } : candidate)
    const next = { ...current, spaces }
    return active.kind === 'shared'
      ? recentActivity(next, active.id, activity(makeId('activity'), 'member', 'Workspace updated', `${name} updated the workspace details.`, '/', name))
      : next
  }), [name])
  const postNotice = useCallback((body: string) => {
    const trimmed = body.trim().slice(0, 360)
    if (!trimmed) return false
    let posted = false
    setState((current) => {
      const active = currentSpace(current)
      const actor = activeMember(active)
      if (!canManageSpaceNotice(active)) return current
      posted = true
      const notice = {
        id: `notice-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
        body: trimmed,
        postedBy: actor.name,
        postedAt: new Date().toISOString(),
        acknowledgements: [],
      }
      const spaces = current.spaces.map((candidate) => candidate.id === active.id ? { ...candidate, notice } : candidate)
      const base = { ...current, spaces }
      return recentActivity(base, active.id, activity(makeId('activity'), 'note', active.notice ? 'Pinned Space Notice updated' : 'Pinned Space Notice posted', `${actor.name} pinned a notice for the team.`, '/', actor.name))
    })
    return posted
  }, [])

  const clearNotice = useCallback(() => {
    let cleared = false
    setState((current) => {
      const active = currentSpace(current)
      const actor = activeMember(active)
      if (!active.notice || !canManageSpaceNotice(active)) return current
      cleared = true
      const spaces = current.spaces.map((candidate) => candidate.id === active.id ? { ...candidate, notice: undefined } : candidate)
      const base = { ...current, spaces }
      return recentActivity(base, active.id, activity(makeId('activity'), 'note', 'Pinned Space Notice cleared', `${actor.name} cleared the pinned notice.`, '/', actor.name))
    })
    return cleared
  }, [])

  const acknowledgeNotice = useCallback(() => {
    let acknowledged = false
    setState((current) => {
      const active = currentSpace(current)
      const actor = activeMember(active)
      const notice = active.kind === 'shared' ? active.notice : undefined
      // A Google email is stable across devices; device-only collaborators retain a local id.
      const identity = account?.email?.trim().toLocaleLowerCase() || actor.id
      if (!notice || notice.acknowledgements.includes(identity)) return current
      acknowledged = true
      const updated = { ...notice, acknowledgements: [...notice.acknowledgements, identity] }
      return { ...current, spaces: current.spaces.map((candidate) => candidate.id === active.id ? { ...candidate, notice: updated } : candidate) }
    })
    return acknowledged
  }, [account?.email])

  const invite = useCallback((invitee: { name: string; email: string; role: SpaceRole }) => {
    const trimmed = invitee.name.trim().slice(0, 80)
    const email = invitee.email.trim().toLocaleLowerCase().slice(0, 254)
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
    const memberId = `member-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
    const nextMember: SpaceMember = { id: memberId, name: trimmed, email, role: invitee.role, presence: 'offline' }
    let added = false
    setState((current) => {
      const active = currentSpace(current)
      if (active.kind !== 'shared' || activeMember(active).role !== 'owner' || active.members.some((member) => member.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase() || member.email?.toLocaleLowerCase() === email)) return current
      added = true
      const spaces = current.spaces.map((space) => space.id === active.id ? { ...space, members: [...space.members, nextMember] } : space)
      const base = { ...current, spaces }
      return recentActivity(base, active.id, activity(makeId('activity'), 'invite', 'Teammate invited', `${name} invited ${trimmed} as ${invitee.role}.`, '/', name))
    })
    return added ? nextMember : null
  }, [name])
  const changeRole = useCallback((memberId: string, role: SpaceRole) => setState((current) => {
    const active = currentSpace(current)
    const member = active.members.find((candidate) => candidate.id === memberId)
    if (!member || activeMember(active).role !== 'owner' || memberId === active.ownerId || member.role === role) return current
    const spaces = current.spaces.map((space) => space.id === active.id ? { ...space, members: space.members.map((candidate) => candidate.id === memberId ? { ...candidate, role } : candidate) } : space)
    const base = { ...current, spaces }
    return recentActivity(base, active.id, activity(makeId('activity'), 'member', 'Member access updated', `${name} changed ${member.name} to ${role}.`, '/', name))
  }), [name])
  const removeMember = useCallback((memberId: string) => setState((current) => {
    const active = currentSpace(current)
    const member = active.members.find((candidate) => candidate.id === memberId)
    if (!member || active.kind !== 'shared' || activeMember(active).role !== 'owner' || memberId === active.ownerId) return current
    const spaces = current.spaces.map((space) => space.id === active.id ? { ...space, members: space.members.filter((candidate) => candidate.id !== memberId) } : space)
    const base = { ...current, spaces }
    return recentActivity(base, active.id, activity(makeId('activity'), 'member', 'Member removed', `${name} removed ${member.name} from ${active.name}.`, '/', name))
  }), [name])

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

  const hydratePresence = useCallback((spaceId: string, entries: SpacePresence[]) => setState((current) => {
    const space = current.spaces.find((candidate) => candidate.id === spaceId)
    if (!space || space.kind !== 'shared') return current
    const byEmail = new Map(entries.map((entry) => [entry.email.toLocaleLowerCase(), entry]))
    const byName = new Map(entries.map((entry) => [entry.name, entry]))
    const members = space.members.map((candidate) => {
      const presence = (candidate.email ? byEmail.get(candidate.email.toLocaleLowerCase()) : undefined) ?? byName.get(candidate.name)
      return presence ? { ...candidate, presence: presence.presence, status: presence.status } : candidate
    })
    if (JSON.stringify(members) === JSON.stringify(space.members)) return current
    return { ...current, spaces: current.spaces.map((candidate) => candidate.id === spaceId ? { ...candidate, members } : candidate) }
  }), [])

  const hydrateSpace = useCallback((spaceId: string, remote: Pick<Space, 'name' | 'color' | 'icon'> & { notice: Space['notice'] | null }) => setState((current) => {
    const local = current.spaces.find((candidate) => candidate.id === spaceId)
    if (!local || local.kind !== 'shared') return current
    const { notice, ...metadata } = remote
    const next: Space = { ...local, ...metadata, ...(notice === null ? {} : { notice }) }
    if (notice === null) delete next.notice
    if (local.name === next.name && local.color === next.color && local.icon === next.icon && JSON.stringify(local.notice) === JSON.stringify(next.notice)) return current
    return { ...current, spaces: current.spaces.map((candidate) => candidate.id === spaceId ? next : candidate) }
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
    return recentActivity(current, active.id, activity(makeId('activity'), entry.kind, entry.title, entry.detail, entry.href, entry.actor, entry.target))
  }), [])

  const activityFeed = state.activity[space.id] ?? []
  return useMemo(() => ({ state, workspace, space, member, members: space.members, activity: activityFeed, canEdit: editable, canManageNotice, storageAvailable, dispatch, selectSpace, joinByCode, joinByInvite, createSpace, updateSpace, postNotice, clearNotice, acknowledgeNotice, invite, changeRole, removeMember, hydrateMembers, hydratePresence, hydrateSpace, hydrateActivity, addActivity }), [state, workspace, space, member, activityFeed, editable, canManageNotice, storageAvailable, dispatch, selectSpace, joinByCode, joinByInvite, createSpace, updateSpace, postNotice, clearNotice, acknowledgeNotice, invite, changeRole, removeMember, hydrateMembers, hydratePresence, hydrateSpace, hydrateActivity, addActivity])
}

export type SpacesController = ReturnType<typeof useSpaces>
