import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data'
import { activeMember, canEditSpace, canManageSpaceNotice, cardAssignedTo, currentSpace, defaultSpacesState, newSharedSpace, parseSpacesState } from './spaces'

describe('collaborative Space architecture', () => {
  it('keeps a private Personal Space and a separate ready-to-share team Space', () => {
    const state = defaultSpacesState()
    const personal = currentSpace(state)
    expect(personal.name).toBe('Personal Space')
    expect(personal.kind).toBe('personal')
    const team = state.spaces.find((space) => space.kind === 'shared')
    expect(team?.name).toBe('Curriculum Planning')
    expect(team?.members.map((member) => member.role)).toContain('owner')
    expect(state.workspaces[personal.id].cards).toHaveLength(createInitialState().cards.length)
    expect(state.workspaces[team!.id].cards).toHaveLength(createInitialState().cards.length)
  })

  it('migrates a legacy local Journey into Personal Space without moving it into a team', () => {
    const legacy = createInitialState()
    const state = parseSpacesState(null, legacy)
    expect(state).not.toBeNull()
    expect(state!.workspaces.personal.cards).toEqual(legacy.cards)
    expect(state!.spaces.find((space) => space.id === 'personal')?.kind).toBe('personal')
  })

  it('persists a workspace visual identity and gives every new shared workspace a safe default', () => {
    const state = defaultSpacesState()
    const team = state.spaces.find((space) => space.kind === 'shared')!
    expect(team).toMatchObject({ color: 'violet', icon: 'people' })
    const customised = { ...state, spaces: state.spaces.map((space) => space.id === team.id ? { ...space, name: 'Curriculum Studio', color: 'forest' as const, icon: 'book' as const } : space) }
    const parsed = parseSpacesState(JSON.stringify(customised), null)
    expect(parsed?.spaces.find((space) => space.id === team.id)).toMatchObject({ name: 'Curriculum Studio', color: 'forest', icon: 'book' })
    const created = newSharedSpace('Science Team', 'Ada')
    expect(created.space).toMatchObject({ color: 'violet', icon: 'people' })
  })

  it('uses actual Space membership for assigned-work filtering and viewer permissions', () => {
    const state = defaultSpacesState()
    const team = state.spaces.find((space) => space.kind === 'shared')!
    const santos = team.members.find((member) => member.name === 'J. Santos')!
    const project = state.workspaces[team.id].cards.find((card) => card.type === 'project')!
    expect(cardAssignedTo(project, santos)).toBe(true)
    expect(canEditSpace(team)).toBe(true)
    const viewerSpace = { ...team, members: team.members.map((member) => member.id === 'local-owner' ? { ...member, role: 'viewer' as const } : member) }
    expect(activeMember(viewerSpace).role).toBe('viewer')
    expect(canEditSpace(viewerSpace)).toBe(false)
  })

  it('keeps one validated pinned notice on shared Spaces and reserves it for owners or leads', () => {
    const state = defaultSpacesState()
    const team = state.spaces.find((space) => space.kind === 'shared')!
    const withNotice = { ...state, spaces: state.spaces.map((space) => space.id === team.id ? {
      ...space,
      notice: { id: 'notice-family', body: 'Family conference plan is confirmed.', postedBy: 'You', postedAt: '2026-11-15T01:15:00.000Z', acknowledgements: ['ada@example.test'] },
    } : space) }
    const parsed = parseSpacesState(JSON.stringify(withNotice), null)
    expect(parsed?.spaces.find((space) => space.id === team.id)?.notice?.acknowledgements).toEqual(['ada@example.test'])
    expect(canManageSpaceNotice(team)).toBe(true)
    const leadSpace = { ...team, members: team.members.map((member) => member.id === 'local-owner' ? { ...member, role: 'lead' as const } : member) }
    const editorSpace = { ...team, members: team.members.map((member) => member.id === 'local-owner' ? { ...member, role: 'editor' as const } : member) }
    expect(canManageSpaceNotice(leadSpace)).toBe(true)
    expect(canManageSpaceNotice(editorSpace)).toBe(false)
    const legacyUpdate = state.workspaces[team.id].cards.find((card) => card.type === 'note')!
    const migrated = parseSpacesState(JSON.stringify({ ...state, workspaces: { ...state.workspaces, [team.id]: { ...state.workspaces[team.id], cards: [...state.workspaces[team.id].cards, { ...legacyUpdate, id: 'retired-space-update', title: 'Space update', category: 'Space Update', tags: ['space-update'] }] } } }), null)
    expect(migrated?.workspaces[team.id].cards.some((card) => card.id === 'retired-space-update')).toBe(false)
  })
})
