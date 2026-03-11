import { defineStore } from 'pinia'
import { ref, readonly } from 'vue'
import type { GoogleDriveConfig } from '../types'
import {
  initDrive, requestSignIn, driveSignOut,
  driveLoad, driveSave,
  isDriveConfigured, hasValidToken,
} from '../utils/gdrive'
import { useTaskStore } from './taskStore'
import { isoNow } from '../utils/helpers'

const LS_KEY = 'tf_gdrive_config'

type Status = 'idle' | 'initialising' | 'connecting' | 'syncing' | 'error' | 'connected'

function loadPersistedConfig(): GoogleDriveConfig | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export const useDriveStore = defineStore('drive', () => {
  const _persisted = loadPersistedConfig()

  const config = ref<GoogleDriveConfig>({
    fileId:    _persisted?.fileId    ?? null,
    connected: false,  // revalidated in init()
    syncing:   false,
    lastSync:  _persisted?.lastSync  ?? null,
  })

  const status  = ref<Status>('idle')
  const error   = ref<string | null>(null)
  const configured = ref(isDriveConfigured())
  let _lastSyncedModified: string | null = null

  function _saveConfig() {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...config.value, syncing: false }))
  }

  // ── Called once on app start ─────────────────────────────────────────────
  async function init(): Promise<void> {
    if (!isDriveConfigured() && !_persisted) return
    status.value = 'initialising'
    try {
      await initDrive()
      configured.value = true

      if (_persisted?.connected) {
        if (hasValidToken()) {
          // Token still valid — restore connected state silently
          config.value.connected = true
          config.value.fileId    = _persisted.fileId
          config.value.lastSync  = _persisted.lastSync
          status.value = 'connected'
        } else {
          // Token expired — user must reconnect explicitly
          config.value.connected = false
          error.value = 'Session expired — please reconnect'
          status.value = 'error'
        }
      } else {
        status.value = 'idle'
      }
    } catch (e: any) {
      status.value = 'error'
      error.value  = e.message
    }
  }

  // ── Explicit connect (user clicks "Sign in with Google") ─────────────────
  async function connect(customClientId?: string): Promise<void> {
    error.value  = null
    status.value = 'connecting'
    try {
      await initDrive(customClientId)
      configured.value = true
      await requestSignIn()

      // Load remote state after sign-in
      config.value.syncing = true
      const result = await driveLoad(config.value.fileId)
      if (result) {
        config.value.fileId = result.fileId
        useTaskStore().loadState(result.state)
      }
      config.value.connected = true
      config.value.lastSync  = isoNow()
      _lastSyncedModified = useTaskStore().state.lastModified
      status.value = 'connected'
      _saveConfig()
    } catch (e: any) {
      status.value = 'error'
      error.value  = e.message === 'popup_closed_by_user'
        ? 'Sign-in cancelled'
        : e.message
    } finally {
      config.value.syncing = false
    }
  }

  // ── Auto-sync — NEVER prompts the user ───────────────────────────────────
  async function sync(): Promise<void> {
    if (!config.value.connected || config.value.syncing) return
    const tasks = useTaskStore()
    // Skip if data hasn't changed since last sync
    if (_lastSyncedModified && tasks.state.lastModified === _lastSyncedModified) return
    error.value          = null
    config.value.syncing = true
    try {
      const fileId = await driveSave(tasks.state, config.value.fileId)
      config.value.fileId   = fileId
      config.value.lastSync = isoNow()
      _lastSyncedModified   = tasks.state.lastModified
      status.value = 'connected'
      _saveConfig()
    } catch (e: any) {
      if (e.message === 'NO_VALID_TOKEN') {
        config.value.connected = false
        status.value = 'error'
        error.value  = 'Session expired — please reconnect'
      } else {
        status.value = 'error'
        error.value  = `Sync failed: ${e.message}`
      }
    } finally {
      config.value.syncing = false
    }
  }

  function disconnect(): void {
    driveSignOut()
    config.value = { fileId: null, connected: false, syncing: false, lastSync: null }
    status.value = 'idle'
    error.value  = null
    localStorage.removeItem(LS_KEY)
  }

  function clearError(): void {
    error.value = null
    if (status.value === 'error') status.value = config.value.connected ? 'connected' : 'idle'
  }

  return {
    config: readonly(config),
    status: readonly(status),
    error:  readonly(error),
    configured: readonly(configured),
    init, connect, sync, disconnect, clearError,
  }
})
