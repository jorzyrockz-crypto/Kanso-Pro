import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import { STORAGE_KEY } from '../src/data'
import { mockFirebase } from './helpers/firebase'
import type { FirebaseHarness } from './helpers/firebase'

const accountLink = (page: Page) => page.locator('.personal-workspace')
const email = (page: Page) => page.getByLabel('Email address', { exact: true })
const password = (page: Page) => page.getByLabel('Password', { exact: true })
const navigation = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' })
const localState = (page: Page) => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
const feedback = (page: Page) => page.locator('.account-feedback')
async function signIn(page: Page) {
  await email(page).fill('ada@example.test')
  await password(page).fill('test-passphrase-2026')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('form', { name: 'Profile details' })).toBeVisible()
  await expect(page).toHaveURL('/account')
}
const settle = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
const audit = async (page: Page) => {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(report.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => ({ html: node.html, summary: node.failureSummary })) }))).toEqual([])
}
let firebase: FirebaseHarness
let runtimeErrors: string[]
test.beforeEach(async ({ context, page }) => {
  firebase = await mockFirebase(context)
  runtimeErrors = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
})
test.afterEach(() => {
  expect(runtimeErrors).toEqual([])
  expect(firebase.unexpectedRequests).toEqual([])
})

test('the workspace badge opens a normal, refreshable account page and guests can keep planning', async ({ page }) => {
  await page.goto('/')
  await expect(accountLink(page)).toHaveAttribute('aria-expanded', 'false')
  await accountLink(page).click()
  const signInLink = page.getByRole('navigation', { name: 'Profile', exact: true }).getByRole('link', { name: 'Sign in', exact: true })
  await expect(signInLink).toHaveAttribute('href', '/sign-in')
  await signInLink.click()
  await expect(page).toHaveURL('/sign-in')
  await expect(page).toHaveTitle('Sign in · Kanso Pro')
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page.getByRole('main')).toHaveCount(1)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(navigation(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'New card', exact: true })).toHaveCount(0)
  await expect(email(page)).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  await expect(page.locator('.sign-in-local-note')).toContainText('does not add cloud sync')
  await page.locator('.sign-in-device > summary').click()
  await expect(page.getByText('Sign-in is not cloud sync.', { exact: true })).toBeVisible()
  await expect(page.locator('.account-device-save')).toContainText('8 cards')
  await page.locator('.sign-in-device > summary').click()
  await page.getByRole('link', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL('/sign-in?mode=create')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Display name', exact: true })).toBeVisible()
  await expect(password(page)).toHaveAttribute('autocomplete', 'new-password')
  await page.goBack()
  await expect(page).toHaveURL('/sign-in')
  await expect(password(page)).toHaveAttribute('autocomplete', 'current-password')
  await page.goForward()
  await expect(page).toHaveURL('/sign-in?mode=create')
  await page.getByRole('link', { name: 'Continue as guest', exact: true }).click()
  await expect(page).toHaveURL('/')
  await expect(page.locator('.journey-card')).toHaveCount(6)
  expect(firebase.requests).toHaveLength(0)
})

test('email sign-in persists after refresh and never changes or uploads the local cards', async ({ page }) => {
  await page.goto('/journal/note-lesson')
  await page.getByRole('textbox', { name: 'Your reflection', exact: true }).fill('My private, locally stored planning note.')
  const before = await localState(page)
  await accountLink(page).click()
  await page.getByRole('navigation', { name: 'Profile', exact: true }).getByRole('link', { name: 'Sign in', exact: true }).click()
  await signIn(page)
  await expect(accountLink(page)).toContainText('Ada Reyes')
  await expect(accountLink(page).locator('.workspace-avatar')).toHaveText('AR')
  await expect(page.locator('.account-identity')).toContainText('ada@example.test')
  expect(await localState(page)).toBe(before)
  expect(firebase.requests.filter(({ endpoint }) => endpoint === 'signInWithPassword')).toHaveLength(1)
  expect(JSON.stringify(firebase.requests)).not.toContain('My private, locally stored planning note.')
  expect(before).not.toMatch(/test-passphrase|idToken|refreshToken/)
  await page.reload()
  await expect(page.getByRole('form', { name: 'Profile details' })).toBeVisible()
  await expect(accountLink(page)).toContainText('Ada Reyes')
  expect(firebase.requests.filter(({ endpoint }) => endpoint === 'signInWithPassword')).toHaveLength(1)
  expect(await localState(page)).toBe(before)
})

