import { createInitialState } from '../data'
import type { AccountUser } from './account'
import type { JourneyCard, JourneyState } from '../types'

/** Cloud sync is deliberately limited to Google-authenticated identities. */
export function googleSyncUser(user: AccountUser | null): string | null {
  return user?.providers.includes('google.com') ? user.uid : null
}

function stableValue(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`).join(',')}}`
}

export function cardFingerprint(card: JourneyCard): string {
  return stableValue(card)
}

/** Ignores in-memory ordering so Firestore snapshots do not create needless writes. */
export function workspaceFingerprint(state: JourneyState): string {
  return stableValue({ version: state.version, bezel: state.bezel, cards: [...state.cards].sort((a, b) => a.id.localeCompare(b.id)) })
}

export function isStarterWorkspace(state: JourneyState): boolean {
  return workspaceFingerprint(state) === workspaceFingerprint(createInitialState())
}

/**
 * Cloud owns matching cards. Distinct device-only cards are retained on first Google
 * sign-in, so automatic sync never silently drops a locally created plan.
 */
export function mergeInitialWorkspace(cloud: JourneyState, local: JourneyState, includeLocal: boolean, deletedCardIds: readonly string[] = []): JourneyState {
  if (!includeLocal) return cloud
  const deleted = new Set(deletedCardIds)
  const cards = new Map(cloud.cards.map((card) => [card.id, card]))
  for (const card of local.cards) if (!cards.has(card.id) && !deleted.has(card.id)) cards.set(card.id, card)
  return { ...cloud, cards: [...cards.values()].sort((a, b) => a.id.localeCompare(b.id)) }
}

export interface WorkspaceChanges {
  bezelChanged: boolean
  cards: JourneyCard[]
  deletedCardIds: string[]
}

/** Changed cards are mirrored individually; deleted cards receive a durable Firestore tombstone. */
export function workspaceChangesSince(previous: JourneyState, next: JourneyState): WorkspaceChanges {
  const previousCards = new Map(previous.cards.map((card) => [card.id, card]))
  const nextIds = new Set(next.cards.map((card) => card.id))
  return {
    bezelChanged: previous.bezel !== next.bezel,
    cards: next.cards.filter((card) => {
      const before = previousCards.get(card.id)
      return !before || cardFingerprint(before) !== cardFingerprint(card)
    }),
    deletedCardIds: [...previousCards.keys()].filter((id) => !nextIds.has(id)),
  }
}

export function emptyWorkspace(): JourneyState {
  return { version: 1, cards: [], bezel: false }
}
