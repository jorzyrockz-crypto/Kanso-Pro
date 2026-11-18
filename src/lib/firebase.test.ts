import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the SDK boundary, not our application adapter. No production accounts or emails.
const sdk = vi.hoisted(() => {
  const user = { uid: 'fake-uid', displayName: 'Ada Reyes', email: 'ada@example.test', photoURL: 'https://profiles.example.test/ada.png', emailVerified: false, providerData: [{ providerId: 'password' }, { providerId: 'password' }], refreshToken: 'private-test-token' }
  const auth: { currentUser: typeof user | null; languageCode: string | null } = { currentUser: user, languageCode: null }
  return {
    user, auth, app: { name: 'kanso-pro' },
    getApps: vi.fn(), getApp: vi.fn(), initializeApp: vi.fn(), initializeAuth: vi.fn(), getAuth: vi.fn(),
    onIdTokenChanged: vi.fn(), getIdTokenResult: vi.fn(), createUserWithEmailAndPassword: vi.fn(), signInWithEmailAndPassword: vi.fn(),
    signInWithPopup: vi.fn(), signOut: vi.fn(), updateProfile: vi.fn(), sendPasswordResetEmail: vi.fn(),
    sendEmailVerification: vi.fn(), reload: vi.fn(), setCustomParameters: vi.fn(),
  }
})
vi.mock('firebase/app', () => ({ getApps: sdk.getApps, getApp: sdk.getApp, initializeApp: sdk.initializeApp }))
vi.mock('firebase/auth', () => ({
  initializeAuth: sdk.initializeAuth, getAuth: sdk.getAuth, onIdTokenChanged: sdk.onIdTokenChanged, getIdTokenResult: sdk.getIdTokenResult,
  createUserWithEmailAndPassword: sdk.createUserWithEmailAndPassword, signInWithEmailAndPassword: sdk.signInWithEmailAndPassword,
  signInWithPopup: sdk.signInWithPopup, signOut: sdk.signOut, updateProfile: sdk.updateProfile,
  sendPasswordResetEmail: sdk.sendPasswordResetEmail, sendEmailVerification: sdk.sendEmailVerification, reload: sdk.reload,
  indexedDBLocalPersistence: 'indexed-db', browserLocalPersistence: 'local', inMemoryPersistence: 'memory', browserPopupRedirectResolver: 'popup-resolver',
  GoogleAuthProvider: class { setCustomParameters = sdk.setCustomParameters },
}))

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  sdk.auth.currentUser = sdk.user
  sdk.user.providerData = [{ providerId: 'password' }]
  sdk.auth.languageCode = null
  sdk.getApps.mockReturnValue([])
  sdk.initializeApp.mockReturnValue(sdk.app)
  sdk.getApp.mockReturnValue(sdk.app)
  sdk.initializeAuth.mockReturnValue(sdk.auth)
  sdk.getAuth.mockReturnValue(sdk.auth)
  sdk.createUserWithEmailAndPassword.mockResolvedValue({ user: sdk.user })
  sdk.getIdTokenResult.mockResolvedValue({ claims: { firebase: { sign_in_provider: 'password' } } })
})

