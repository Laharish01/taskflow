<template>
  <div class="task-view">
    <!-- Desktop header: title + add input + search -->
    <div class="view-header desktop-only">
      <h1>{{ viewTitle }}</h1>
      <div class="header-add-wrap">
        <div class="header-add-check" />
        <input
          ref="desktopInputRef"
          v-model="newTitle"
          placeholder="Add a task…"
          class="header-add-input"
          @keydown.enter="addTask"
          @keydown.escape="newTitle = ''"
        />
        <button v-if="newTitle.trim()" class="header-add-submit" @click="addTask" aria-label="Add task">
          <LucideIcon name="check" :size="13" :stroke-width="2.5" />
        </button>
      </div>
      <div class="search-wrap" :class="{ focused: searchFocused }">
        <LucideIcon name="search" :size="14" class="si" />
        <input
          v-model="store.filter.search"
          placeholder="Search"
          class="search-input"
          @focus="searchFocused = true"
          @blur="searchFocused = false"
        />
        <button v-if="store.filter.search" class="clear-btn" @click="store.filter.search = ''">
          <LucideIcon name="x" :size="12" />
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-bar">
      <button class="tab" :class="{ active: store.filter.view === 'current' }" @click="store.setView('current')">Current</button>
      <button class="tab" :class="{ active: store.filter.view === 'all' }" @click="store.setView('all')">All</button>
      <button v-for="list in store.allLists" :key="list.id"
        class="tab" :class="{ active: store.filter.view === 'list' && store.filter.listId === list.id }"
        @click="store.setView('list', list.id)">
        <span class="tab-dot" :style="{ background: list.color }" />{{ list.name }}
      </button>
    </div>

    <!-- Active tag filter -->
    <div v-if="store.filter.tag" class="filter-bar">
      <span class="active-filter">
        <LucideIcon name="hash" :size="10" />{{ store.filter.tag }}
        <button @click="store.setFilter({ tag: null })"><LucideIcon name="x" :size="8" /></button>
      </span>
    </div>

    <!-- Task list area -->
    <div class="task-list" v-if="!store.loading">

      <!-- "current" and "list" views -->
      <TransitionGroup
        v-if="store.filter.view !== 'all'"
        :key="listKey"
        tag="div"
        name="task-move"
        class="task-list-inner"
      >
        <TaskItem
          v-for="task in store.filteredTasks"
          :key="task.id"
          :task="task"
          @delete="store.deleteTask($event)"
        />
        <div v-if="!store.filteredTasks.length" key="empty" class="empty-state">
          <div class="empty-icon"><LucideIcon name="check-circle" :size="36" :stroke-width="1.2" /></div>
          <p>{{ emptyMessage }}</p>
        </div>
      </TransitionGroup>

      <!-- "all" view — completed tasks grouped by month -->
      <div v-else :key="'all-' + listKey" class="task-list-inner">
        <template v-if="store.allViewData.completedGroups.length">
          <div v-for="group in store.allViewData.completedGroups" :key="group.key">
            <div class="month-group-header">
              <LucideIcon name="check-circle" :size="12" class="mg-icon" />
              {{ group.label }}
              <span class="mg-count">{{ group.tasks.length }}</span>
            </div>
            <TaskItem
              v-for="task in group.tasks"
              :key="task.id"
              :task="task"
              @delete="store.deleteTask($event)"
            />
          </div>
        </template>

        <div v-if="!store.allViewData.completedGroups.length" class="empty-state">
          <div class="empty-icon"><LucideIcon name="layers" :size="36" :stroke-width="1.2" /></div>
          <p>{{ emptyMessage }}</p>
        </div>
      </div>
    </div>
    <div v-else class="loading"><div class="spinner" /></div>



    <!-- Mobile bottom bar: ONE input, mode toggled instantly (no transition = no lag) -->
    <div class="mobile-bar mobile-only">
      <div class="mb-inner">
        <div class="mb-icon" @click="mobileSearchMode ? null : undefined">
          <div v-show="!mobileSearchMode" class="add-check-sm" />
          <LucideIcon v-show="mobileSearchMode" name="search" :size="14" class="si" />
        </div>
        <input
          ref="mobileInputRef"
          :value="mobileSearchMode ? store.filter.search : newTitle"
          @input="handleMobileInput"
          :placeholder="mobileSearchMode ? 'Search tasks…' : 'Add a task…'"
          class="mobile-input"
          @keydown.enter="handleMobileEnter"
          @keydown.escape="handleMobileEscape"
        />
        <button class="mb-action" @click="handleMobileAction" :aria-label="mobileActionLabel">
          <LucideIcon v-if="mobileSearchMode" name="x" :size="14" />
          <LucideIcon v-else-if="newTitle.trim()" name="check" :size="14" class="accent-icon" />
          <LucideIcon v-else name="search" :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useTaskStore } from '../stores/taskStore'
