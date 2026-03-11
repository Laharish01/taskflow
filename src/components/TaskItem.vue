<template>
  <div ref="rootRef" class="task-item" :class="{ completed: task.completed, overdue: isOverdueTask, expanded: isExpanded }">
    <div ref="taskRowRef" class="task-row" @click="toggleExpand">
      <!-- Star (left) -->
      <button
        class="icon-btn star-btn" :class="{ starred: task.starred }"
        @click.stop="store.toggleStar(task.id)"
        :aria-label="task.starred ? 'Unstar' : 'Star'"
      >
        <LucideIcon name="star" :size="14" :stroke-width="task.starred ? 0 : 2"
          :style="{ fill: task.starred ? '#f59e0b' : 'none', stroke: task.starred ? '#f59e0b' : 'currentColor' }" />
      </button>

      <!-- Title + meta -->
      <div class="task-body">
        <div v-if="editingTitle" class="title-edit-wrap" @click.stop>
          <input
            ref="titleInputRef"
            v-model="editTitle"
            class="title-input"
            @keydown.enter="saveTitle"
            @keydown.escape="cancelTitle"
            @blur="saveTitle"
          />
        </div>
        <span v-else class="title" :class="{ done: task.completed }" @click.stop="handleTitleClick">{{ task.title }}</span>
        <div class="meta-row" v-if="task.dueDate || task.tags.length || task.recurrence || task.subtaskIds.length">
          <span v-if="task.dueDate" class="pill due" :class="{ overdue: isOverdueTask, today: isDueTodayTask }">
            <LucideIcon name="calendar" :size="9" :stroke-width="1.6" />
            {{ formatDate(task.dueDate) }}{{ task.dueTime ? ' ' + fmtTime(task.dueTime) : '' }}
          </span>
          <span v-for="tag in task.tags" :key="tag" class="pill tag">
            <LucideIcon name="hash" :size="9" :stroke-width="1.6" />{{ tag }}
          </span>
          <span v-if="task.recurrence" class="pill recur">
            <LucideIcon name="repeat" :size="9" :stroke-width="1.6" />
            {{ task.recurrence.interval }}{{ task.recurrence.unit[0] }}
            <template v-if="task.streak"> · 🔥{{ task.streak }}</template>
          </span>
          <span v-if="task.subtaskIds.length" class="pill sub">
            <LucideIcon name="list-checks" :size="9" :stroke-width="1.6" />
            {{ completedSubCount }}/{{ task.subtaskIds.length }}
          </span>
        </div>
      </div>

      <!-- Expand chevron -->
      <button
        class="icon-btn chevron-btn" :class="{ open: isExpanded }"
        @click.stop="toggleExpand"
        :aria-label="isExpanded ? 'Collapse' : 'Expand'"
      >
        <LucideIcon name="chevron-down" :size="14" />
      </button>

      <!-- Complete (right) -->
      <button
        class="check-btn" :class="['prio-' + task.priority, { done: task.completed }]"
        @click.stop="store.completeTask(task.id, !task.completed)"
        :aria-label="task.completed ? 'Mark incomplete' : 'Mark complete'"
      >
        <LucideIcon v-if="task.completed" name="check" :size="9" :stroke-width="2.5" />
      </button>
    </div>

    <transition name="panel">
      <div v-if="isExpanded" ref="panelRef" class="edit-panel">

        <!-- Notes -->
        <textarea v-model="form.notes" class="notes-input" placeholder="Add notes…" rows="2" />

        <!-- Field rows -->
        <div class="field-section">

          <!-- Priority -->
          <div class="field-row">
            <span class="field-label">Priority</span>
            <div class="prio-group">
              <button v-for="p in priorities" :key="p.value"
                class="prio-btn" :class="[p.value, { active: form.priority === p.value }]"
                @click="form.priority = p.value">{{ p.label }}</button>
            </div>
          </div>

          <!-- Due -->
          <div class="field-row">
            <div class="label-with-clear">
              <span class="field-label">Due</span>
              <button v-if="form.dueDate" class="clear-btn" @click="form.dueDate='';form.dueTime=''" title="Clear date">
                <LucideIcon name="x" :size="9" :stroke-width="2.5" />
              </button>
            </div>
            <div class="due-group">
              <input type="date" v-model="form.dueDate" class="field-input date-input" />
              <input v-if="form.dueDate" type="time" v-model="form.dueTime" class="field-input time-input" />
            </div>
          </div>

          <!-- Repeat -->
          <div class="field-row">
            <span class="field-label">Repeat</span>
            <div class="recur-group">
              <select v-model="recurrenceEnabled" class="field-input" @change="toggleRecurrence">
                <option :value="false">Never</option>
                <option :value="true">Every</option>
              </select>
              <template v-if="form.recurrence">
                <input type="number" min="1" max="999" v-model.number="form.recurrence.interval" class="field-input interval-input" />
                <select v-model="form.recurrence.unit" class="field-input">
                  <option value="hour">Hour</option>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </select>
              </template>
            </div>
          </div>

          <!-- List -->
          <div class="field-row">
            <span class="field-label">List</span>
            <select v-model="form.listId" class="field-input">
              <option v-for="list in store.allLists" :key="list.id" :value="list.id">{{ list.name }}</option>
            </select>
          </div>

          <!-- Tags -->
          <div class="field-row tags-row">
            <span class="field-label">Tags</span>
            <div class="tags-wrap">
              <span v-for="tag in form.tags" :key="tag" class="tag-chip">
                #{{ tag }}
                <button @click="removeTag(tag)" class="tag-remove"><LucideIcon name="x" :size="8" /></button>
              </span>
              <input v-model="tagInput" placeholder="Add tag…" class="tag-input"
                @keydown.enter.prevent="addTag" @keydown.188.prevent="addTag" list="tag-sugg" />
              <datalist id="tag-sugg"><option v-for="t in store.allTags" :key="t" :value="t" /></datalist>
            </div>
          </div>

        </div>

        <!-- Subtasks -->
        <div v-if="task.subtaskIds.length || showSubAdd" class="subtasks-block">
          <TaskItem v-for="sub in subtasks" :key="sub.id" :task="sub" @delete="$emit('delete', $event)" />
        </div>

        <!-- Footer -->
        <div class="panel-footer">
          <button class="footer-btn" @click="showSubAdd = !showSubAdd">
            <LucideIcon name="plus" :size="11" /> Subtask
          </button>
          <div v-if="showSubAdd" class="sub-add">
            <input v-model="newSubTitle" placeholder="Subtask name…" class="sub-input"
              @keydown.enter="addSubtask" @keydown.escape="showSubAdd=false;newSubTitle=''" />
            <button class="btn-add-sub" :disabled="!newSubTitle.trim()" @click="addSubtask">Add</button>
          </div>
          <button class="footer-btn danger" @click="$emit('delete', task.id)">
            <LucideIcon name="trash-2" :size="11" /> Delete
          </button>
        </div>

      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import type { Task, Priority, Recurrence } from '../types'
