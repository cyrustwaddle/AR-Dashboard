// Spotify PKCE Authorization Code flow.
// Register these redirect URIs in the Spotify Developer Dashboard:
//   - https://cyrus-manning-twaddle-ar-dashboard-one.vercel.app/callback
//   - http://localhost:5173/callback

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string
const SCOPES = 'playlist-read-private playlist-read-collaborative'

const STATE_KEY = 'spotify_pkce_state'
const VERIFIER_KEY = 'spotify_pkce_verifier'

let accessToken: string | null = null
let refreshToken: string | null = null
let expiresAt = 0

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

function base64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function pkceChallenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(hash)
}

export async function initiateAuth(): Promise<void> {
  const verifier = randomHex(32)
  const state = randomHex(16)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)
  const challenge = await pkceChallenge(verifier)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

export async function handleCallback(code: string, returnedState: string): Promise<void> {
  const expectedState = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  if (returnedState !== expectedState) throw new Error('OAuth state mismatch — possible CSRF')
  if (!verifier) throw new Error('PKCE verifier missing from session')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`)
  const json = await res.json() as { access_token: string; refresh_token: string; expires_in: number }
  accessToken = json.access_token
  refreshToken = json.refresh_token
  expiresAt = Date.now() + (json.expires_in - 60) * 1000
}

async function doRefresh(): Promise<void> {
  if (!refreshToken) throw new Error('No refresh token available')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed (${res.status})`)
  const json = await res.json() as { access_token: string; refresh_token?: string; expires_in: number }
  accessToken = json.access_token
  if (json.refresh_token) refreshToken = json.refresh_token
  expiresAt = Date.now() + (json.expires_in - 60) * 1000
}

export async function getValidToken(): Promise<string> {
  if (accessToken && Date.now() < expiresAt) return accessToken
  if (refreshToken) { await doRefresh(); return accessToken! }
  throw new Error('Not authenticated — connect Spotify first')
}

export function isAuthenticated(): boolean {
  return accessToken !== null
}

// For testing token refresh: sets expiry to the past to force a refresh on next getValidToken() call.
export function _testExpireToken(): void {
  expiresAt = 0
}