import TaskItem from './TaskItem.vue'
import LucideIcon from './LucideIcon.vue'

const store = useTaskStore()
const newTitle        = ref('')

// Collapse expanded task on click-outside — routes through TaskItem's collapse() for animation
function onDocClick(e: MouseEvent) {
  if (!store.expandedTaskId) return
  const target = e.target as Element
  if (target.closest('.task-item.expanded')) return
  // Signal TaskItem to run its animated collapse
  store.collapseRequest = store.expandedTaskId
}
onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
const searchFocused   = ref(false)
const mobileSearchMode = ref(false)
const mobileInputRef  = ref<HTMLInputElement>()

/** Key that changes when the list/view changes — triggers CSS fade-in on container */
const listKey = computed(() => `${store.filter.view}-${store.filter.listId ?? ''}-${store.filter.tag ?? ''}`)

function addTask() {
  if (!newTitle.value.trim()) return
  store.createTask({ title: newTitle.value.trim() })
  newTitle.value = ''
}

// ── Mobile input handler (single element, two modes) ──────────────────────────
function handleMobileInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (mobileSearchMode.value) store.filter.search = v
  else newTitle.value = v
}

function handleMobileEnter() {
  if (mobileSearchMode.value) return
  addTask()
}

function handleMobileEscape() {
  if (mobileSearchMode.value) {
    mobileSearchMode.value = false
    store.filter.search = ''
  } else {
    newTitle.value = ''
  }
  mobileInputRef.value?.blur()
}

async function handleMobileAction() {
  if (mobileSearchMode.value) {
    // ✕ — exit search
    mobileSearchMode.value = false
    store.filter.search = ''
    await nextTick()
    mobileInputRef.value?.focus()
  } else if (newTitle.value.trim()) {
    // ✓ — confirm add
    addTask()
  } else {
    // 🔍 — enter search mode instantly (no transition = no lag)
    mobileSearchMode.value = true
    await nextTick()
    mobileInputRef.value?.focus()
    mobileInputRef.value?.select()
  }
}

const mobileActionLabel = computed(() => {
  if (mobileSearchMode.value) return 'Close search'
  if (newTitle.value.trim()) return 'Add task'
  return 'Search'
})

const viewTitle = computed(() => {
  if (store.filter.view === 'current') return 'Tasks'
  if (store.filter.view === 'all') return 'All Tasks'
  if (store.filter.view === 'list' && store.filter.listId)
    return store.state.lists[store.filter.listId]?.name ?? 'List'
  return 'Tasks'
})

const emptyMessage = computed(() => {
  if (store.filter.search) return 'No tasks match your search'
  if (store.filter.view === 'current') return 'You\'re all caught up'
  return 'No tasks yet'
})
</script>

<style scoped>
.task-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

.desktop-only { display: flex; }
.mobile-only  { display: none; }
@media (max-width: 768px) {
  .desktop-only { display: none !important; }
  .mobile-only  { display: flex !important; }
}

/* Desktop header */
.view-header {
  align-items: center; justify-content: space-between;
  padding: 16px 24px 10px; flex-shrink: 0; gap: 10px;
}
h1 { font-size: 20px; font-weight: 700; color: var(--text); margin: 0; letter-spacing: -0.4px; white-space: nowrap; }

.search-wrap {
  display: flex; align-items: center;
  background: var(--surface2); border: 1px solid transparent;
  border-radius: 8px; padding: 0 10px; height: 34px;
  transition: border-color 0.15s, background 0.15s, width 0.2s;
  width: 140px;
}
.search-wrap.focused { border-color: var(--accent); background: var(--surface); width: 190px; }
.si { flex-shrink: 0; color: var(--text3); }
.search-input {
  flex: 1; border: none; background: none; outline: none;
  font-size: 13.5px; color: var(--text); padding: 0 7px;
  min-width: 0; font-family: var(--font);
}
.search-input::placeholder { color: var(--text3); }
.clear-btn { border: none; background: none; cursor: pointer; color: var(--text3); display: grid; place-items: center; padding: 2px; }
.clear-btn:hover { color: var(--text); }

