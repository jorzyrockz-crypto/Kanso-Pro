import type { BrowserContext } from '@playwright/test'

export interface FirebaseHarness {
  profile: { uid: string; email: string; displayName: string | null; photoURL: string | null; verified: boolean }
  requests: { endpoint: string; body: Record<string, unknown> }[]
  failures: Record<string, string | undefined>
  unexpectedRequests: string[]
  signInGate?: Promise<void>
}

/**
 * Exercise the real Firebase web SDK against deterministic REST responses. All external
 * requests are intercepted: these tests cannot create accounts, send emails, or write to
 * the user's Firebase project. There is no emulator or mock switch in production code.
 */
export async function mockFirebase(context: BrowserContext): Promise<FirebaseHarness> {
  const mock: FirebaseHarness = {
    profile: { uid: 'test-only-ada', email: 'ada@example.test', displayName: 'Ada Reyes', photoURL: 'https://profiles.example.test/ada-avatar.svg', verified: false },
    requests: [], failures: {}, unexpectedRequests: [],
  }
  const tokens = () => {
    const now = Math.floor(Date.now() / 1000)
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const idToken = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
      iss: 'https://securetoken.google.com/russapps-kanso-pro', aud: 'russapps-kanso-pro',
      auth_time: now, user_id: mock.profile.uid, sub: mock.profile.uid, iat: now, exp: now + 3600,
      email: mock.profile.email, email_verified: mock.profile.verified,
      firebase: { identities: { email: [mock.profile.email] }, sign_in_provider: 'password' },
    })}.test-only-not-a-real-signature`
    return { idToken, refreshToken: 'test-only-refresh-token', expiresIn: '3600' }
  }
  const profile = () => ({
    localId: mock.profile.uid, email: mock.profile.email, emailVerified: mock.profile.verified,
    displayName: mock.profile.displayName ?? undefined, photoUrl: mock.profile.photoURL ?? undefined,
    providerUserInfo: [{ providerId: 'password', rawId: mock.profile.email, email: mock.profile.email, displayName: mock.profile.displayName ?? undefined, photoUrl: mock.profile.photoURL ?? undefined }],
    createdAt: '1794614400000', lastLoginAt: `${Date.now()}`,
  })

  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue()
    if (url.hostname === 'profiles.example.test') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#7ca8be"/><circle cx="48" cy="36" r="18" fill="#f3cfb7"/><path d="M12 96c3-27 20-36 36-36s33 9 36 36" fill="#315970"/></svg>' })
    if (!['identitytoolkit.googleapis.com', 'securetoken.googleapis.com'].includes(url.hostname)) {
      mock.unexpectedRequests.push(request.url())
      return route.abort('blockedbyclient')
    }
    const endpoint = url.pathname.split('/').at(-1)!.replace(/^accounts:/, '')
    let body: Record<string, unknown> = {}
    if (request.postData()) {
      body = request.headers()['content-type']?.includes('application/x-www-form-urlencoded')
        ? Object.fromEntries(new URLSearchParams(request.postData()!)) : request.postDataJSON()
    }
    mock.requests.push({ endpoint, body })
    if (endpoint === 'signInWithPassword' && mock.signInGate) await mock.signInGate
    const failure = mock.failures[String(body.requestType)] ?? mock.failures[endpoint]
    if (failure === 'offline') return route.abort('internetdisconnected')
    if (failure) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 400, message: failure, errors: [{ message: failure, domain: 'global', reason: 'invalid' }] } }) })
    const reply = (data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    switch (endpoint) {
      case 'signInWithPassword':
        return reply({ kind: 'identitytoolkit#VerifyPasswordResponse', localId: mock.profile.uid, email: mock.profile.email, displayName: mock.profile.displayName, photoUrl: mock.profile.photoURL, registered: true, ...tokens() })
      case 'signUp':
        mock.profile.email = String(body.email)
        mock.profile.displayName = null
        return reply({ kind: 'identitytoolkit#SignupNewUserResponse', localId: mock.profile.uid, email: mock.profile.email, ...tokens() })
      case 'lookup': return reply({ kind: 'identitytoolkit#GetAccountInfoResponse', users: [profile()] })
      case 'update':
        if (typeof body.displayName === 'string') mock.profile.displayName = body.displayName
        return reply({ ...profile(), photoUrl: mock.profile.photoURL, ...tokens() })
      case 'sendOobCode': return reply({ kind: 'identitytoolkit#GetOobConfirmationCodeResponse', email: mock.profile.email })
      case 'token': {
        const token = tokens()
        return reply({ access_token: token.idToken, id_token: token.idToken, refresh_token: token.refreshToken, expires_in: token.expiresIn, token_type: 'Bearer', user_id: mock.profile.uid, project_id: 'russapps-kanso-pro' })
      }
      case 'projects': return reply({ authorizedDomains: ['localhost', '127.0.0.1'] })
      default:
        mock.unexpectedRequests.push(request.url())
        return route.abort('blockedbyclient')
    }
  })
  return mock
}
