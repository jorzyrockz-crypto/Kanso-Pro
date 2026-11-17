import { createInitialState } from '../data'
import type { JourneyCard, JourneyState, Space, SpaceActivity, SpaceMember, SpaceNotice, SpacesState } from '../types'
import { defaultSpaceColor, defaultSpaceIcon, isSpaceColor, isSpaceIcon } from './spaceAppearance'

export const SPACES_STORAGE_KEY = 'kanso-pro:spaces:v1'
export const PERSONAL_SPACE_ID = 'personal'
export const LOCAL_MEMBER_ID = 'local-owner'

const sharedMembers: SpaceMember[] = [
  { id: LOCAL_MEMBER_ID, name: 'You', role: 'owner', presence: 'online', status: 'Reviewing the plan' },
  { id: 'member-santos', name: 'J. Santos', role: 'editor', presence: 'online', status: 'Reviewing Q1 milestones' },
  { id: 'member-chair', name: 'Grade Level Chair', role: 'editor', presence: 'away', status: 'Away from the Space' },
  { id: 'member-office', name: 'Oquendo ES Office', role: 'viewer', presence: 'offline', status: 'Last active earlier' },
]

function joinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function defaultSpacesState(): SpacesState {
  const personal: Space = {
    id: PERSONAL_SPACE_ID,
    name: 'Personal Space',
    kind: 'personal',
    ownerId: LOCAL_MEMBER_ID,
    members: [{ id: LOCAL_MEMBER_ID, name: 'You', role: 'owner', presence: 'online' }],
    joinCode: '',
    createdAt: new Date().toISOString(),
    color: defaultSpaceColor('personal'),
    icon: defaultSpaceIcon('personal'),
  }
  // A ready-to-use shared space shows the collaboration model without moving any personal data.
  const shared: Space = {
    id: 'space-curriculum-planning',
    name: 'Curriculum Planning',
    kind: 'shared',
    ownerId: LOCAL_MEMBER_ID,
    members: structuredClone(sharedMembers),
    joinCode: 'PLAN26',
    createdAt: new Date().toISOString(),
    color: defaultSpaceColor('shared'),
    icon: defaultSpaceIcon('shared'),
  }
  return {
    version: 1,
    activeSpaceId: PERSONAL_SPACE_ID,
    spaces: [personal, shared],
    workspaces: { [PERSONAL_SPACE_ID]: createInitialState(), [shared.id]: createInitialState() },
    activity: { [PERSONAL_SPACE_ID]: [], [shared.id]: [] },
  }
}

function isMember(value: unknown): value is SpaceMember {
  if (!value || typeof value !== 'object') return false
  const member = value as Record<string, unknown>
  return typeof member.id === 'string' && typeof member.name === 'string'
    && ['owner', 'lead', 'editor', 'viewer'].includes(String(member.role))
    && ['online', 'away', 'offline'].includes(String(member.presence))
    && (member.email === undefined || typeof member.email === 'string')
    && (member.status === undefined || (typeof member.status === 'string' && member.status.length <= 120))
}

function isSpaceNotice(value: unknown): value is SpaceNotice {
  if (!value || typeof value !== 'object') return false
  const notice = value as Record<string, unknown>
  return typeof notice.id === 'string' && notice.id.length > 0 && notice.id.length <= 180
    && typeof notice.body === 'string' && notice.body.trim().length > 0 && notice.body.length <= 360
    && typeof notice.postedBy === 'string' && notice.postedBy.length > 0 && notice.postedBy.length <= 120
    && typeof notice.postedAt === 'string' && !Number.isNaN(Date.parse(notice.postedAt))
    && Array.isArray(notice.acknowledgements) && notice.acknowledgements.every((entry) => typeof entry === 'string' && entry.length > 0 && entry.length <= 254)
}

function isSpace(value: unknown): value is Space {
  if (!value || typeof value !== 'object') return false
  const space = value as Record<string, unknown>
  return typeof space.id === 'string' && typeof space.name === 'string' && typeof space.ownerId === 'string'
    && typeof space.joinCode === 'string' && typeof space.createdAt === 'string'
    && (space.color === undefined || isSpaceColor(space.color)) && (space.icon === undefined || isSpaceIcon(space.icon))
    && ['personal', 'shared'].includes(String(space.kind)) && Array.isArray(space.members) && space.members.length > 0 && space.members.every(isMember)
    && (space.notice === undefined || (space.kind === 'shared' && isSpaceNotice(space.notice)))
}