test('account creation saves identity, verification is explicit, and profile updates are literal text', async ({ page }) => {
  await page.goto('/account?mode=create')
  const before = await localState(page)
  await page.getByRole('textbox', { name: 'Display name', exact: true }).fill('Mia Santos')
  await email(page).fill('mia@example.test')
  await password(page).fill('test-passphrase-2026')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('form', { name: 'Profile details' })).toBeVisible()
  await expect(accountLink(page)).toContainText('Mia Santos')
  await expect(page.locator('.account-identity')).toContainText('mia@example.test')
  expect(firebase.requests.filter(({ endpoint }) => endpoint === 'signUp')).toHaveLength(1)
  expect(firebase.requests.filter(({ endpoint }) => endpoint === 'sendOobCode')).toHaveLength(0)
  await page.getByRole('button', { name: 'Send verification email', exact: true }).click()
  await expect(feedback(page)).toContainText('Verification email sent')
  expect(firebase.requests.find(({ endpoint }) => endpoint === 'sendOobCode')?.body.requestType).toBe('VERIFY_EMAIL')
  firebase.profile.verified = true
  await page.getByRole('button', { name: 'Check verification', exact: true }).click()
  await expect(page.locator('.account-verification')).toContainText('Email verified')
  await expect(page.getByRole('button', { name: 'Send verification email', exact: true })).toHaveCount(0)
  const name = '<img src=x onerror=alert(1)>'
  await page.getByRole('textbox', { name: 'Display name', exact: true }).fill(name)
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(feedback(page)).toContainText('display name has been saved')
  await expect(accountLink(page).locator('strong')).toHaveText(name)
  await expect(page.locator('.account-identity strong')).toHaveText(name)
  await expect(page.locator('.account-card img, .personal-workspace img')).toHaveCount(0)
  expect(await localState(page)).toBe(before)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Display name', exact: true })).toHaveValue(name)
})

test('sign-in and sign-out synchronize across tabs without clearing the shared device workspace', async ({ page, context }) => {
  await page.goto('/account')
  const before = await localState(page)
  const other = await context.newPage()
  await other.goto('/account')
  await expect(email(other)).toBeEnabled()
  await signIn(page)
  await expect(other.getByRole('form', { name: 'Profile details' })).toBeVisible()
  await expect(accountLink(other)).toContainText('Ada Reyes')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(feedback(page)).toContainText('You’re signed out')
  await expect(email(page)).toBeEnabled()
  await expect(email(other)).toBeEnabled()
  await expect(other).toHaveURL('/sign-in')
  await expect(navigation(other)).toHaveCount(0)
  expect(await localState(page)).toBe(before)
  expect(await localState(other)).toBe(before)
  await page.reload()
  await expect(email(page)).toBeEnabled()
  await other.close()
})

test('validation and credential errors are actionable, do not leak details, and clear passwords', async ({ page }) => {
  await page.goto('/account')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  expect(firebase.requests).toHaveLength(0)
  await email(page).fill('not-an-address')
  await password(page).fill('test-passphrase-2026')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  expect(firebase.requests).toHaveLength(0)
  await email(page).fill('ada@example.test')
  await page.getByRole('button', { name: 'Show password', exact: true }).click()
  await expect(password(page)).toHaveAttribute('type', 'text')
  firebase.failures.signInWithPassword = 'INVALID_LOGIN_CREDENTIALS'
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(feedback(page)).toContainText('email and password combination did not work')
  await expect(feedback(page)).toBeFocused()
  await expect(password(page)).toHaveValue('')
  await expect(password(page)).toHaveAttribute('type', 'password')
  await expect(feedback(page)).not.toContainText('INVALID_LOGIN_CREDENTIALS')
  expect(page.url()).not.toMatch(/ada|test-passphrase/)
  expect(await localState(page)).not.toMatch(/ada@example|test-passphrase/)
  delete firebase.failures.signInWithPassword
  await signIn(page)
  await expect(feedback(page)).toContainText('signed in')
})

