<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Settings</span>
        <button class="icon-btn" @click="$emit('close')">
          <LucideIcon name="x" :size="14" />
        </button>
      </div>

      <!-- Google Drive -->
      <section>
        <div class="section-title">
          <LucideIcon name="cloud" :size="14" />
          Google Drive Sync
        </div>
        <p class="section-hint">
          Syncs your tasks to a private file in your Google Drive.
          Only accesses files created by this app (<code>drive.file</code> scope).
        </p>

        <!-- Connected state -->
        <template v-if="drive.config.connected">
          <div class="status-card success">
            <LucideIcon name="check-circle" :size="14" />
            <div>
              <div class="status-title">Connected to Google Drive</div>
              <div v-if="drive.config.lastSync" class="status-sub">Last synced {{ formatRelative(drive.config.lastSync) }}</div>
            </div>
          </div>
          <div class="btn-row mt8">
            <button class="sec-btn" :disabled="drive.config.syncing" @click="drive.sync()">
              <LucideIcon name="refresh-cw" :size="12" :class="{ spin: drive.config.syncing }" />
              {{ drive.config.syncing ? 'Syncing…' : 'Sync now' }}
            </button>
            <button class="danger-btn" @click="drive.disconnect()">
              <LucideIcon name="log-out" :size="12" />
              Disconnect
            </button>
          </div>
        </template>

        <!-- Token expired / error with reconnect -->
        <template v-else-if="drive.status === 'error' && hadConfig">
          <div class="status-card warn">
            <LucideIcon name="alert-circle" :size="14" />
            <div>
              <div class="status-title">{{ drive.error }}</div>
              <div class="status-sub">Click below to sign in again</div>
            </div>
          </div>
          <div class="btn-row mt8">
            <button class="google-btn" :disabled="drive.config.syncing" @click="doConnect()">
              <GoogleIcon />
              {{ drive.config.syncing ? 'Connecting…' : 'Reconnect with Google' }}
            </button>
            <button class="text-btn" @click="drive.disconnect()">Disconnect</button>
          </div>
        </template>

        <!-- Not connected -->
        <template v-else>
          <!-- Env-var client ID present: one-click sign in -->
          <button v-if="drive.configured" class="google-btn" :disabled="drive.config.syncing" @click="doConnect()">
            <GoogleIcon />
            {{ drive.config.syncing ? 'Connecting…' : 'Sign in with Google' }}
          </button>

          <!-- Custom client ID toggle -->
          <div class="advanced-wrap">
            <button class="text-btn" @click="showClientId = !showClientId">
              <LucideIcon :name="showClientId ? 'chevron-down' : 'chevron-right'" :size="12" />
              {{ drive.configured ? 'Use a different Client ID' : 'Connect with your own Client ID' }}
            </button>
          </div>

          <div v-if="showClientId" class="client-id-block">
            <p class="sub-hint">
              Create an OAuth 2.0 Web Application credential at
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud Console</a>,
              enable the <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener">Drive API</a>,
              and add this page's origin to <em>Authorised JavaScript origins</em>.
            </p>
            <input v-model="clientId" placeholder="xxxxxxxx.apps.googleusercontent.com" class="field-input" />
            <button class="primary-btn" :disabled="!clientId.trim() || drive.config.syncing" @click="doConnect(clientId)">
              {{ drive.config.syncing ? 'Connecting…' : 'Connect' }}
            </button>
          </div>
        </template>

        <!-- Error message (non-session errors) -->
        <div v-if="drive.error && drive.status === 'error' && !hadConfig" class="error-msg">
          <LucideIcon name="alert-circle" :size="12" />
          {{ drive.error }}
          <button class="text-btn-sm" @click="drive.clearError()">Dismiss</button>
        </div>
      </section>

      <div class="divider" />

      <!-- Data -->
      <section>
        <div class="section-title">
          <LucideIcon name="download" :size="14" />
          Data
        </div>
        <div class="btn-row">
          <button class="sec-btn" @click="onExport">
            <LucideIcon name="upload" :size="12" /> Export JSON
          </button>
          <button class="sec-btn" @click="onImport">
            <LucideIcon name="download" :size="12" /> Import JSON
          </button>
        </div>
        <p class="section-hint mt6">Import replaces all data. Export creates a full backup.</p>
      </section>

      <div class="divider" />

      <section>
        <div class="section-title">
          <LucideIcon name="alert-circle" :size="14" />
          Danger Zone
        </div>
        <button class="danger-btn" @click="clearAll">
          <LucideIcon name="trash-2" :size="12" /> Clear all data
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDriveStore } from '../stores/driveStore'
import { useTaskStore } from '../stores/taskStore'
import { exportJSON, importJSON } from '../utils/storage'
import LucideIcon from './LucideIcon.vue'

// Inline Google G icon (not a Lucide icon)
const GoogleIcon = {
  template: `<svg width="16" height="16" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>`
}

defineEmits<{ close: [] }>()

const drive  = useDriveStore()
const tasks  = useTaskStore()
const showClientId = ref(false)
const clientId     = ref('')

