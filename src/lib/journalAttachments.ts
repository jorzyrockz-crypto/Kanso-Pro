import type { JournalAttachment } from '../types'

const DATABASE = 'kanso-pro:journal-attachments:v1'
const STORE = 'attachments'

export class JournalAttachmentError extends Error {}

function database(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new JournalAttachmentError('This browser cannot store journal attachments locally.'))
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onerror = () => reject(new JournalAttachmentError('Kanso could not open private attachment storage on this device.'))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
  })
}

async function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database()
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const request = run(transaction.objectStore(STORE))
    request.onerror = () => reject(new JournalAttachmentError('Kanso could not save this attachment locally.'))
    transaction.onerror = () => reject(new JournalAttachmentError('Kanso could not save this attachment locally.'))
    request.onsuccess = () => resolve(request.result as T)
  }).finally(() => db.close())
}

export async function saveJournalAttachment(file: Blob, attachment: JournalAttachment) {
  await transact('readwrite', (store) => store.put(file, attachment.id))
  return attachment
}

export async function getJournalAttachment(id: string) {
  return transact<Blob | undefined>('readonly', (store) => store.get(id))
}

export async function removeJournalAttachment(id: string) {
  await transact('readwrite', (store) => store.delete(id))
}