test('provider setup, rate limits, and offline errors leave guest navigation usable', async ({ page }) => {
  await page.goto('/account')
  const before = await localState(page)
  for (const [failure, message] of [
    ['OPERATION_NOT_ALLOWED', 'not enabled yet'],
    ['CONFIGURATION_NOT_FOUND', 'has not been set up'],
    ['TOO_MANY_ATTEMPTS_TRY_LATER', 'too many attempts'],
    ['offline', 'Check your connection'],
  ]) {
    firebase.failures.signInWithPassword = failure
    await email(page).fill('ada@example.test')
    await password(page).fill('test-passphrase-2026')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(feedback(page)).toContainText(message)
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
    expect(await localState(page)).toBe(before)
  }
  await page.getByRole('link', { name: 'Continue as guest', exact: true }).click()
  await navigation(page).getByRole('link', { name: 'Tasks', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Personal Tasks', exact: true })).toBeVisible()
})

test('password recovery uses a real page and generic confirmation even for unknown accounts', async ({ page }) => {
  await page.goto('/account')
  await page.getByRole('link', { name: 'Forgot your password?', exact: true }).click()
  await expect(page).toHaveURL('/sign-in?mode=reset')
  await expect(password(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
  await email(page).fill('nobody@example.test')
  firebase.failures.PASSWORD_RESET = 'EMAIL_NOT_FOUND'
  await page.getByRole('button', { name: 'Send reset email', exact: true }).click()
  await expect(feedback(page)).toContainText('If an account exists for that email')
  expect(firebase.requests.find(({ endpoint }) => endpoint === 'sendOobCode')?.body).toMatchObject({ email: 'nobody@example.test', requestType: 'PASSWORD_RESET' })
  await page.getByRole('link', { name: 'Back to sign in', exact: true }).click()
  await expect(page).toHaveURL('/sign-in')
  await expect(feedback(page)).toHaveCount(0)
})

test('a failed name save after signup keeps the created account recoverable', async ({ page }) => {
  firebase.failures.update = 'NETWORK_REQUEST_FAILED'
  await page.goto('/account?mode=create')
  await page.getByRole('textbox', { name: 'Display name', exact: true }).fill('Ada Reyes')
  await email(page).fill('ada@example.test')
  await password(page).fill('test-passphrase-2026')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(feedback(page)).toContainText('account was created')
  await expect(page.getByRole('form', { name: 'Profile details' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  expect(firebase.requests.filter(({ endpoint }) => endpoint === 'signUp')).toHaveLength(1)
  delete firebase.failures.update
  await page.getByRole('textbox', { name: 'Display name', exact: true }).fill('Ada Reyes')
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(accountLink(page)).toContainText('Ada Reyes')
})

test('pending actions prevent duplicate requests but never trap the user on the account page', async ({ page }) => {
  let release!: () => void
  firebase.signInGate = new Promise<void>((resolve) => { release = resolve })
  await page.goto('/account')
  await email(page).fill('ada@example.test')
  await password(page).fill('test-passphrase-2026')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Working securely…', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeDisabled()
  await expect(page.getByRole('link', { name: 'Forgot your password?', exact: true })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByRole('link', { name: 'Create account', exact: true })).toHaveAttribute('aria-disabled', 'true')
  const pendingUrl = page.url()
  await page.getByRole('link', { name: 'Create account', exact: true }).evaluate((link) => (link as HTMLAnchorElement).click())
  await expect(page).toHaveURL(pendingUrl)
  await page.getByRole('form', { name: 'Sign in with email' }).evaluate((form) => (form as HTMLFormElement).requestSubmit())
  expect(firebase.requests.filter(({ endpoint }) => endpoint === 'signInWithPassword')).toHaveLength(1)
  await page.getByRole('link', { name: 'Continue as guest', exact: true }).click()
  await expect(page).toHaveURL('/')
  release()
  await expect(accountLink(page)).toContainText('Ada Reyes')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('blocked persistence falls back to an in-memory sign-in without breaking the local workspace', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined })
    Storage.prototype.setItem = () => { throw new DOMException('Site storage blocked', 'SecurityError') }
  })
  await page.goto('/account')
  await expect(page.getByRole('alert')).toContainText('Device storage is unavailable')
  await signIn(page)
  await expect(page.locator('.account-device-save')).toContainText('Not saved')
  await page.reload()
  await expect(email(page)).toBeEnabled()
  await page.locator('.sign-in-device > summary').click()
  await expect(page.locator('.account-device-save')).toContainText('8 cards')
})

test('device backup exports only workspace data, not identity tokens or credentials', async ({ page }, testInfo) => {
  await page.goto('/account')
  await signIn(page)
  const before = await localState(page)
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export device backup', exact: true }).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toMatch(/^kanso-pro-journey-\d{4}-\d{2}-\d{2}\.json$/)
  const file = testInfo.outputPath('workspace-backup.json')
  await download.saveAs(file)
  const json = await readFile(file, 'utf8')
  expect(JSON.parse(json)).toEqual(JSON.parse(before!))
  expect(json).not.toMatch(/test-passphrase|test-only-refresh|idToken|refreshToken|ada@example.test/)
  await expect(feedback(page)).toContainText('backup is ready')
})

test('account layouts keep reachable controls and readable text on phone, tablet, and desktop', async ({ page }) => {
  for (const width of [320, 375, 600, 834, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/account?mode=create')
    await expect(email(page)).toBeEnabled()
    await page.evaluate(() => document.fonts.ready)
    await settle(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    const dimensions = await page.locator('.sign-in-back').evaluate((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))
    expect(dimensions.width).toBeGreaterThanOrEqual(44)
    expect(dimensions.height).toBeGreaterThanOrEqual(44)
    const controls = await page.locator('.account-card button:visible, .account-card input:visible, .account-modes a:visible, .sign-in-guest > a').evaluateAll((elements) => elements.map((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })))
    for (const target of controls) { expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44) }
    await page.getByRole('link', { name: 'Continue as guest', exact: true }).scrollIntoViewIfNeeded()
    const bottom = await page.getByRole('link', { name: 'Continue as guest', exact: true }).evaluate((element) => element.getBoundingClientRect().bottom)
    await expect(navigation(page)).toHaveCount(0)
    expect(bottom).toBeLessThanOrEqual(1000)
  }
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/account')
  await expect(email(page)).toBeEnabled()
  await audit(page)
  await page.getByRole('link', { name: 'Create account', exact: true }).click()
  await audit(page)
  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  await signIn(page)
  await audit(page)
  // Long literal account data must not stretch the header or phone profile card.
  await page.getByRole('textbox', { name: 'Display name', exact: true }).fill('A'.repeat(80))
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(feedback(page)).toContainText('display name has been saved')
  await settle(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375)
})

test('direct account URLs preserve the skip link and reject unsupported subpages safely', async ({ page }) => {
  await page.goto('/sign-in?mode=unknown')
  await expect(email(page)).toBeEnabled()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to page content', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page.getByRole('form', { name: 'Sign in with email' })).toBeVisible()
  await page.goto('/account/not-a-page')
  await expect(page.getByRole('heading', { name: 'This page isn’t here.', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Page not found · Kanso Pro')
})
