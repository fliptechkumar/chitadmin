import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'

import type { SessionUser } from './types'

/**
 * HTTP client for the admin server's v1 API.
 *
 * The access token lives 15 minutes and the refresh token 30 days. When a call
 * comes back TOKEN_EXPIRED the client swaps the refresh token for a new pair
 * once and retries; if that fails the session is over and the app returns to
 * the login screen.
 */

/** Set EXPO_PUBLIC_API_URL to point a development build at a local server. */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  'https://michits.in'
).replace(/\/+$/, '')

const SESSION_KEY = 'session'

export type Session = { accessToken: string; refreshToken: string; user: SessionUser }

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly fields: Record<string, string> = {},
  ) {
    super(message)
  }
}

let session: Session | null = null
let onSignedOut: (() => void) | null = null
let refreshing: Promise<boolean> | null = null

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY)
    session = raw ? (JSON.parse(raw) as Session) : null
  } catch {
    session = null
  }
  return session
}

async function saveSession(next: Session | null) {
  session = next
  if (next) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next))
  else await SecureStore.deleteItemAsync(SESSION_KEY)
}

/** Called once by the auth provider so an expired session can sign out. */
export function setSignedOutHandler(fn: () => void) {
  onSignedOut = fn
}

async function raw(path: string, init: RequestInit, token?: string) {
  let res: Response
  const url = `${API_URL}${path}`
  // console.log("url", url)
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError('No connection to the server. Check your internet and try again.', 'NETWORK', 0)
  }
  const body = (await res.json().catch(() => null)) as
    | { data?: unknown; error?: { code: string; message: string; fields?: Record<string, string> } }
    | null
  if (!res.ok || body?.error) {
    const e = body?.error
    throw new ApiError(
      e?.message ?? `Server error (${res.status}).`,
      e?.code ?? 'INTERNAL',
      res.status,
      e?.fields ?? {},
    )
  }
  return body?.data
}

async function refresh(): Promise<boolean> {
  if (!session) return false
  refreshing ??= (async () => {
    try {
      const pair = (await raw('/api/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: session!.refreshToken }),
      })) as { accessToken: string; refreshToken: string }
      await saveSession({ ...session!, ...pair })
      return true
    } catch (e) {
      // Only a definite "no" ends the session; a dropped connection does not.
      if (e instanceof ApiError && e.status !== 0) return false
      throw e
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

async function expire() {
  await saveSession(null)
  onSignedOut?.()
}

/** An authenticated call. Throws ApiError. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  // A reload re-runs this module and empties `session` while the app still
  // shows the signed-in screens. Read it back from storage rather than
  // treating that as a sign-out (which used to delete the stored session).
  if (!session) await loadSession()
  if (!session) {
    onSignedOut?.()
    throw new ApiError('Please sign in again.', 'UNAUTHENTICATED', 401)
  }
  try {
    return (await raw(path, init, session.accessToken)) as T
  } catch (e) {
    if (!(e instanceof ApiError) || e.code !== 'TOKEN_EXPIRED') {
      if (e instanceof ApiError && e.code === 'UNAUTHENTICATED') await expire()
      throw e
    }
  }
  if (!(await refresh())) {
    await expire()
    throw new ApiError('Your session has ended. Please sign in again.', 'UNAUTHENTICATED', 401)
  }
  return (await raw(path, init, session!.accessToken)) as T
}

export async function signIn(username: string, password: string): Promise<SessionUser> {
  const data = (await raw('/api/v1/auth/token', {
    method: 'POST',
    body: JSON.stringify({ username, password, app: 'route' }),
  })) as { accessToken: string; refreshToken: string; user: SessionUser }
  const user: SessionUser = {
    id: data.user.id,
    username: data.user.username,
    name: data.user.name,
    route: data.user.route,
  }
  await saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user })
  return user
}

export async function signOut() {
  const token = session?.refreshToken
  await saveSession(null)
  // Best effort: the server forgets this device's session.
  if (token) {
    raw('/api/v1/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: token }) }).catch(
      () => {},
    )
  }
}