/* Tabs */
.tabs-bar { display: flex; padding: 0 20px; border-bottom: 1px solid var(--border2); flex-shrink: 0; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.tabs-bar::-webkit-scrollbar { display: none; }
.tab { padding: 0 14px; height: 38px; border: none; background: none; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--text3); border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap; transition: color 0.12s, border-color 0.12s; display: flex; align-items: center; gap: 5px; font-family: var(--font); }
.tab:hover { color: var(--text2); }
.tab.active { color: var(--text); border-bottom-color: var(--text); }
.tab-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
@media (max-width: 768px) { .tabs-bar { padding: 0 12px; } }

/* Filter pill */
.filter-bar { padding: 6px 20px; flex-shrink: 0; }
.active-filter { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 500; background: var(--accent-bg); color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent); padding: 3px 10px; border-radius: 20px; }
.active-filter button { border: none; background: none; cursor: pointer; color: var(--accent); display: grid; place-items: center; padding: 1px; opacity: 0.6; margin-left: 2px; }
.active-filter button:hover { opacity: 1; }

/* Task list — keyed so CSS animation plays on filter change (no jarring transition-group) */
.task-list { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
.task-list-inner {
  padding: 8px 16px 8px; display: flex; flex-direction: column; gap: 2px;
  animation: listFadeIn 0.14s ease;
}
@keyframes listFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
/* TransitionGroup FLIP — only animates position changes, no enter/leave flicker */
.task-move-move { transition: transform 0.42s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
@media (max-width: 768px) { .task-list-inner { padding: 6px 10px; } }

/* Month group headers (all-tasks view) */
.month-group-header {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600; color: var(--text3);
  text-transform: uppercase; letter-spacing: 0.05em;
  padding: 14px 4px 6px;
}
.mg-icon { opacity: 0.6; }
.mg-count {
  margin-left: auto; font-size: 10px; background: var(--surface2);
  color: var(--text3); padding: 1px 6px; border-radius: 10px;
  font-family: var(--font-mono);
}

/* Empty */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 24px; gap: 12px; }
.empty-icon { color: var(--border); }
.empty-state p { font-size: 14px; color: var(--text3); margin: 0; text-align: center; }

/* Loading */
.loading { flex: 1; display: grid; place-items: center; }
.spinner { width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--border); border-top-color: var(--accent); animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Desktop header add widget */
.header-add-wrap {
  flex: 1; display: flex; align-items: center; gap: 8px;
  background: var(--surface2); border: 1px solid transparent;
  border-radius: 8px; padding: 0 10px; height: 34px;
  transition: border-color 0.15s, background 0.15s;
  min-width: 0; max-width: 300px;
}
.header-add-wrap:focus-within { border-color: var(--accent); background: var(--surface); }
.header-add-check { width: 14px; height: 14px; min-width: 14px; border-radius: 50%; border: 1.5px dashed var(--border); flex-shrink: 0; }
.header-add-input { flex: 1; border: none; background: none; outline: none; font-size: 13.5px; color: var(--text); font-family: var(--font); min-width: 0; }
.header-add-input::placeholder { color: var(--text3); }
.header-add-submit { border: none; background: none; cursor: pointer; color: var(--success); padding: 2px; display: grid; place-items: center; flex-shrink: 0; }
.header-add-submit:hover { color: var(--success); }

/* Mobile bottom bar */
.mobile-bar {
  display: block !important;
  width: 100%;
  flex-shrink: 0;
  border-top: 1px solid var(--border2);
  background: var(--surface);
  padding: 0 16px;
  padding-bottom: max(10px, env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.mb-inner {
  display: flex; align-items: center; gap: 10px;
  min-height: 50px; width: 100%;
}
.mb-icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 22px; }
.add-check-sm { width: 18px; height: 18px; border-radius: 50%; border: 1.5px dashed var(--border); }
.mobile-input {
  flex: 1; border: none; background: none; outline: none;
  font-size: 16px; color: var(--text); font-family: var(--font);
  min-width: 0; padding: 0;
  /* iOS fix: prevent zoom on focus */
  -webkit-text-size-adjust: none;
}
.mobile-input::placeholder { color: var(--text3); }
.mb-action {
  border: none; background: none; cursor: pointer; color: var(--text3);
  width: 36px; height: 36px; border-radius: 8px;
  display: grid; place-items: center; flex-shrink: 0;
  transition: background 0.1s, color 0.1s;
  touch-action: manipulation;
}
.mb-action:hover { background: var(--surface2); color: var(--text2); }
.accent-icon { color: var(--success); }
</style>
