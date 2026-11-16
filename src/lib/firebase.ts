import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  browserLocalPersistence, browserPopupRedirectResolver, createUserWithEmailAndPassword,
  getAuth, GoogleAuthProvider, indexedDBLocalPersistence, initializeAuth, inMemoryPersistence,
  onAuthStateChanged, reload, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile,
} from 'firebase/auth'
import type { Auth, User } from 'firebase/auth'
import type { AccountUser } from './account'
import { AccountInputError, errorCode, validEmail, validName, validPassword } from './account'

// Firebase web configuration is public client metadata, not a server/admin credential.
// Optional Vite environment overrides support another deployment without source edits.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAtpjyduoGXlhBgEASKr8h-B1v3nxZ7NdI',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'russapps-kanso-pro.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'russapps-kanso-pro',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'russapps-kanso-pro.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '422480569925',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:422480569925:web:c6f9969250fec1b3dda52c',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-0HB4V20HF5',
}

export const firebaseApp = getApps().some((entry) => entry.name === '[DEFAULT]') ? getApp() : initializeApp(firebaseConfig)
let auth: Auth
try {
  // No popup iframe or Google scripts are initialized until the user chooses Google.
  auth = initializeAuth(firebaseApp, { persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence] })
} catch (error) {
  if (errorCode(error) !== 'auth/already-initialized') throw error
  auth = getAuth(firebaseApp)
}
auth.languageCode = 'en'

function snapshot(user: User | null): AccountUser | null {
  return user ? {
    uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL, emailVerified: user.emailVerified,
    providers: [...new Set(user.providerData.map((entry) => entry.providerId))],
  } : null
}

export function currentAccount(): AccountUser | null { return snapshot(auth.currentUser) }

export function observeAccount(onUser: (user: AccountUser | null) => void, onError: (error: unknown) => void) {
  return onAuthStateChanged(auth, (user) => onUser(snapshot(user)), onError)
}

export async function signInAccount(email: string, password: string) {
  await signInWithEmailAndPassword(auth, validEmail(email), validPassword(password))
}

export async function createAccount(name: string, email: string, password: string) {
  const displayName = validName(name)
  const address = validEmail(email)
  const secret = validPassword(password, true)
  const result = await createUserWithEmailAndPassword(auth, address, secret)
  try {
    await updateProfile(result.user, { displayName })
  } catch {
    // Creation has already succeeded: never pretend it failed and invite a second signup.
    throw new AccountInputError('account/profile-not-saved')
  }
}

export async function googleSignIn() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  await signInWithPopup(auth, provider, browserPopupRedirectResolver)
}

export async function signOutAccount() { await signOut(auth) }

function signedInUser(): User {
  if (!auth.currentUser) throw new AccountInputError('auth/user-token-expired')
  return auth.currentUser
}

export async function saveAccountName(value: string) {
  await updateProfile(signedInUser(), { displayName: validName(value) })
}

export async function requestPasswordReset(email: string) {
  try {
    // Firebase's hosted email action handler works without a hard-coded preview origin.
    await sendPasswordResetEmail(auth, validEmail(email))
  } catch (error) {
    // Match the generic success message even if email enumeration protection is off.
    if (errorCode(error) !== 'auth/user-not-found') throw error
  }
}

export async function requestVerification() { await sendEmailVerification(signedInUser()) }
export async function refreshAccount() { await reload(signedInUser()) }

// Analytics is intentionally not initialized: account access does not require tracking.
// Firestore is loaded separately and only after a Google-authenticated workspace session begins.
