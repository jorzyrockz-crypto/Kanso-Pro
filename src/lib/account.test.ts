import { describe, expect, it } from 'vitest'
import { AccountInputError, accountError, accountInitials, accountMode, accountName, accountPhotoUrl, errorCode, validEmail, validName, validPassword } from './account'
import type { AccountUser } from './account'

const user: AccountUser = { uid: 'test-user', displayName: '  Ada Reyes  ', email: 'ada@example.test', photoURL: 'https://profiles.example.test/ada.png', emailVerified: false, providers: ['password'] }

describe('account input and safe presentation', () => {
  it('only recognizes the three supported account modes', () => {
    expect(accountMode('create')).toBe('create')
    expect(accountMode('reset')).toBe('reset')
    for (const value of [null, '', 'sign-in', 'unknown', '<script>', 'CREATE']) expect(accountMode(value)).toBe('sign-in')
  })

  it('keeps guests recognizable and prefers a trimmed account display name', () => {
    expect(accountName(null)).toBe('My workspace')
    expect(accountInitials(null)).toBe('Y')
    expect(accountName(user)).toBe('Ada Reyes')
    expect(accountInitials(user)).toBe('AR')
    expect(accountName({ ...user, displayName: '  ' })).toBe('ada')
    expect(accountName({ ...user, displayName: null, email: null })).toBe('My workspace')
  })

  it('uses at most two initials and supports Unicode without splitting surrogate pairs', () => {
    expect(accountInitials({ ...user, displayName: 'José María Santos' })).toBe('JM')
    expect(accountInitials({ ...user, displayName: '🌱 Planner' })).toBe('🌱P')
    expect(accountInitials({ ...user, displayName: null, email: 'ada.reyes@example.test' })).toBe('AR')
    expect(accountInitials({ ...user, displayName: '---', email: null })).toBe('Y')
  })

  it('uses only secure Firebase profile-photo URLs and otherwise falls back to initials', () => {
    expect(accountPhotoUrl(user)).toBe('https://profiles.example.test/ada.png')
    for (const photoURL of [null, '', ' http://profiles.example.test/ada.png ', 'javascript:alert(1)', 'data:image/svg+xml,unsafe', 'not a url']) {
      expect(accountPhotoUrl({ ...user, photoURL })).toBeNull()
    }
  })

  it('validates and normalizes display names without interpreting markup', () => {
    expect(validName('  Ada \n Reyes  ')).toBe('Ada Reyes')
    expect(validName('<img onerror=alert(1)>')).toBe('<img onerror=alert(1)>')
    expect(validName('a'.repeat(80))).toHaveLength(80)
    for (const value of ['', ' \n ', 'a'.repeat(81)]) expect(() => validName(value)).toThrow('account/invalid-name')
  })

  it('trims email addresses but does not change their case', () => {
    expect(validEmail('  Ada.Reyes+plans@example.test  ')).toBe('Ada.Reyes+plans@example.test')
    for (const value of ['', 'ada', 'ada@', 'ada@example', 'ada reyes@example.test', 'ada@@example.test', `${'a'.repeat(250)}@test.test`]) {
      expect(() => validEmail(value)).toThrow('account/invalid-email')
    }
  })

  it('does not transform passwords and allows existing shorter sign-in passwords', () => {
    expect(validPassword('  secret  ', true)).toBe('  secret  ')
    expect(validPassword('legacy')).toBe('legacy')
    expect(validPassword('a'.repeat(4096))).toHaveLength(4096)
    expect(() => validPassword('')).toThrow('account/password-required')
    expect(() => validPassword('seven77', true)).toThrow('account/new-password')
    expect(validPassword('eight888', true)).toBe('eight888')
    expect(() => validPassword('a'.repeat(4097), true)).toThrow('account/new-password')
  })
})

describe('safe account error handling', () => {
  it('extracts only a string error code and handles arbitrary failures', () => {
    for (const value of [null, undefined, 'oops', 1, {}, { code: 5 }]) expect(errorCode(value)).toBe('')
    expect(errorCode(new AccountInputError('account/invalid-name'))).toBe('account/invalid-name')
  })

  it('uses the same sign-in message for unknown accounts and incorrect credentials', () => {
    const message = accountError({ code: 'auth/invalid-credential' })
    for (const code of ['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-login-credentials']) expect(accountError({ code })).toBe(message)
    expect(message).toContain('reset your password')
    expect(accountError({ code: 'auth/email-already-in-use' })).not.toContain('already in use')
  })

  it('explains configuration, connectivity, rate limits, and popup failures', () => {
    expect(accountError({ code: 'auth/operation-not-allowed' })).toContain('enable it in Firebase Authentication')
    expect(accountError({ code: 'auth/configuration-not-found' })).toContain('has not been set up')
    expect(accountError({ code: 'auth/unauthorized-domain' })).toContain('exact hostname')
    expect(accountError({ code: 'auth/network-request-failed' })).toContain('connection')
    expect(accountError({ code: 'auth/too-many-requests' })).toContain('Wait')
    expect(accountError({ code: 'auth/popup-blocked' })).toContain('email')
    expect(accountError({ code: 'auth/password-does-not-meet-requirements' })).toContain('account policy')
  })

  it('never reflects raw SDK messages, tokens, email addresses, or HTML', () => {
    for (const value of [new Error('private-token <script> user@example.test'), { code: 'unknown', message: 'private-token <script> user@example.test' }]) {
      const text = accountError(value)
      expect(text).toContain('workspace is unchanged')
      expect(text).not.toMatch(/private-token|script|user@example/)
    }
  })

  it('distinguishes successful signup with a failed profile update', () => {
    expect(accountError({ code: 'account/profile-not-saved' })).toContain('account was created')
    expect(accountError({ code: 'account/profile-not-saved' })).toContain('save your name')
  })
})
