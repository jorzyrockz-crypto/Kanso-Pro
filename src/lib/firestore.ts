import { collection, doc, getDoc, getFirestore, increment, initializeFirestore, onSnapshot, persistentLocalCache, persistentMultipleTabManager, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import type { Firestore, QueryDocumentSnapshot, Unsubscribe } from 'firebase/firestore'
import { firebaseApp } from './firebase'
import { parseSavedState } from './store'
import type { JournalAttachment, JourneyCard, JourneyState } from '../types'

const WORKSPACE_ID = 'default'
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
  fromCache: boolean
  pendingWrites: boolean
}

function workspaceRef(uid: string) {
  return doc(database, 'users', uid, 'workspaces', WORKSPACE_ID)
}

function journalImageRef(uid: string, id: string) {
  return doc(workspaceRef(uid), 'journalImages', id)
}

const FIRESTORE_IMAGE_DATA_LIMIT = 850_000

/** Images are optimised in the browser before reaching Firestore, never embedded in a card document. */
export async function writeJournalImage(uid: string, attachment: JournalAttachment, dataUrl: string) {
  if (attachment.kind !== 'image' || attachment.storage !== 'firestore' || !dataUrl.startsWith('data:image/') || dataUrl.length > FIRESTORE_IMAGE_DATA_LIMIT) throw new Error('This image is too large for private Firestore storage.')
  await setDoc(journalImageRef(uid, attachment.id), {
    dataUrl,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    width: attachment.width ?? null,
    height: attachment.height ?? null,
    updatedAt: serverTimestamp(),
  })
}

export async function readJournalImage(uid: string, id: string) {
  const snapshot = await getDoc(journalImageRef(uid, id))
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  return typeof data.dataUrl === 'string' && data.dataUrl.startsWith('data:image/') ? data.dataUrl : null
}

function cleanCard(value: Record<string, unknown>): JourneyCard | null {
  const { revision: _revision, updatedAt: _updatedAt, updatedBy: _updatedBy, deletedAt, ...card } = value
  if (deletedAt) return null
  const parsed = parseSavedState(JSON.stringify({ version: 1, bezel: false, cards: [card] }))
  return parsed?.cards[0] ?? null
}

function serializeCard(card: JourneyCard) {
  // Optional UI fields are intentionally omitted rather than sent as undefined, which
  // Firestore rejects. Cards contain only JSON-compatible workspace data.
  return JSON.parse(JSON.stringify(card)) as JourneyCard
}

export function subscribeWorkspace(uid: string, onValue: (snapshot: RemoteWorkspaceSnapshot) => void, onError: (error: unknown) => void): Unsubscribe {
  const workspace = workspaceRef(uid)
  const cards = collection(workspace, 'cards')
  let workspaceData: Record<string, unknown> | null = null
  let workspaceExists = false
  let workspaceFromCache = true
  let workspacePendingWrites = false
  let cardData: QueryDocumentSnapshot[] | null = null
  let cardsFromCache = true
  let cardsPendingWrites = false

  const publish = () => {
    if (!workspaceData || !cardData) return
    const parsedCards = cardData.map((entry) => cleanCard(entry.data())).filter((card): card is JourneyCard => !!card)
    onValue({
      exists: workspaceExists || cardData.length > 0,
      state: { version: 1, bezel: workspaceData.bezel === true, cards: parsedCards.sort((a, b) => a.id.localeCompare(b.id)) },
      fromCache: workspaceFromCache || cardsFromCache,
      pendingWrites: workspacePendingWrites || cardsPendingWrites,
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
  return () => { unsubscribeWorkspace(); unsubscribeCards() }
}

async function writeCardBatch(uid: string, cards: JourneyCard[]) {
  const batch = writeBatch(database)
  for (const card of cards) {
    batch.set(doc(workspaceRef(uid), 'cards', card.id), {
      ...serializeCard(card),
      revision: increment(1),
      updatedAt: serverTimestamp(),
      updatedBy: 'browser',
      deletedAt: null,
    })
  }
  await batch.commit()
}

export async function writeWorkspace(uid: string, state: JourneyState, cards: JourneyCard[]) {
  const workspace = workspaceRef(uid)
  // Keep a real parent document even when the first personal change is a card. Firestore
  // permits orphaned subcollections, but a root document makes first-device hydration safe.
  await setDoc(workspace, {
    schemaVersion: 1,
    initialized: true,
    bezel: state.bezel,
    updatedAt: serverTimestamp(),
  }, { merge: true })
  for (let start = 0; start < cards.length; start += CARD_BATCH_SIZE) await writeCardBatch(uid, cards.slice(start, start + CARD_BATCH_SIZE))
}

export async function createWorkspace(uid: string, state: JourneyState) {
  await writeWorkspace(uid, state, state.cards)
}
