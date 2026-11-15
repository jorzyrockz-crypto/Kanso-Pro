import { useCallback, useEffect, useRef, useState } from 'react'
import { AccountInputError, accountError } from './account'
import type { AccountAction, AccountUser } from './account'

type Client = typeof import('./firebase')
interface AccountSession {
  phase: 'loading' | 'ready' | 'error'
  user: AccountUser | null
  initializationError: string
}

/** One SDK subscription for the header and the account page; guests can always keep planning. */
export function useAccount() {
  const [session, setSession] = useState<AccountSession>({ phase: 'loading', user: null, initializationError: '' })
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState<AccountAction | null>(null)
  const busyRef = useRef(false)

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    setSession((current) => ({ ...current, phase: 'loading', initializationError: '' }))
    import('./firebase').then((client) => {
      if (!active) return
      unsubscribe = client.observeAccount((user) => {
        if (active) setSession({ phase: 'ready', user, initializationError: '' })
      }, (error) => {
        if (active) setSession({ phase: 'error', user: null, initializationError: accountError(error) })
      })
    }).catch((error: unknown) => {
      if (active) setSession({ phase: 'error', user: null, initializationError: accountError(error) })
    })
    return () => { active = false; unsubscribe?.() }
  }, [attempt])

  const run = useCallback(async (action: AccountAction, operation: (client: Client) => Promise<unknown>) => {
    if (busyRef.current) throw new AccountInputError('account/busy')
    busyRef.current = true
    setBusy(action)
    let client: Client | undefined
    try {
      client = await import('./firebase')
      await operation(client)
    } finally {
      // updateProfile/reload need a fresh snapshot even when the user id did not change.
      // Also expose a newly created account when only its subsequent name save failed.
      if (client) setSession({ phase: 'ready', user: client.currentAccount(), initializationError: '' })
      busyRef.current = false
      setBusy(null)
    }
  }, [])

  return {
    ...session, busy,
    retry: () => setAttempt((current) => current + 1),
    signIn: (email: string, password: string) => run('sign-in', (client) => client.signInAccount(email, password)),
    create: (name: string, email: string, password: string) => run('create', (client) => client.createAccount(name, email, password)),
    google: () => run('google', (client) => client.googleSignIn()),
    signOut: () => run('sign-out', (client) => client.signOutAccount()),
    saveName: (name: string) => run('save-name', (client) => client.saveAccountName(name)),
    resetPassword: (email: string) => run('reset', (client) => client.requestPasswordReset(email)),
    sendVerification: () => run('verify', (client) => client.requestVerification()),
    refresh: () => run('refresh', (client) => client.refreshAccount()),
  }
}

export type AccountController = ReturnType<typeof useAccount>