import { useTaskStore } from '../stores/taskStore'
import { formatDate, isOverdue, isDueToday } from '../utils/helpers'

import LucideIcon from './LucideIcon.vue'

const props = defineProps<{ task: Task }>()
defineEmits<{ delete: [id: string] }>()

const store = useTaskStore()

// ── Expand state — shared via store ───────────────────────────────────────────
const isExpanded = computed(() => store.expandedTaskId === props.task.id)
const rootRef    = ref<HTMLElement>()
const panelRef   = ref<HTMLElement>()

function toggleExpand() {
  if (isExpanded.value) {
    collapse()
  } else {
    store.expandedTaskId = props.task.id
    nextTick(() => {
      setTimeout(() => {
        panelRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 80)
    })
  }
}

async function collapse() {
  const recurrenceChanged = JSON.stringify(form.value.recurrence) !== JSON.stringify(props.task.recurrence)

  // Always commit form changes on collapse
  if (isDirty()) save()
  store.expandedTaskId = null

  if (!recurrenceChanged || !rootRef.value) return

  const el = rootRef.value

  // ── PHASE 1: Shrink in place (scale towards centre) ──
  await el.animate([
    { transform: 'scale(1)',    opacity: '1' },
    { transform: 'scale(0.5, 0.15)', opacity: '0.3', offset: 0.6 },
    { transform: 'scale(0.5, 0)',    opacity: '0' },
  ], {
    duration: 320,
    easing: 'cubic-bezier(0.4, 0, 1, 1)',
    fill: 'forwards',
  }).finished

  // Snapshot position BEFORE the DOM reorders
  const firstRect = el.getBoundingClientRect()

  // ── Commit to store — Vue re-renders and resort happens ──
  store.expandedTaskId = null
  save()
  await nextTick()

  // Snapshot position AFTER reorder
  const lastRect = el.getBoundingClientRect()
  const deltaY = firstRect.top - lastRect.top

  // ── PHASE 2 + 3: Move to new position then expand ──
  if (Math.abs(deltaY) < 2) {
    // No reorder happened — just expand back
    el.animate([
      { transform: 'scale(0.5, 0)', opacity: '0' },
      { transform: 'scale(1)',       opacity: '1' },
    ], { duration: 280, easing: 'cubic-bezier(0, 0, 0.2, 1)', fill: 'forwards' })
      .finished.then(() => el.style.removeProperty('animation'))
    return
  }

  // Start at old (shrunken) visual position using FLIP inversion
  // Then animate to natural position while simultaneously expanding
  el.animate([
    { transform: `translateY(${deltaY}px) scale(0.5, 0)`, opacity: '0' },
    { transform: `translateY(${deltaY * 0.4}px) scale(0.75, 0.5)`, opacity: '0.6', offset: 0.4 },
    { transform: 'translateY(0) scale(1)', opacity: '1' },
  ], {
    duration: 480,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',  // spring overshoot
    fill: 'forwards',
  }).finished.then(() => el.style.removeProperty('transform'))
}

onUnmounted(() => {})

// ── Title edit ────────────────────────────────────────────────────────────────
const editingTitle   = ref(false)
const editTitle      = ref('')
const titleInputRef  = ref<HTMLInputElement>()

function handleTitleClick() {
  // Single click = edit title; does NOT expand
  if (!editingTitle.value) startEditTitle()
}

async function startEditTitle() {
  editTitle.value    = props.task.title
  editingTitle.value = true
  await nextTick()
  titleInputRef.value?.focus()
  titleInputRef.value?.select()
}

function saveTitle() {
  const trimmed = editTitle.value.trim()
  if (trimmed && trimmed !== props.task.title) store.updateTask(props.task.id, { title: trimmed })
  editingTitle.value = false
}

function cancelTitle() { editingTitle.value = false }

// ── Form ──────────────────────────────────────────────────────────────────────
const showSubAdd  = ref(false)
const newSubTitle = ref('')
const tagInput    = ref('')

interface Form { notes: string; priority: Priority; dueDate: string; dueTime: string; listId: string; tags: string[]; recurrence?: Recurrence }

const form = ref<Form>(toForm(props.task))
const recurrenceEnabled = ref(!!props.task.recurrence)

function toForm(t: Task): Form {
  return { notes: t.notes, priority: t.priority, dueDate: t.dueDate ?? '', dueTime: t.dueTime ?? '', listId: t.listId, tags: [...t.tags], recurrence: t.recurrence ? { ...t.recurrence } : undefined }
}
watch(() => props.task, t => { form.value = toForm(t); recurrenceEnabled.value = !!t.recurrence }, { deep: false })

// Click-outside requests collapse via store signal → run animated collapse()
watch(() => store.collapseRequest, id => {
  if (id === props.task.id) {
    store.collapseRequest = null
    collapse()
  }
})

function isDirty(): boolean {
  const t = props.task
  if (form.value.notes    !== t.notes)                           return true
  if (form.value.priority !== t.priority)                        return true
  if ((form.value.dueDate || undefined) !== t.dueDate)           return true
  if ((form.value.dueTime || undefined) !== t.dueTime)           return true
  if (form.value.listId   !== t.listId)                          return true
  if (JSON.stringify(form.value.tags) !== JSON.stringify(t.tags)) return true
  if (JSON.stringify(form.value.recurrence) !== JSON.stringify(t.recurrence)) return true
  return false
}

function save() {
  if (!isDirty()) return
  store.updateTask(props.task.id, {
    notes: form.value.notes, priority: form.value.priority,
    dueDate: form.value.dueDate || undefined, dueTime: form.value.dueTime || undefined,
    listId: form.value.listId, tags: form.value.tags, recurrence: form.value.recurrence,
  })
}

function addTag() {
  const t = tagInput.value.replace(',', '').trim()
  if (t && !form.value.tags.includes(t)) { form.value.tags.push(t) }
  tagInput.value = ''
}
function removeTag(tag: string) { form.value.tags = form.value.tags.filter(t => t !== tag) }
function toggleRecurrence() {
  // Only update the form — do NOT call save() here.
  // The store (and thus filteredTasks sort) won't see the change until collapse.
  form.value.recurrence = recurrenceEnabled.value ? { interval: 1, unit: 'day' } : undefined
}
function addSubtask() {
  if (!newSubTitle.value.trim()) return
  store.createTask({ title: newSubTitle.value.trim(), parentId: props.task.id, listId: props.task.listId })
  newSubTitle.value = ''; showSubAdd.value = false
}

// ── Computed display ──────────────────────────────────────────────────────────
const subtasks          = computed(() => store.getSubtasks(props.task.id))
const completedSubCount = computed(() => subtasks.value.filter(t => t.completed).length)
const isOverdueTask     = computed(() => !props.task.completed && !!props.task.dueDate && isOverdue(props.task.dueDate))
const isDueTodayTask    = computed(() => !!props.task.dueDate && isDueToday(props.task.dueDate))

const priorities = [
  { value: 'none', label: 'None' }, { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' }, { value: 'high', label: 'High' }, { value: 'critical', label: '!' },
] as const

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}


</script>

<style scoped>
.task-item { border-radius: 9px; transition: background 0.1s; }
.task-item.expanded { background: var(--bg); box-shadow: inset 0 0 0 1px var(--border); margin: 2px 0 6px; }

.task-row {
  display: flex; align-items: center; gap: 4px;
  padding: 8px 8px 8px 4px; border-radius: 9px; cursor: pointer;
}
.task-item:not(.expanded) .task-row:hover { background: var(--bg); }

/* Icon btn base */
.icon-btn {
  width: 28px; height: 28px; min-width: 28px; border: none; background: none;
  cursor: pointer; border-radius: 6px; display: grid; place-items: center;
  color: var(--text3); flex-shrink: 0; transition: color 0.12s, background 0.1s;
  touch-action: manipulation;
}
.icon-btn:hover { background: var(--surface2); color: var(--text2); }

/* Star */
.star-btn.starred { color: #f59e0b; }
@media (hover: hover) {
  .star-btn:not(.starred) { opacity: 0; }
  .task-row:hover .star-btn { opacity: 1; }
}

/* Chevron */
.chevron-btn svg { transition: transform 0.18s; }
.chevron-btn.open svg { transform: rotate(180deg); }
@media (hover: hover) {
  .chevron-btn { opacity: 0; }
  .task-row:hover .chevron-btn,
  .task-item.expanded .chevron-btn { opacity: 1; }
}

/* Task body */
.task-body { flex: 1; min-width: 0; padding: 2px 0; }
.title {
  font-size: 14px; color: var(--text); line-height: 1.4;
  display: inline; word-break: break-word; cursor: text;
}
.title.done { text-decoration: line-through; color: var(--text3); }
.title-edit-wrap { display: flex; }
.title-input {
  flex: 1; border: none; border-bottom: 1.5px solid var(--accent);
  background: none; outline: none; font-size: 14px; color: var(--text);
  font-family: var(--font); padding: 1px 0; min-width: 0;
}
.meta-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }

/* Check (right side) */
.check-btn {
  width: 22px; height: 22px; min-width: 22px; border-radius: 50%;
  border: 1.5px solid var(--border); background: none; cursor: pointer;
  flex-shrink: 0; display: grid; place-items: center;
  transition: all 0.15s; color: transparent; touch-action: manipulation;
}
.check-btn:hover { border-color: var(--success); }
.check-btn.done { background: var(--success); border-color: var(--success); color: white; }
.check-btn.prio-critical { border-color: #ef4444; }
.check-btn.prio-high     { border-color: #f97316; }
.check-btn.prio-medium   { border-color: #eab308; }
.check-btn.prio-low      { border-color: var(--accent); }

/* Pills */
.pill { font-size: 11px; padding: 2px 6px; border-radius: 20px; display: inline-flex; align-items: center; gap: 3px; font-family: var(--font-mono); }
.pill.due     { background: var(--surface2); color: var(--text2); }
.pill.due.overdue { background: var(--danger-bg); color: var(--danger); }
.pill.due.today   { background: var(--accent-bg); color: var(--accent); }
.pill.tag   { background: var(--accent-bg); color: var(--accent); }
.pill.recur { background: var(--success-bg); color: var(--success); }
.pill.sub   { background: var(--surface2); color: var(--text3); }

/* ── Edit Panel ─────────────────────────────────────────────── */
.edit-panel {
  padding: 2px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Notes textarea */
.notes-input {
  width: 100%;
  border: none;
  border-bottom: 1px solid var(--border2);
  border-radius: 0;
  padding: 6px 0 10px;
  font-size: max(16px, 13px);
  color: var(--text);
  background: transparent;
  outline: none;
  resize: none;
  font-family: var(--font);
  min-height: 40px;
  line-height: 1.5;
  margin-bottom: 2px;
}
.notes-input:focus { border-bottom-color: var(--accent); }
.notes-input::placeholder { color: var(--text3); }

/* Field section container */
.field-section {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 4px 0;
}

/* Each row: label + control(s) on one line */
.field-row {
  display: flex;
  align-items: center;
  gap: 0;
  min-height: 34px;
  border-bottom: 1px solid var(--border2);
}
.field-row:last-child { border-bottom: none; }

.field-label {
  flex-shrink: 0;
  width: 58px;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.label-with-clear {
  flex-shrink: 0;
  width: 72px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.label-with-clear .field-label { width: auto; flex-shrink: 0; }

/* Base input style — borderless inside panel */
.field-input {
  border: none;
  background: transparent;
  outline: none;
  font-size: max(16px, 12.5px);
  color: var(--text);
  font-family: var(--font);
  height: 28px;
  padding: 0 4px;
  border-radius: 5px;
  transition: background 0.1s;
}
.field-input:hover  { background: var(--surface2); }
.field-input:focus  { background: var(--accent-bg); }
select.field-input  { cursor: pointer; }

/* Priority — segmented pill group */
.prio-group {
  display: flex;
  gap: 3px;
  flex-wrap: nowrap;
}
.prio-btn {
  padding: 3px 10px;
  border-radius: 20px;
  border: 1px solid transparent;
  background: transparent;
  font-size: 11.5px;
  cursor: pointer;
  color: var(--text3);
  transition: all 0.12s;
  font-family: var(--font);
  line-height: 1;
}
.prio-btn:hover           { background: var(--surface2); color: var(--text2); }
.prio-btn.active.critical { color: #dc2626; background: var(--danger-bg);  border-color: #fca5a5; }
.prio-btn.active.high     { color: #ea580c; background: #fff4ed;            border-color: #fdba74; }
.prio-btn.active.medium   { color: #ca8a04; background: #fffbeb;            border-color: #fde047; }
.prio-btn.active.low      { color: var(--accent); background: var(--accent-bg); border-color: #93c5fd; }
.prio-btn.active.none     { color: var(--text2); background: var(--surface2);  border-color: var(--border); }

/* Due date row — nowrap so clear button stays inline */
.due-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: nowrap;
  flex: 1;
  overflow: hidden;
}
.date-input { flex-shrink: 0; }
.time-input { width: 102px; flex-shrink: 0; }
.clear-btn {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--text3);
  transition: background 0.1s, color 0.1s;
}
.clear-btn:hover { background: var(--danger-bg); color: var(--danger); }

/* Repeat row */
.recur-group { display: flex; align-items: center; gap: 4px; flex-wrap: nowrap; }
.interval-input { width: 52px; text-align: center; }

/* Tags row */
.tags-row { align-items: flex-start; padding: 6px 0; min-height: 34px; }
.tags-row .field-label { padding-top: 2px; }
.tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
  flex: 1;
}
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11.5px;
  background: var(--accent-bg);
  color: var(--accent);
  padding: 2px 8px 2px 8px;
  border-radius: 20px;
  font-family: var(--font-mono);
}
.tag-remove {
  border: none;
  background: none;
  cursor: pointer;
  color: var(--accent);
  opacity: 0.5;
  padding: 1px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  transition: opacity 0.1s;
}
.tag-remove:hover { opacity: 1; }
.tag-input {
  border: none;
  outline: none;
  font-size: max(16px, 12.5px);
  color: var(--text);
  min-width: 80px;
  background: none;
  font-family: var(--font);
}
.tag-input::placeholder { color: var(--text3); }

/* Subtasks */
.subtasks-block { border-top: 1px solid var(--border2); padding-top: 4px; margin-top: 4px; }

/* Footer */
.panel-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  border-top: 1px solid var(--border2);
  padding-top: 8px;
  margin-top: 4px;
  flex-wrap: wrap;
}
.footer-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text3);
  border: none;
  background: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  font-family: var(--font);
  transition: background 0.1s, color 0.1s;
}
.footer-btn:hover { background: var(--surface2); color: var(--text2); }
.footer-btn.danger { margin-left: auto; color: var(--danger); }
.footer-btn.danger:hover { background: var(--danger-bg); }

.sub-add { display: flex; gap: 6px; align-items: center; }
.sub-input {
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 4px 9px;
  font-size: max(16px, 12.5px);
  outline: none;
  background: var(--surface);
  font-family: var(--font);
  color: var(--text);
}
.sub-input:focus { border-color: var(--accent); }
.btn-add-sub {
  padding: 4px 12px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--font);
}
.btn-add-sub:disabled { background: var(--border); color: var(--text3); cursor: not-allowed; }

.panel-enter-active { transition: opacity 0.15s ease; }
.panel-leave-active { transition: opacity 0.1s ease; }
.panel-enter-from, .panel-leave-to { opacity: 0; }
.panel-enter-to, .panel-leave-from { opacity: 1; }
</style>
