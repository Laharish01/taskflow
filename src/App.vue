<template>
  <div class="app-layout">
    <div v-if="sidebarOpen" class="sidebar-backdrop" @click="sidebarOpen = false" />
    <Sidebar :open="sidebarOpen" @close="sidebarOpen = false" />

    <main class="main-content">
      <div class="topbar">
        <button class="icon-btn menu-btn" @click="sidebarOpen = true" aria-label="Menu">
          <LucideIcon name="menu" :size="18" />
        </button>
        <div class="topbar-spacer" />

        <!-- PWA install (Android/Desktop) -->
        <button v-if="installPrompt" class="icon-btn" @click="installPWA" title="Install app" aria-label="Install app">
          <LucideIcon name="download" :size="16" style="color: var(--accent)" />
        </button>

        <!-- Drive sync indicator -->
        <button v-if="driveStore.config.connected" class="icon-btn"
          :class="{ syncing: driveStore.config.syncing }"
          @click="driveStore.sync()"
          :title="driveStore.config.syncing ? 'Syncing…' : 'Sync to Drive'">
          <LucideIcon name="cloud" :size="16" :style="{ color: driveStore.config.syncing ? 'var(--accent)' : undefined }" />
        </button>
        <!-- Drive token expired indicator -->
        <button v-else-if="driveStore.status === 'error'" class="icon-btn" @click="showSettings = true" title="Drive disconnected — click to reconnect">
          <LucideIcon name="cloud-off" :size="16" style="color: var(--danger)" />
        </button>

        <!-- Settings gear -->
        <button class="icon-btn" @click="showSettings = true" aria-label="Settings">
          <LucideIcon name="settings" :size="17" />
        </button>
      </div>
      <TaskListView />
    </main>

    <SettingsModal v-if="showSettings" @close="showSettings = false" />

    <!-- iOS install hint (shown once, 3s after load) -->
    <transition name="hint-fade">
      <div v-if="showIOSHint" class="ios-hint">
        <LucideIcon name="download" :size="14" />
        <span>Tap <strong>Share</strong> then <strong>Add to Home Screen</strong></span>
        <button @click="dismissIOSHint"><LucideIcon name="x" :size="10" /></button>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import Sidebar from './components/Sidebar.vue'
import TaskListView from './components/TaskListView.vue'
import SettingsModal from './components/SettingsModal.vue'
import LucideIcon from './components/LucideIcon.vue'
import { useTaskStore } from './stores/taskStore'
import { debounce } from './utils/helpers'
import { useDriveStore } from './stores/driveStore'
import { restoreScheduledNotifications } from './utils/notifications'

const taskStore  = useTaskStore()
const driveStore = useDriveStore()
const showSettings  = ref(false)
const sidebarOpen   = ref(window.innerWidth >= 769)
const installPrompt = ref<any>(null)
const showIOSHint   = ref(false)

// Collapse expanded task when clicking outside any task-item
function handleDocClick(e: MouseEvent) {
  if (!taskStore.expandedTaskId) return
  const target = e.target as HTMLElement
  if (!target.closest('.task-item')) {
    taskStore.expandedTaskId = null
  }
}
document.addEventListener('click', handleDocClick, true)

onMounted(async () => {
  await taskStore.loadState()
  await driveStore.init()      // restore drive connection silently
  restoreScheduledNotifications(Object.values(taskStore.state.tasks))

  // Android/Chrome PWA install prompt
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    installPrompt.value = e
  })

  // iOS install hint — show once if not already in standalone
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone = (navigator as any).standalone === true
  if (isIOS && !isStandalone && !localStorage.getItem('tf_ios_hint')) {
    setTimeout(() => { showIOSHint.value = true }, 3500)
  }
})

async function installPWA() {
  if (!installPrompt.value) return
  installPrompt.value.prompt()
  const { outcome } = await installPrompt.value.userChoice
  if (outcome === 'accepted') installPrompt.value = null
}

onUnmounted(() => document.removeEventListener('click', handleDocClick, true))

function dismissIOSHint() {
  showIOSHint.value = false
  localStorage.setItem('tf_ios_hint', '1')
}

// Auto-sync debounced — waits 10s of inactivity before syncing to Drive
const debouncedSync = debounce(() => {
  if (driveStore.config.connected && !driveStore.config.syncing) driveStore.sync()
}, 10_000)
watch(() => taskStore.state.lastModified, debouncedSync)
</script>

<style>
:root {
  --bg: #f9f8f6; --surface: #ffffff; --surface2: #f2f1ef;
  --border: #e8e6e1; --border2: #f0ede8;
  --text: #18181b; --text2: #6b6b6b; --text3: #a0a0a0;
  --accent: #3b6cf8; --accent-hover: #2d5ee8; --accent-bg: #eff3ff;
  --danger: #e5383b; --danger-bg: #fff1f1;
  --success: #22a96a; --success-bg: #edfcf2;
  --warn: #d97706; --warn-bg: #fffbeb;
  --radius: 10px; --radius-sm: 6px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow: 0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);
  --shadow-lg: 0 16px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06);
  --font: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'DM Mono', 'Fira Mono', monospace;
}
*, *::before, *::after { box-sizing: border-box; }
html, body, #app { height: 100%; margin: 0; }
body { font-family: var(--font); background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; overscroll-behavior: none; }
input, textarea, select, button { font-family: var(--font); }
a, button { -webkit-tap-highlight-color: transparent; }
</style>

<style scoped>
.app-layout { display: flex; height: 100vh; height: 100dvh; overflow: hidden; }
.sidebar-backdrop { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 49; backdrop-filter: blur(2px); }
.main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; background: var(--surface); }
.topbar { display: flex; align-items: center; gap: 2px; padding: 10px 16px; padding-top: max(10px, env(safe-area-inset-top)); flex-shrink: 0; border-bottom: 1px solid var(--border2); }
.topbar-spacer { flex: 1; }
.icon-btn { width: 36px; height: 36px; border: none; background: none; cursor: pointer; color: var(--text2); border-radius: var(--radius-sm); display: grid; place-items: center; transition: background 0.12s, color 0.12s; flex-shrink: 0; }
.icon-btn:hover { background: var(--surface2); color: var(--text); }
.icon-btn.syncing { animation: spin 1.4s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (min-width: 769px) { .menu-btn { display: none; } .topbar { border-bottom: none; padding: 10px 20px; justify-content: flex-end; } }
@media (max-width: 768px) { .sidebar-backdrop { display: block; } }

.ios-hint { position: fixed; bottom: max(76px, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); background: var(--text); color: white; border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; gap: 8px; font-size: 13px; max-width: calc(100vw - 32px); box-shadow: var(--shadow-lg); z-index: 200; white-space: nowrap; }
.ios-hint button { border: none; background: none; cursor: pointer; color: rgba(255,255,255,0.6); padding: 2px; display: grid; place-items: center; }
.ios-hint button:hover { color: white; }
.hint-fade-enter-active, .hint-fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.hint-fade-enter-from, .hint-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }
</style>
