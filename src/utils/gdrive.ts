/**
 * Google Drive integration using the Google Identity Services (GIS) implicit flow.
 *
 * Design principles:
 * - Scripts are loaded once on app start via initDrive()
 * - User is prompted to sign in ONLY when they click "Connect" in Settings
 * - Access token is persisted to localStorage with its expiry
 * - sync() NEVER prompts the user — if the token is expired it throws NO_VALID_TOKEN
 * - driveStore catches NO_VALID_TOKEN and marks connected=false with a reconnect prompt
 */

import type { AppState } from '../types'

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
const SCOPES        = 'https://www.googleapis.com/auth/drive.file'
const FILE_NAME     = 'taskflow-data.json'
const MIME          = 'application/json'
const TOKEN_KEY     = 'tf_gdrive_token'

// ── Module state ──────────────────────────────────────────────────────────────
let _gapi: any       = null
let _google: any     = null
let _tokenClient: any = null
let _clientId: string | null = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || null
let _initialized     = false

interface StoredToken { access_token: string; expiry: number }

// ── Token helpers ─────────────────────────────────────────────────────────────

function saveToken(access_token: string, expires_in: number): void {
  const t: StoredToken = { access_token, expiry: Date.now() + (expires_in - 120) * 1000 }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(t))
}

function loadToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const t: StoredToken = JSON.parse(raw)
    if (Date.now() >= t.expiry) { localStorage.removeItem(TOKEN_KEY); return null }
    return t
  } catch { return null }
}

export function hasValidToken(): boolean {
  return loadToken() !== null
}

export function isInitialized(): boolean {
  return _initialized
}

export function isDriveConfigured(): boolean {
  return !!_clientId
}

export function getClientId(): string | null {
  return _clientId
}

// ── Script loading ────────────────────────────────────────────────────────────

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.defer = true
    s.onload  = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

// ── Initialization ────────────────────────────────────────────────────────────
/**
 * initDrive() — call once on app start.
 * Loads scripts, initialises gapi client, creates GIS token client.
 * Restores a previously saved access token so the user stays connected across reloads.
 * Safe to call with no clientId — does nothing if not configured.
 */
export async function initDrive(clientId?: string): Promise<void> {
  if (clientId) _clientId = clientId
  if (!_clientId) return                     // not configured — nothing to do
  if (_initialized) return                   // already done

  await Promise.all([
    loadScript('https://apis.google.com/js/api.js'),
    loadScript('https://accounts.google.com/gsi/client'),
  ])

  _gapi   = (window as any).gapi
  _google = (window as any).google

  // Initialise gapi client with Drive discovery
  await new Promise<void>((resolve, reject) => {
    _gapi.load('client', async () => {
      try {
        await _gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] })
        resolve()
      } catch (e) { reject(e) }
    })
  })

  // Create GIS token client — callback is set per-request in requestSignIn()
  _tokenClient = _google.accounts.oauth2.initTokenClient({
    client_id: _clientId,
    scope: SCOPES,
    callback: '',   // placeholder — overridden in requestSignIn
  })

  // Restore saved token so the user stays logged in after a page reload
  const saved = loadToken()
  if (saved) {
    _gapi.client.setToken({ access_token: saved.access_token })
  }

  _initialized = true
}

// ── Sign in / sign out ────────────────────────────────────────────────────────
/**
 * requestSignIn() — show the Google OAuth popup.
 * ONLY call this in response to an explicit user gesture (button click).
 * Resolves when the token is obtained and stored.
 */
export async function requestSignIn(): Promise<void> {
  if (!_initialized) throw new Error('Drive not initialised — call initDrive() first')

  return new Promise((resolve, reject) => {
    _tokenClient.callback = (resp: any) => {
      if (resp.error) {
        reject(new Error(resp.error_description ?? resp.error))
        return
      }
      _gapi.client.setToken({ access_token: resp.access_token })
      saveToken(resp.access_token, resp.expires_in ?? 3600)
      resolve()
    }
    // Use prompt:'select_account' on first sign-in, '' on re-auth (no flicker)
    const hasToken = hasValidToken()
    _tokenClient.requestAccessToken({ prompt: hasToken ? '' : 'select_account' })
  })
}

export function driveSignOut(): void {
  const stored = loadToken()
  if (stored) {
    try { _google?.accounts?.oauth2?.revoke(stored.access_token) } catch {}
  }
  if (_gapi) _gapi.client.setToken(null)
  localStorage.removeItem(TOKEN_KEY)
}

// ── Drive file operations ─────────────────────────────────────────────────────

function assertToken(): void {
  if (!hasValidToken()) throw new Error('NO_VALID_TOKEN')
}

async function findFileId(knownId: string | null): Promise<string | null> {
  if (knownId) {
    try {
      await _gapi.client.drive.files.get({ fileId: knownId, fields: 'id' })
      return knownId
    } catch { /* file may have been deleted — fall through to search */ }
  }
  const res = await _gapi.client.drive.files.list({
    q: `name='${FILE_NAME}' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  })
  return (res.result.files?.[0]?.id as string) ?? null
}

export async function driveLoad(
  knownFileId: string | null
): Promise<{ state: AppState; fileId: string } | null> {
  assertToken()
  const fileId = await findFileId(knownFileId)
  if (!fileId) return null
  const res = await _gapi.client.drive.files.get({ fileId, alt: 'media' })
  return { state: JSON.parse(res.body) as AppState, fileId }
}

export async function driveSave(
  state: AppState,
  knownFileId: string | null
): Promise<string> {
  assertToken()
  const body = JSON.stringify(state)
  let fileId = await findFileId(knownFileId)

  if (fileId) {
    await _gapi.client.request({
      path: `/upload/drive/v3/files/${fileId}`,
      method: 'PATCH',
      params: { uploadType: 'media' },
      headers: { 'Content-Type': MIME },
      body,
    })
  } else {
    const meta = await _gapi.client.drive.files.create({
      resource: { name: FILE_NAME, mimeType: MIME },
      fields: 'id',
    })
    fileId = meta.result.id as string
    if (!fileId) throw new Error('Drive: failed to create file')
    await _gapi.client.request({
      path: `/upload/drive/v3/files/${fileId}`,
      method: 'PATCH',
      params: { uploadType: 'media' },
      headers: { 'Content-Type': MIME },
      body,
    })
  }
  return fileId
}