// True if we previously had a connected config (for reconnect UX)
const hadConfig = computed(() => !!localStorage.getItem('tf_gdrive_config'))

async function doConnect(id?: string) {
  await drive.connect(id || undefined)
}

async function onExport() { await exportJSON(tasks.state) }
async function onImport() {
  try {
    const state = await importJSON()
    await tasks.loadState(state)
    tasks.markDirty()
  } catch (e: any) { alert('Import failed: ' + e.message) }
}
function clearAll() {
  if (!confirm('Delete ALL tasks and lists?')) return
  tasks.state.tasks = {}
  tasks.state.lists = { inbox: { id: 'inbox', name: 'Inbox', color: '#4f7ef7', icon: '📥', order: 0, showCompleted: false } }
  tasks.state.tags  = []
  tasks.markDirty()
}
function formatRelative(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  const h = Math.round(diff / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString()
}
</script>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.25); display: grid; place-items: center; z-index: 100; padding: 20px; backdrop-filter: blur(4px); }
.modal { background: var(--surface); border-radius: 14px; width: 100%; max-width: 400px; max-height: 90dvh; overflow-y: auto; box-shadow: var(--shadow-lg); -webkit-overflow-scrolling: touch; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px 0; }
.modal-title { font-size: 16px; font-weight: 700; color: var(--text); }
.icon-btn { border: none; background: none; cursor: pointer; color: var(--text3); padding: 6px; border-radius: 6px; display: grid; place-items: center; min-width: 32px; min-height: 32px; transition: background 0.1s, color 0.1s; }
.icon-btn:hover { background: var(--surface2); color: var(--text); }

section { padding: 18px 24px; }
.section-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
.section-hint { font-size: 12.5px; color: var(--text2); margin: 0 0 12px; line-height: 1.5; }
.section-hint code { font-family: var(--font-mono); font-size: 11px; background: var(--surface2); padding: 1px 4px; border-radius: 3px; }
.divider { height: 1px; background: var(--border2); margin: 0 16px; }
.mt8 { margin-top: 8px; }
.mt6 { margin-top: 6px; }

/* Status cards */
.status-card { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 9px; border: 1px solid; }
.status-card.success { background: var(--success-bg); border-color: color-mix(in srgb, var(--success) 25%, transparent); color: var(--success); }
.status-card.warn    { background: var(--warn-bg); border-color: color-mix(in srgb, var(--warn) 30%, transparent); color: var(--warn); }
.status-title { font-size: 13.5px; font-weight: 500; }
.status-sub   { font-size: 12px; opacity: 0.7; margin-top: 2px; }

/* Google sign-in button */
.google-btn { display: flex; align-items: center; gap: 10px; width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 9px; padding: 10px 16px; font-size: 14px; font-weight: 500; color: var(--text); cursor: pointer; min-height: 44px; transition: background 0.12s, box-shadow 0.12s; font-family: var(--font); }
.google-btn:hover { background: var(--bg); box-shadow: var(--shadow-sm); }
.google-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.advanced-wrap { margin-top: 10px; }
.text-btn { border: none; background: none; cursor: pointer; font-size: 12.5px; color: var(--text3); padding: 2px 0; font-family: var(--font); display: inline-flex; align-items: center; gap: 4px; transition: color 0.1s; }
.text-btn:hover { color: var(--text); }
.text-btn-sm { border: none; background: none; cursor: pointer; font-size: 11px; color: var(--accent); padding: 0 4px; font-family: var(--font); }

.client-id-block { margin-top: 10px; padding: 14px; background: var(--bg); border-radius: 9px; border: 1px solid var(--border2); display: flex; flex-direction: column; gap: 8px; }
.sub-hint { font-size: 12px; color: var(--text2); margin: 0; line-height: 1.55; }
.sub-hint a { color: var(--accent); text-decoration: none; }
.sub-hint a:hover { text-decoration: underline; }
.sub-hint em { font-style: normal; font-weight: 500; }
.field-input { width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 9px 12px; font-size: max(16px, 13px); outline: none; background: var(--surface); color: var(--text); font-family: var(--font); min-height: 40px; }
.field-input:focus { border-color: var(--accent); }
.primary-btn { background: var(--accent); color: white; border: none; border-radius: 8px; padding: 9px 16px; font-size: 13.5px; cursor: pointer; font-weight: 500; width: 100%; min-height: 40px; font-family: var(--font); transition: background 0.1s; }
.primary-btn:hover { background: var(--accent-hover); }
.primary-btn:disabled { background: var(--border); color: var(--text3); cursor: not-allowed; }

.btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
.sec-btn { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--border); background: var(--surface); border-radius: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer; color: var(--text2); transition: all 0.1s; min-height: 36px; font-family: var(--font); }
.sec-btn:hover { border-color: var(--text3); color: var(--text); background: var(--bg); }
.sec-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.danger-btn { display: inline-flex; align-items: center; gap: 5px; border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent); background: var(--surface); border-radius: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer; color: var(--danger); transition: all 0.1s; min-height: 36px; font-family: var(--font); }
.danger-btn:hover { background: var(--danger-bg); }

.error-msg { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--danger); margin-top: 8px; }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
