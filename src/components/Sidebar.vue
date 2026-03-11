<template>
  <aside class="sidebar" :class="{ open }">
    <div class="sidebar-inner">
      <div class="brand">
        <div class="logo">
          <LucideIcon name="check" :size="14" :stroke-width="2.5" style="color:white" />
        </div>
        <span class="brand-name">TaskFlow</span>
        <button class="icon-btn close-btn" @click="$emit('close')" aria-label="Close">
          <LucideIcon name="x" :size="14" />
        </button>
      </div>

      <nav class="nav-section">
        <button class="nav-item" :class="{ active: isActive('current') }" @click="navigate('current')">
          <LucideIcon name="list-checks" :size="15" />
          <span>Current</span>
          <span v-if="currentCount" class="badge">{{ currentCount }}</span>
        </button>
        <button class="nav-item" :class="{ active: isActive('all') }" @click="navigate('all')">
          <LucideIcon name="layers" :size="15" />
          <span>All Tasks</span>
        </button>
      </nav>

      <div class="section-divider" />

      <div class="section-label">
        <span>Lists</span>
        <button class="icon-btn add-btn" @click="showNewList = true" aria-label="New list">
          <LucideIcon name="plus" :size="12" />
        </button>
      </div>

      <nav class="nav-section">
        <button v-for="list in store.allLists" :key="list.id"
          class="nav-item" :class="{ active: isListActive(list.id) }"
          @click="navigateList(list.id)">
          <span class="list-dot" :style="{ background: list.color }" />
          <span>{{ list.name }}</span>
          <span v-if="listCount(list.id)" class="badge">{{ listCount(list.id) }}</span>
        </button>
      </nav>

      <template v-if="store.allTags.length">
        <div class="section-divider" />
        <div class="section-label"><span>Tags</span></div>
        <div class="tags-wrap">
          <button v-for="tag in store.allTags" :key="tag"
            class="tag-chip" :class="{ active: store.filter.tag === tag }"
            @click="toggleTag(tag)">
            <LucideIcon name="hash" :size="10" />{{ tag }}
          </button>
        </div>
      </template>
    </div>

    <NewListModal v-if="showNewList" @close="showNewList = false" />
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore } from '../stores/taskStore'
import type { FilterState } from '../types'
import NewListModal from './NewListModal.vue'
import LucideIcon from './LucideIcon.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useTaskStore()
const showNewList = ref(false)
const currentCount = computed(() => store.allTasks.filter(t => !t.completed && !t.parentId).length)

const isMobile = () => window.innerWidth < 769
function isActive(v: string) { return store.filter.view === v && store.filter.view !== 'list' }
function isListActive(id: string) { return store.filter.view === 'list' && store.filter.listId === id }
function listCount(id: string) { return store.allTasks.filter(t => t.listId === id && !t.completed && !t.parentId).length }
function navigate(view: FilterState['view']) { store.setView(view); if (isMobile()) emit('close') }
function navigateList(id: string) { store.setView('list', id); if (isMobile()) emit('close') }
function toggleTag(tag: string) { store.setFilter({ tag: store.filter.tag === tag ? null : tag }); if (isMobile()) emit('close') }
</script>

<style scoped>
.sidebar { width: 220px; min-width: 220px; height: 100vh; height: 100dvh; background: var(--bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; overflow-y: auto; overflow-x: hidden; }
@media (max-width: 768px) {
  .sidebar { position: fixed; top: 0; left: 0; z-index: 50; transform: translateX(-100%); transition: transform 0.22s cubic-bezier(0.4,0,0.2,1); box-shadow: var(--shadow-lg); }
  .sidebar.open { transform: translateX(0); }
}
@media (min-width: 769px) { .close-btn { display: none !important; } }

.sidebar-inner { padding: 16px 10px; padding-top: max(16px, env(safe-area-inset-top)); display: flex; flex-direction: column; gap: 2px; flex: 1; }

.brand { display: flex; align-items: center; gap: 9px; padding: 4px 8px 16px; }
.logo { width: 26px; height: 26px; background: var(--text); border-radius: 7px; display: grid; place-items: center; flex-shrink: 0; }
.brand-name { font-size: 14px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; flex: 1; }

.icon-btn { border: none; background: none; cursor: pointer; color: var(--text3); border-radius: 6px; display: grid; place-items: center; transition: background 0.1s, color 0.1s; }
.close-btn { padding: 6px; min-width: 32px; min-height: 32px; }
.close-btn:hover { background: var(--surface2); color: var(--text); }
.add-btn { padding: 4px; min-width: 24px; min-height: 24px; }
.add-btn:hover { background: var(--surface2); color: var(--text); }

.nav-section { display: flex; flex-direction: column; gap: 1px; }
.nav-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; border: none; background: none; cursor: pointer; font-size: 13.5px; color: var(--text2); width: 100%; text-align: left; transition: background 0.1s, color 0.1s; min-height: 36px; font-family: var(--font); }
.nav-item:hover { background: var(--border2); color: var(--text); }
.nav-item.active { background: var(--surface); color: var(--text); font-weight: 500; box-shadow: var(--shadow-sm); }
.nav-item svg { flex-shrink: 0; opacity: 0.6; }
.nav-item.active svg { opacity: 1; }

.badge { margin-left: auto; font-size: 11px; font-weight: 500; color: var(--text3); background: var(--surface2); padding: 1px 7px; border-radius: 20px; font-family: var(--font-mono); }
.nav-item.active .badge { background: var(--border); color: var(--text2); }
.list-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-left: 1px; }

.section-divider { height: 1px; background: var(--border2); margin: 8px 2px; }
.section-label { display: flex; align-items: center; justify-content: space-between; padding: 4px 10px 2px; font-size: 11px; font-weight: 600; color: var(--text3); letter-spacing: 0.05em; text-transform: uppercase; }

.tags-wrap { display: flex; flex-wrap: wrap; gap: 5px; padding: 4px 8px 8px; }
.tag-chip { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; padding: 4px 9px; border-radius: 20px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; color: var(--text2); transition: all 0.1s; min-height: 28px; font-family: var(--font); }
.tag-chip:hover { border-color: var(--accent); color: var(--accent); }
.tag-chip.active { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); font-weight: 500; }
</style>
