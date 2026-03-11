<template>
  <div class="detail-panel" v-if="task">
    <div class="panel-header">
      <button class="close-btn" @click="$emit('close')">✕</button>
      <button class="delete-btn" @click="onDelete">Delete</button>
    </div>

    <!-- Title -->
    <textarea
      class="title-input"
      v-model="form.title"
      placeholder="Task title"
      rows="1"
      @input="autoGrow"
      @blur="save"
    />

    <!-- Priority -->
    <div class="field-row">
      <label>Priority</label>
      <div class="priority-row">
        <button
          v-for="p in priorities" :key="p.value"
          class="prio-btn" :class="[p.value, { active: form.priority === p.value }]"
          @click="form.priority = p.value; save()"
        >{{ p.label }}</button>
      </div>
    </div>

    <!-- Due date + time -->
    <div class="field-row">
      <label>Due Date</label>
      <input type="date" v-model="form.dueDate" class="field-input" @change="save" />
    </div>
    <div class="field-row" v-if="form.dueDate">
      <label>Due Time</label>
      <input type="time" v-model="form.dueTime" class="field-input" @change="save" />
    </div>

    <!-- List -->
    <div class="field-row">
      <label>List</label>
      <select v-model="form.listId" class="field-input" @change="save">
        <option v-for="list in store.allLists" :key="list.id" :value="list.id">{{ list.name }}</option>
      </select>
    </div>

    <!-- Tags -->
    <div class="field-row">
      <label>Tags</label>
      <div class="tags-field">
        <span v-for="tag in form.tags" :key="tag" class="tag-chip">
          #{{ tag }}
          <button @click="removeTag(tag)">✕</button>
        </span>
        <input
          v-model="tagInput"
          placeholder="Add tag…"
          class="tag-input"
          @keydown.enter.prevent="addTag"
          @keydown.comma.prevent="addTag"
          list="tag-suggestions"
        />
        <datalist id="tag-suggestions">
          <option v-for="t in store.allTags" :key="t" :value="t" />
        </datalist>
      </div>
    </div>

    <!-- Recurrence -->
    <div class="field-row">
      <label>Repeat</label>
      <div class="recur-row">
        <select v-model="recurrenceEnabled" class="field-input short" @change="toggleRecurrence">
          <option :value="false">Never</option>
          <option :value="true">Custom</option>
        </select>
        <template v-if="form.recurrence">
          <input type="number" min="1" max="365" v-model.number="form.recurrence.interval" class="field-input num" @change="save" />
          <select v-model="form.recurrence.unit" class="field-input short" @change="save">
            <option value="day">Day(s)</option>
            <option value="week">Week(s)</option>
            <option value="month">Month(s)</option>
            <option value="year">Year(s)</option>
          </select>
        </template>
      </div>
    </div>
    <div class="field-row" v-if="form.recurrence">
      <label>End Date</label>
      <input type="date" v-model="form.recurrence.endDate" class="field-input" @change="save" />
    </div>

    <!-- Notes -->
    <div class="field-row col">
      <label>Notes</label>
      <textarea v-model="form.notes" class="notes-input" placeholder="Add notes…" @blur="save" rows="4" />
    </div>

    <!-- Metadata -->
    <div class="meta">
      <span>Created {{ formatDate(task.createdAt.slice(0, 10)) }}</span>
      <span v-if="task.completedAt"> · Completed {{ formatDate(task.completedAt.slice(0, 10)) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Task, Priority, Recurrence } from '../types'
import { useTaskStore } from '../stores/taskStore'
import { formatDate } from '../utils/helpers'

const props = defineProps<{ task: Task | null }>()
const emit = defineEmits<{ close: []; delete: [id: string] }>()

const store = useTaskStore()
const tagInput = ref('')

interface Form {
  title: string; notes: string; priority: Priority
  dueDate: string; dueTime: string; listId: string
  tags: string[]; recurrence?: Recurrence
}

const form = ref<Form>(blankForm())
const recurrenceEnabled = ref(false)

const priorities = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const

function blankForm(): Form {
  return { title: '', notes: '', priority: 'none', dueDate: '', dueTime: '', listId: 'inbox', tags: [] }
}

watch(() => props.task, (t) => {
  if (!t) return
  form.value = {
    title: t.title, notes: t.notes, priority: t.priority,
    dueDate: t.dueDate ?? '', dueTime: t.dueTime ?? '',
    listId: t.listId, tags: [...t.tags],
    recurrence: t.recurrence ? { ...t.recurrence } : undefined,
  }
  recurrenceEnabled.value = !!t.recurrence
}, { immediate: true })

function save() {
  if (!props.task) return
  store.updateTask(props.task.id, {
    title: form.value.title,
    notes: form.value.notes,
    priority: form.value.priority,
    dueDate: form.value.dueDate || undefined,
    dueTime: form.value.dueTime || undefined,
    listId: form.value.listId,
    tags: form.value.tags,
    recurrence: form.value.recurrence,
  })
}

function addTag() {
  const t = tagInput.value.replace(',', '').trim()
  if (t && !form.value.tags.includes(t)) {
    form.value.tags.push(t)
    save()
  }
  tagInput.value = ''
}

function removeTag(tag: string) {
  form.value.tags = form.value.tags.filter(t => t !== tag)
  save()
}

function toggleRecurrence() {
  if (recurrenceEnabled.value) {
    form.value.recurrence = { interval: 1, unit: 'week' }
  } else {
    form.value.recurrence = undefined
  }
  save()
}

function autoGrow(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

function onDelete() {
  if (!props.task) return
  if (confirm('Delete this task?')) {
    emit('delete', props.task.id)
    emit('close')
  }
}
</script>

<style scoped>
/* Desktop: side panel */
.detail-panel {
  width: 340px;
  min-width: 340px;
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: #fff;
  border-left: 1px solid #e5e5e0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

/* Mobile: full-screen overlay panel */
@media (max-width: 768px) {
  .detail-panel {
    position: fixed;
    inset: 0;
    width: 100%;
    min-width: 0;
    height: 100%;
    height: 100dvh;
    border-left: none;
    padding: 16px;
    padding-top: max(16px, env(safe-area-inset-top));
    padding-bottom: max(16px, env(safe-area-inset-bottom));
    z-index: 50;
    box-shadow: none;
  }
}

.panel-header { display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
.close-btn {
  border: none; background: none; font-size: 18px; color: #888; cursor: pointer;
  min-width: 44px; min-height: 44px; border-radius: 8px; display: grid; place-items: center;
  -webkit-tap-highlight-color: transparent;
}
.close-btn:hover { background: #f0f0ec; }
.delete-btn {
  border: none; background: none; font-size: 13px; color: #dc2626; cursor: pointer;
  padding: 8px 12px; border-radius: 8px; min-height: 44px;
  -webkit-tap-highlight-color: transparent;
}
.delete-btn:hover { background: #fee2e2; }

.title-input {
  width: 100%; border: none; font-size: 18px; font-weight: 600; color: #1a1a1a;
  resize: none; outline: none; line-height: 1.3; min-height: 28px; overflow: hidden;
  /* Prevent iOS zoom */
  font-size: max(18px, 16px);
}
.field-row { display: flex; align-items: flex-start; gap: 8px; }
.field-row.col { flex-direction: column; gap: 4px; }
label { font-size: 12px; font-weight: 600; color: #888; width: 68px; flex-shrink: 0; padding-top: 10px; }
.field-input {
  flex: 1; border: 1px solid #e5e5e0; border-radius: 6px;
  padding: 8px; font-size: max(16px, 13px); color: #333; background: #fafaf9; outline: none;
  min-height: 40px;
}
.field-input:focus { border-color: #2563eb; background: white; }
.field-input.short { flex: 0 0 auto; width: auto; }
.field-input.num { width: 64px; flex: 0 0 64px; }
.notes-input {
  width: 100%; border: 1px solid #e5e5e0; border-radius: 6px; padding: 8px;
  font-size: max(16px, 13px); color: #333; background: #fafaf9; outline: none;
  resize: vertical; font-family: inherit; min-height: 88px;
}
.notes-input:focus { border-color: #2563eb; background: white; }
.priority-row { display: flex; gap: 4px; flex-wrap: wrap; flex: 1; padding-top: 4px; }
.prio-btn {
  padding: 6px 10px; border-radius: 12px; border: 1.5px solid #e5e5e0;
  background: white; font-size: 12px; cursor: pointer; color: #888;
  transition: all 0.12s; min-height: 36px; -webkit-tap-highlight-color: transparent;
}
.prio-btn.active, .prio-btn:hover { border-color: currentColor; }
.prio-btn.critical.active { color: #dc2626; background: #fee2e2; border-color: #fca5a5; }
.prio-btn.high.active { color: #ea580c; background: #ffedd5; border-color: #fdba74; }
.prio-btn.medium.active { color: #ca8a04; background: #fef9c3; border-color: #fde047; }
.prio-btn.low.active { color: #2563eb; background: #dbeafe; border-color: #93c5fd; }
.prio-btn.none.active { color: #555; background: #f0f0ec; }
.recur-row { display: flex; gap: 6px; align-items: center; flex: 1; flex-wrap: wrap; }
.tags-field {
  flex: 1; display: flex; flex-wrap: wrap; gap: 4px;
  align-items: center; min-height: 36px;
}
.tag-chip {
  display: flex; align-items: center; gap: 3px; font-size: 12px;
  background: #eef2ff; color: #4f46e5; padding: 4px 8px; border-radius: 10px;
}
.tag-chip button {
  border: none; background: none; cursor: pointer; color: #a5b4fc;
  font-size: 12px; min-width: 20px; min-height: 20px; padding: 0;
}
.tag-chip button:hover { color: #4f46e5; }
.tag-input {
  border: none; outline: none; font-size: max(16px, 13px); color: #444;
  min-width: 80px; background: none;
}
.tag-input::placeholder { color: #bbb; }
.meta { font-size: 11px; color: #bbb; border-top: 1px solid #f0f0ec; padding-top: 8px; flex-shrink: 0; }
</style>