describe('Firebase account adapter', () => {
  it('uses the supplied project and resilient persistence without eagerly adding an OAuth resolver', async () => {
    const client = await import('./firebase')
    expect(client.firebaseConfig).toMatchObject({ projectId: 'russapps-kanso-pro', authDomain: 'russapps-kanso-pro.firebaseapp.com', appId: '1:422480569925:web:c6f9969250fec1b3dda52c' })
    expect(sdk.initializeApp).toHaveBeenCalledWith(client.firebaseConfig, client.FIREBASE_APP_NAME)
    expect(sdk.initializeAuth).toHaveBeenCalledWith(sdk.app, { persistence: ['indexed-db', 'local', 'memory'] })
    expect(sdk.auth.languageCode).toBe('en')
    expect(sdk.signInWithPopup).not.toHaveBeenCalled()
  })

  it('supports public Vite configuration overrides', async () => {
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'another-public-project')
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'another-public-web-key')
    const client = await import('./firebase')
    expect(client.firebaseConfig.projectId).toBe('another-public-project')
    expect(client.firebaseConfig.apiKey).toBe('another-public-web-key')
  })

  it('reuses the named app/auth when hot-reloaded, but does not swallow other initialization errors', async () => {
    sdk.getApps.mockReturnValue([sdk.app])
    sdk.initializeAuth.mockImplementation(() => { throw { code: 'auth/already-initialized' } })
    await import('./firebase')
    expect(sdk.initializeApp).not.toHaveBeenCalled()
    expect(sdk.getApp).toHaveBeenCalledWith('kanso-pro')
    expect(sdk.getAuth).toHaveBeenCalledWith(sdk.app)
    vi.resetModules()
    const error = { code: 'auth/invalid-api-key' }
    sdk.initializeAuth.mockImplementation(() => { throw error })
    await expect(import('./firebase')).rejects.toBe(error)
  })

  it('emits safe identity snapshots with the active token provider and cleans up its observer', async () => {
    // A Google provider may be linked, while the active ID token was issued by password auth.
    sdk.user.providerData = [{ providerId: 'google.com' }, { providerId: 'password' }]
    const client = await import('./firebase')
    const onUser = vi.fn(), onError = vi.fn(), unsubscribe = vi.fn()
    sdk.onIdTokenChanged.mockImplementation((_auth, callback, errorCallback) => {
      callback(sdk.user)
      errorCallback('example-failure')
      return unsubscribe
    })
    const stop = client.observeAccount(onUser, onError)
    await vi.waitFor(() => expect(onUser).toHaveBeenCalledWith({ uid: 'fake-uid', displayName: 'Ada Reyes', email: 'ada@example.test', photoURL: 'https://profiles.example.test/ada.png', emailVerified: false, providers: ['google.com', 'password'], signInProvider: 'password' }))
    expect(onError).toHaveBeenCalledWith('example-failure')
    expect(client.currentAccount()).not.toHaveProperty('refreshToken')
    expect(client.currentAccount()).toMatchObject({ signInProvider: 'password' })
    stop()
    expect(unsubscribe).toHaveBeenCalledOnce()
    sdk.auth.currentUser = null
    expect(client.currentAccount()).toBeNull()
  })

  it('sends validated sign-in inputs to Firebase without changing passwords', async () => {
    const client = await import('./firebase')
    await client.signInAccount('  ada@example.test  ', '  secret  ')
    expect(sdk.signInWithEmailAndPassword).toHaveBeenCalledWith(sdk.auth, 'ada@example.test', '  secret  ')
    await expect(client.signInAccount('not-an-email', 'secret')).rejects.toMatchObject({ code: 'account/invalid-email' })
    expect(sdk.signInWithEmailAndPassword).toHaveBeenCalledOnce()
  })

  it('validates all signup inputs before creating anything and saves the display name afterward', async () => {
    const client = await import('./firebase')
    for (const values of [['', 'ada@example.test', 'password88'], ['Ada', 'oops', 'password88'], ['Ada', 'ada@example.test', 'short']]) {
      await expect(client.createAccount(values[0], values[1], values[2])).rejects.toHaveProperty('code')
    }
    expect(sdk.createUserWithEmailAndPassword).not.toHaveBeenCalled()
    await client.createAccount('  Ada   Reyes  ', ' ada@example.test ', 'password88')
    expect(sdk.createUserWithEmailAndPassword).toHaveBeenCalledWith(sdk.auth, 'ada@example.test', 'password88')
    expect(sdk.updateProfile).toHaveBeenCalledWith(sdk.user, { displayName: 'Ada Reyes' })
    expect(sdk.sendEmailVerification).not.toHaveBeenCalled()
  })

  it('does not claim creation failed or delete an account if only the profile save fails', async () => {
    const client = await import('./firebase')
    sdk.updateProfile.mockRejectedValue({ code: 'auth/network-request-failed' })
    await expect(client.createAccount('Ada', 'ada@example.test', 'password88')).rejects.toMatchObject({ code: 'account/profile-not-saved' })
    expect(sdk.createUserWithEmailAndPassword).toHaveBeenCalledOnce()
    expect(sdk.signOut).not.toHaveBeenCalled()
    expect(client.currentAccount()?.uid).toBe('fake-uid')
  })

  it('uses a user-initiated Google popup with account selection and the explicit resolver', async () => {
    const client = await import('./firebase')
    await client.googleSignIn()
    expect(sdk.setCustomParameters).toHaveBeenCalledWith({ prompt: 'select_account' })
    expect(sdk.signInWithPopup).toHaveBeenCalledWith(sdk.auth, expect.any(Object), 'popup-resolver')
  })

  it('returns generic reset success for unknown accounts, while propagating real failures', async () => {
    const client = await import('./firebase')
    sdk.sendPasswordResetEmail.mockRejectedValueOnce({ code: 'auth/user-not-found' })
    await expect(client.requestPasswordReset(' ada@example.test ')).resolves.toBeUndefined()
    expect(sdk.sendPasswordResetEmail).toHaveBeenCalledWith(sdk.auth, 'ada@example.test')
    sdk.sendPasswordResetEmail.mockRejectedValueOnce({ code: 'auth/too-many-requests' })
    await expect(client.requestPasswordReset('ada@example.test')).rejects.toMatchObject({ code: 'auth/too-many-requests' })
  })

  it('updates names, requests verification, refreshes identity, and signs out through the SDK', async () => {
    const client = await import('./firebase')
    await client.saveAccountName(' Ada   R. ')
    expect(sdk.updateProfile).toHaveBeenCalledWith(sdk.user, { displayName: 'Ada R.' })
    await client.requestVerification()
    expect(sdk.sendEmailVerification).toHaveBeenCalledWith(sdk.user)
    await client.refreshAccount()
    expect(sdk.reload).toHaveBeenCalledWith(sdk.user)
    await client.signOutAccount()
    expect(sdk.signOut).toHaveBeenCalledWith(sdk.auth)
  })

  it('does not send protected profile/verification requests without a current user', async () => {
    const client = await import('./firebase')
    sdk.auth.currentUser = null
    await expect(client.saveAccountName('Ada')).rejects.toMatchObject({ code: 'auth/user-token-expired' })
    await expect(client.requestVerification()).rejects.toMatchObject({ code: 'auth/user-token-expired' })
    await expect(client.refreshAccount()).rejects.toMatchObject({ code: 'auth/user-token-expired' })
    expect(sdk.updateProfile).not.toHaveBeenCalled()
    expect(sdk.sendEmailVerification).not.toHaveBeenCalled()
    expect(sdk.reload).not.toHaveBeenCalled()
  })
})
