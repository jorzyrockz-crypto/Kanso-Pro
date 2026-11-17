import { collection, deleteDoc, doc, getDoc, getFirestore, increment, initializeFirestore, limit, onSnapshot, orderBy, persistentLocalCache, persistentMultipleTabManager, query, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import type { Firestore, QueryDocumentSnapshot, Unsubscribe } from 'firebase/firestore'
import { firebaseApp } from './firebase'
import { parseSavedState } from './store'
import type { JournalAttachment, JourneyCard, JourneyState, Space, SpaceActivity, SpaceMember, SpacePresence } from '../types'
import { isSpaceColor, isSpaceIcon } from './spaceAppearance'

const WORKSPACE_ID = 'default'
export type FirestoreSpace = Pick<Space, 'id' | 'kind'>
const CARD_BATCH_SIZE = 450

let database: Firestore
try {
  // Firestore's browser cache complements Kanso's existing localStorage cache and lets
  // the active Google workspace resume safely after temporary connectivity loss.
  database = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
} catch {
  // Another bundle/module may already have initialized Firestore, or IndexedDB can be
  // blocked. Either way, the app still has its local workspace cache.
  database = getFirestore(firebaseApp)
}

export interface RemoteWorkspaceSnapshot {
  exists: boolean
  state: JourneyState
  /** IDs whose tombstones must win over an older local copy during first-device merging. */
  deletedCardIds: string[]
  fromCache: boolean
  pendingWrites: boolean
  /** Shared-space metadata; authorization remains a Firestore rules concern. */
  members?: SpaceMember[]
  space?: Pick<Space, 'name' | 'color' | 'icon'>
  activity?: SpaceActivity[]
  presence?: SpacePresence[]
}

function workspaceRef(uid: string, space?: FirestoreSpace) {
  // Personal workspaces retain the original user-owned path for backward compatibility.
  // Shared spaces use a stable space id, allowing every invited Google identity to observe
  // the same parent document and card subcollection when Firestore rules permit membership.
  if (space?.kind === 'shared') return doc(database, 'spaces', space.id)
  return doc(database, 'users', uid, 'workspaces', space?.id && space.id !== 'personal' ? space.id : WORKSPACE_ID)
}

function journalImageRef(uid: string, id: string, space?: FirestoreSpace) {
  return doc(workspaceRef(uid, space), 'journalImages', id)
}

const FIRESTORE_IMAGE_DATA_LIMIT = 850_000

/** Images are optimised in the browser before reaching Firestore, never embedded in a card document. */
export async function writeJournalImage(uid: string, attachment: JournalAttachment, dataUrl: string, space?: FirestoreSpace) {
  if (attachment.kind !== 'image' || attachment.storage !== 'firestore' || !dataUrl.startsWith('data:image/') || dataUrl.length > FIRESTORE_IMAGE_DATA_LIMIT) throw new Error('This image is too large for private Firestore storage.')
  await setDoc(journalImageRef(uid, attachment.id, space), {
    dataUrl,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    width: attachment.width ?? null,
    height: attachment.height ?? null,
    updatedAt: serverTimestamp(),
  })
}

export async function readJournalImage(uid: string, id: string, space?: FirestoreSpace) {
  const snapshot = await getDoc(journalImageRef(uid, id, space))
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  return typeof data.dataUrl === 'string' && data.dataUrl.startsWith('data:image/') ? data.dataUrl : null
}

export async function deleteJournalImage(uid: string, id: string, space?: FirestoreSpace) {
  await deleteDoc(journalImageRef(uid, id, space))
}

function cleanCard(value: Record<string, unknown>): JourneyCard | null {
  const { revision: _revision, updatedAt: _updatedAt, updatedBy: _updatedBy, deletedAt, ...card } = value
  if (deletedAt) return null
  const parsed = parseSavedState(JSON.stringify({ version: 1, bezel: false, cards: [card] }))
  return parsed?.cards[0] ?? null
}

function remoteMembers(value: unknown): SpaceMember[] | undefined {
  if (!Array.isArray(value)) return undefined
  const members = value.flatMap((candidate): SpaceMember[] => {
    if (!candidate || typeof candidate !== 'object') return []
    const item = candidate as Record<string, unknown>
    if (typeof item.id !== 'string' || typeof item.name !== 'string' || !['owner', 'editor', 'viewer'].includes(String(item.role))) return []
    return [{ id: item.id, name: item.name, ...(typeof item.email === 'string' ? { email: item.email } : {}), role: item.role as SpaceMember['role'], presence: 'offline', ...(typeof item.status === 'string' ? { status: item.status.slice(0, 120) } : {}) }]
  })
  return members.length ? members : undefined
}

function remoteSpace(value: Record<string, unknown>): Pick<Space, 'name' | 'color' | 'icon'> | undefined {
  if (typeof value.name !== 'string' || !value.name.trim()) return undefined
  return {
    name: value.name.slice(0, 80),
    ...(isSpaceColor(value.color) ? { color: value.color } : {}),
    ...(isSpaceIcon(value.icon) ? { icon: value.icon } : {}),
  }
}

function remoteActivity(entries: QueryDocumentSnapshot[]): SpaceActivity[] {
  return entries.flatMap((entry): SpaceActivity[] => {
    const data = entry.data()
    if (typeof data.kind !== 'string' || typeof data.title !== 'string' || typeof data.detail !== 'string' || typeof data.href !== 'string' || typeof data.createdAt !== 'string') return []
    if (!['invite', 'assignment', 'completion', 'comment', 'note', 'member'].includes(data.kind)) return []
    return [{ id: entry.id, kind: data.kind as SpaceActivity['kind'], title: data.title, detail: data.detail, href: data.href, createdAt: data.createdAt, ...(typeof data.actor === 'string' ? { actor: data.actor } : {}), ...(typeof data.target === 'string' ? { target: data.target } : {}) }]
  })
}

function remotePresence(entries: QueryDocumentSnapshot[]): SpacePresence[] {
  const staleAfter = Date.now() - 10 * 60_000
  return entries.flatMap((entry): SpacePresence[] => {
    const data = entry.data()
    if (typeof data.email !== 'string' || typeof data.name !== 'string' || typeof data.status !== 'string' || typeof data.activeAt !== 'number'
      || !['online', 'away'].includes(String(data.presence)) || data.activeAt < staleAfter) return []
    return [{ uid: entry.id, email: data.email, name: data.name, status: data.status.slice(0, 120), presence: data.presence as SpacePresence['presence'], activeAt: data.activeAt }]
  })
}

function serializeCard(card: JourneyCard) {
  // Optional UI fields are intentionally omitted rather than sent as undefined, which
  // Firestore rejects. Cards contain only JSON-compatible workspace data.
  return JSON.parse(JSON.stringify(card)) as JourneyCard
}

export function subscribeWorkspace(uid: string, space: FirestoreSpace | undefined, onValue: (snapshot: RemoteWorkspaceSnapshot) => void, onError: (error: unknown) => void): Unsubscribe {
  const workspace = workspaceRef(uid, space)
  const cards = collection(workspace, 'cards')
  let workspaceData: Record<string, unknown> | null = null
  let workspaceExists = false
  let workspaceFromCache = true
  let workspacePendingWrites = false
  let cardData: QueryDocumentSnapshot[] | null = null
  let cardsFromCache = true
  let cardsPendingWrites = false
  let activityData: QueryDocumentSnapshot[] = []
  let presenceData: QueryDocumentSnapshot[] = []

  const publish = () => {
    if (!workspaceData || !cardData) return
    const deletedCardIds = cardData.filter((entry) => !!entry.data().deletedAt).map((entry) => entry.id)
    const parsedCards = cardData.map((entry) => cleanCard(entry.data())).filter((card): card is JourneyCard => !!card)
    onValue({
      exists: workspaceExists || cardData.length > 0,
      state: { version: 1, bezel: workspaceData.bezel === true, cards: parsedCards.sort((a, b) => a.id.localeCompare(b.id)) },
      deletedCardIds,
      fromCache: workspaceFromCache || cardsFromCache,
      pendingWrites: workspacePendingWrites || cardsPendingWrites,
      members: remoteMembers(workspaceData.members),
      space: remoteSpace(workspaceData),
      activity: remoteActivity(activityData),
      presence: remotePresence(presenceData),
    })
  }

  const unsubscribeWorkspace = onSnapshot(workspace, { includeMetadataChanges: true }, (snapshot) => {
    workspaceExists = snapshot.exists()
    workspaceData = snapshot.exists() ? snapshot.data() : {}
    workspaceFromCache = snapshot.metadata.fromCache
    workspacePendingWrites = snapshot.metadata.hasPendingWrites
    publish()
  }, onError)
  const unsubscribeCards = onSnapshot(cards, { includeMetadataChanges: true }, (snapshot) => {
    cardData = [...snapshot.docs]
    cardsFromCache = snapshot.metadata.fromCache
    cardsPendingWrites = snapshot.metadata.hasPendingWrites
    publish()
  }, onError)
  const activityLog = query(collection(workspace, 'activity'), orderBy('createdAt', 'desc'), limit(80))
  const unsubscribeActivity = onSnapshot(activityLog, { includeMetadataChanges: true }, (snapshot) => {
    activityData = [...snapshot.docs]
    publish()
  }, onError)
  const unsubscribePresence = space?.kind === 'shared'
    ? onSnapshot(collection(workspace, 'presence'), { includeMetadataChanges: true }, (snapshot) => {
      presenceData = [...snapshot.docs]
      publish()
    }, onError)
    : () => {}
  return () => { unsubscribeWorkspace(); unsubscribeCards(); unsubscribeActivity(); unsubscribePresence() }
}

async function writeCardBatch(uid: string, cards: JourneyCard[], space?: FirestoreSpace) {
  const batch = writeBatch(database)
  for (const card of cards) {
    batch.set(doc(workspaceRef(uid, space), 'cards', card.id), {
      ...serializeCard(card),
      revision: increment(1),
      updatedAt: serverTimestamp(),
      updatedBy: 'browser',
      deletedAt: null,
    })
  }
  await batch.commit()
}

async function deleteCardBatch(uid: string, cardIds: string[], space?: FirestoreSpace) {
  const batch = writeBatch(database)
  for (const id of cardIds) {
    batch.set(doc(workspaceRef(uid, space), 'cards', id), {
      revision: increment(1),
      updatedAt: serverTimestamp(),
      updatedBy: 'browser',
      deletedAt: serverTimestamp(),
    }, { merge: true })
  }
  await batch.commit()
}

export async function writeWorkspace(uid: string, state: JourneyState, cards: JourneyCard[], deletedCardIds: string[] = [], space?: FirestoreSpace) {
  const workspace = workspaceRef(uid, space)
  // Keep a real parent document even when the first personal change is a card. Firestore
  // permits orphaned subcollections, but a root document makes first-device hydration safe.
  await setDoc(workspace, {
    schemaVersion: 1,
    initialized: true,
    bezel: state.bezel,
    updatedAt: serverTimestamp(),
  }, { merge: true })
  for (let start = 0; start < cards.length; start += CARD_BATCH_SIZE) await writeCardBatch(uid, cards.slice(start, start + CARD_BATCH_SIZE), space)
  for (let start = 0; start < deletedCardIds.length; start += CARD_BATCH_SIZE) await deleteCardBatch(uid, deletedCardIds.slice(start, start + CARD_BATCH_SIZE), space)
}

export async function createWorkspace(uid: string, state: JourneyState, space?: FirestoreSpace) {
  await writeWorkspace(uid, state, state.cards, [], space)
}

/** Persist non-sensitive membership metadata beside a shared Space's cards. Firestore rules
 * must still enforce who may read or write the document; the browser never treats this list
 * as authorization. */
export async function writeSpaceMembers(uid: string, space: Space) {
  if (space.kind !== 'shared') return
  await setDoc(workspaceRef(uid, space), {
    schemaVersion: 1,
    name: space.name,
    joinCode: space.joinCode,
    color: space.color ?? null,
    icon: space.icon ?? null,
    members: space.members.map(({ id, name, email, role, status }) => ({ id, name, ...(email ? { email } : {}), role, ...(status ? { status: status.slice(0, 120) } : {}) })),
    memberEmails: space.members.flatMap((member) => member.email ? [member.email.toLocaleLowerCase()] : []),
    ownerEmails: space.members.flatMap((member) => member.id === space.ownerId && member.email ? [member.email.toLocaleLowerCase()] : []),
    editorEmails: space.members.flatMap((member) => member.role !== 'viewer' && member.email ? [member.email.toLocaleLowerCase()] : []),
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

/** Activity entries are intentionally tiny, card-linkable records. They make the header bell
 * useful across collaborators without duplicating card content or private note bodies. */
export async function writeSpaceActivity(uid: string, space: FirestoreSpace, entry: SpaceActivity) {
  if (space.kind !== 'shared') return
  await setDoc(doc(workspaceRef(uid, space), 'activity', entry.id), { ...entry })
}

/** Presence is a short-lived client heartbeat, never membership or authorization metadata. */
export async function writeSpacePresence(uid: string, space: FirestoreSpace, presence: Omit<SpacePresence, 'uid'>) {
  if (space.kind !== 'shared') return
  await setDoc(doc(workspaceRef(uid, space), 'presence', uid), presence, { merge: true })
}
