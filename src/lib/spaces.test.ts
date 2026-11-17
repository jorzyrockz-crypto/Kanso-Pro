import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data'
import { activeMember, canEditSpace, cardAssignedTo, currentSpace, defaultSpacesState, parseSpacesState } from './spaces'

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
})
