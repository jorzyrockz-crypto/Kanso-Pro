export interface AccountUser {
  uid: string
  displayName: string | null
  email: string | null
  /** Firebase Authentication profile image, kept separate from device-only cards. */
  photoURL: string | null
  emailVerified: boolean
  providers: string[]
}

export type AccountAction = 'sign-in' | 'create' | 'google' | 'sign-out' | 'save-name' | 'reset' | 'verify' | 'refresh'
export type AccountMode = 'sign-in' | 'create' | 'reset'

export class AccountInputError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.name = 'AccountInputError'
    this.code = code
  }
}

export function accountMode(value: string | null): AccountMode {
  return value === 'create' || value === 'reset' ? value : 'sign-in'
}

export function accountName(user: AccountUser | null): string {
  return user?.displayName?.trim() || user?.email?.split('@')[0] || 'My workspace'
}

export function accountInitials(user: AccountUser | null): string {
  if (!user) return 'Y'
  return accountName(user).split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => Array.from(part)[0]).join('').toLocaleUpperCase('en-US') || 'Y'
}

/** Only render normal secure web image URLs supplied by Firebase Authentication. */
export function accountPhotoUrl(user: AccountUser | null): string | null {
  const value = user?.photoURL?.trim()
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export function validName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ')
  if (!name || name.length > 80) throw new AccountInputError('account/invalid-name')
  return name
}

export function validEmail(value: string): string {
  const email = value.trim()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AccountInputError('account/invalid-email')
  return email
}

export function validPassword(value: string, creating = false): string {
  // Passwords are deliberately never trimmed or otherwise transformed.
  if (!value || value.length > 4096 || (creating && value.length < 8)) throw new AccountInputError(creating ? 'account/new-password' : 'account/password-required')
  return value
}

export function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : ''
}

const errorMessages: Record<string, string> = {
  'account/invalid-name': 'Enter a display name between 1 and 80 characters.',
  'account/invalid-email': 'Enter a valid email address.',
  'auth/invalid-email': 'Enter a valid email address.',
  'account/new-password': 'Use a password with at least 8 characters.',
  'account/password-required': 'Enter your password to sign in.',
  'auth/missing-password': 'Enter your password to sign in.',
  'auth/weak-password': 'Choose a stronger password with at least 8 characters.',
  'auth/password-does-not-meet-requirements': 'This password does not meet the account policy. Try a longer password with upper- and lowercase letters, a number, and a symbol.',
  'auth/invalid-credential': 'That email and password combination did not work. Try again or reset your password.',
  'auth/invalid-login-credentials': 'That email and password combination did not work. Try again or reset your password.',
  'auth/wrong-password': 'That email and password combination did not work. Try again or reset your password.',
  'auth/user-not-found': 'That email and password combination did not work. Try again or reset your password.',
  'auth/email-already-in-use': 'We could not create that account. Try signing in or resetting your password instead.',
  'auth/account-exists-with-different-credential': 'This email uses another sign-in method. Sign in with the method you used before.',
  'auth/user-disabled': 'This account is unavailable. Contact the workspace owner for help.',
  'auth/too-many-requests': 'There have been too many attempts. Wait a little before trying again.',
  'auth/network-request-failed': 'We could not reach sign-in. Check your connection and try again. Your device workspace still works.',
  'auth/timeout': 'Sign-in took too long. Check your connection and try again.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled yet. The project owner needs to enable it in Firebase Authentication.',
  'auth/unauthorized-domain': 'Google sign-in is not allowed on this domain yet. Add this exact hostname to Firebase Authentication’s authorized domains, or use email sign-in.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site, or sign in with email.',
  'auth/popup-closed-by-user': 'The Google sign-in window was closed. Try again, or sign in with email.',
  'auth/cancelled-popup-request': 'Another sign-in window is already open. Finish it, or sign in with email.',
  'auth/operation-not-supported-in-this-environment': 'Google sign-in is unavailable in this browser. Try email sign-in instead.',
  'auth/web-storage-unsupported': 'Your browser is blocking sign-in storage. Allow site storage or use a regular browser window.',
  'auth/invalid-api-key': 'The Firebase web configuration needs attention. Ask the project owner to check the API key and project settings.',
  'auth/app-not-authorized': 'This app is not authorized for the configured Firebase project. Ask the project owner to check its web app and API key restrictions.',
  'auth/configuration-not-found': 'Firebase Authentication has not been set up for this project yet. The project owner needs to enable a sign-in provider.',
  'auth/invalid-app-credential': 'Sign-in verification could not be completed. Check this project’s Firebase Authentication configuration.',
  'auth/requires-recent-login': 'Please sign out and sign in again before trying that change.',
  'auth/user-token-expired': 'Your sign-in has expired. Please sign in again.',
  'account/busy': 'Another account action is still finishing. Please wait a moment.',
  'account/profile-not-saved': 'Your account was created, but we could not save your name. You can try saving it again below.',
}

/** Never show SDK exception text, response payloads, tokens, or passwords to the user. */
export function accountError(error: unknown): string {
  return errorMessages[errorCode(error)] ?? 'We could not complete that account action. Please try again. Your device workspace is unchanged.'
}