function isJourneyState(value: unknown): value is JourneyState {
  if (!value || typeof value !== 'object') return false
  const state = value as Record<string, unknown>
  return state.version === 1 && typeof state.bezel === 'boolean' && Array.isArray(state.cards)
}

function isActivity(value: unknown): value is SpaceActivity {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return typeof entry.id === 'string' && typeof entry.title === 'string' && typeof entry.detail === 'string'
    && typeof entry.href === 'string' && typeof entry.createdAt === 'string'
    && (entry.target === undefined || (typeof entry.target === 'string' && entry.target.length <= 120))
    && ['invite', 'assignment', 'completion', 'comment', 'note', 'member'].includes(String(entry.kind))
}

/** Migrates the original single-workspace state into a Personal Space without losing cards. */
export function parseSpacesState(raw: string | null, legacyState: JourneyState | null): SpacesState | null {
  if (raw) {
    try {
      const value: unknown = JSON.parse(raw)
      if (!value || typeof value !== 'object') return null
      const data = value as Record<string, unknown>
      if (data.version !== 1 || typeof data.activeSpaceId !== 'string' || !Array.isArray(data.spaces) || !data.spaces.every(isSpace)
        || !data.workspaces || typeof data.workspaces !== 'object' || !data.activity || typeof data.activity !== 'object') return null
      const workspaces = data.workspaces as Record<string, unknown>
      const activity = data.activity as Record<string, unknown>
      if (!data.spaces.every((space) => isJourneyState(workspaces[space.id]) && Array.isArray(activity[space.id]) && (activity[space.id] as unknown[]).every(isActivity))) return null
      if (!data.spaces.some((space) => space.id === data.activeSpaceId)) return null
      // Versions before pinned notices stored broadcast updates as ordinary dated Notes.
      // Discard only that retired system-card shape while keeping every real journal note.
      const parsed = data as unknown as SpacesState
      return {
        ...parsed,
        workspaces: Object.fromEntries(Object.entries(parsed.workspaces).map(([id, workspace]) => [id, {
          ...workspace,
          cards: workspace.cards.filter((card) => !(card.type === 'note' && card.title === 'Space update' && card.category === 'Space Update' && card.tags.includes('space-update'))),
        }])),
      }
    } catch { return null }
  }
  if (!legacyState) return null
  const next = defaultSpacesState()
  next.workspaces[PERSONAL_SPACE_ID] = legacyState
  return next
}

export function currentSpace(state: SpacesState): Space {
  return state.spaces.find((space) => space.id === state.activeSpaceId) ?? state.spaces[0]
}

export function activeMember(space: Space): SpaceMember {
  return space.members.find((member) => member.id === LOCAL_MEMBER_ID) ?? space.members[0]
}

export function canEditSpace(space: Space): boolean {
  return activeMember(space).role !== 'viewer'
}

/** Owners may delegate the single pinned notice without giving every editor broadcast access. */
export function canManageSpaceNotice(space: Space): boolean {
  return space.kind === 'shared' && ['owner', 'lead'].includes(activeMember(space).role)
}

export function cardAssignedTo(card: JourneyCard, member: SpaceMember): boolean {
  if (card.type === 'event') return card.owner === member.name || card.authoredBy === member.name
  if (card.type === 'task') return card.authoredBy === member.name || card.subtasks.some((item) => item.assignee === member.name || item.completedBy === member.name)
  if (card.type === 'project') return card.authoredBy === member.name || card.team.includes(member.name) || card.subtasks.some((item) => item.assignee === member.name || item.completedBy === member.name)
  return card.authoredBy === member.name
}

export function destinationForCard(card: JourneyCard): string {
  if (card.type === 'event') return `/calendar/${encodeURIComponent(card.id)}`
  if (card.type === 'task') return `/tasks/${encodeURIComponent(card.id)}`
  if (card.type === 'project') return `/project/${encodeURIComponent(card.id)}`
  return `/journal/${encodeURIComponent(card.id)}`
}

export function newSharedSpace(name: string, ownerName: string): { space: Space; workspace: JourneyState } {
  const id = `space-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
  return {
    space: { id, name: name.trim().slice(0, 80) || 'Untitled Space', kind: 'shared', ownerId: LOCAL_MEMBER_ID, members: [{ id: LOCAL_MEMBER_ID, name: ownerName, role: 'owner', presence: 'online' }], joinCode: joinCode(), createdAt: new Date().toISOString(), color: defaultSpaceColor('shared'), icon: defaultSpaceIcon('shared') },
    workspace: { version: 1, cards: [], bezel: false },
  }
}
