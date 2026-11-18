import { describe, expect, it } from 'vitest'
import { JournalImageError, journalImageUploadErrorMessage } from './journalImages'

describe('journal image upload feedback', () => {
  it('keeps actionable image preparation errors intact', () => {
    expect(journalImageUploadErrorMessage(new JournalImageError('Choose an image smaller than 10 MB.'))).toBe('Choose an image smaller than 10 MB.')
    expect(journalImageUploadErrorMessage(new Error('This image is too large for private Firestore storage.'))).toBe('This photo is still too large after preparation. Choose a smaller or simpler image.')
  })

  it('distinguishes Firestore access from a Google sign-in or local workspace role', () => {
    expect(journalImageUploadErrorMessage({ code: 'permission-denied' }, { kind: 'shared' })).toBe('Your Google sign-in is active, but this shared Space has not granted this exact Google email Firestore Editor access. Ask its Owner to add that email as an Editor, then retry.')
    expect(journalImageUploadErrorMessage({ code: 'permission-denied' }, { kind: 'personal' })).toBe('Your Google sign-in is active, so this is not a Workspace-role issue. Firestore access for this project needs attention; ask the app administrator to verify the deployed Firestore rules, then retry.')
  })

  it.each([
    ['unauthenticated', 'Your Google session expired. Sign in with Google again, then retry the photo.'],
    ['unavailable', 'Firestore cannot be reached right now. Check your connection, then retry the photo.'],
    ['resource-exhausted', 'Firestore cannot save this photo right now because its upload limit was reached. Choose a smaller image and retry.'],
  ])('explains Firestore %s failures', (code, expected) => {
    expect(journalImageUploadErrorMessage({ code })).toBe(expected)
  })

  it('offers a safe recovery step for an unknown write error', () => {
    expect(journalImageUploadErrorMessage(new Error('Unexpected failure'))).toBe('The photo was not saved. Check your connection and Google sign-in, then retry.')
  })
})
