import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Task, TaskList, AppState, FilterState, Priority } from '../types'
import { generateId, isoNow, nextRecurrenceDatetime, recurrenceIntervalMs, formatMonthGroup, debounce } from '../utils/helpers'
import { loadFromDB, saveToDB } from '../utils/storage'
import { autoScheduleNotification, cancelTaskNotification } from '../utils/notifications'

const DEFAULT_LISTS: TaskList[] = [
  { id: 'inbox',    name: 'Inbox',    color: '#4f7ef7', icon: '📥', order: 0, showCompleted: false },
  { id: 'personal', name: 'Personal', color: '#22c55e', icon: '🏠', order: 1, showCompleted: false },
  { id: 'work',     name: 'Work',     color: '#f59e0b', icon: '💼', order: 2, showCompleted: false },
]

const EMPTY_STATE: AppState = {
  tasks: {},
  lists: Object.fromEntries(DEFAULT_LISTS.map(l => [l.id, l])),
  tags: [],
  version: 1,
  lastModified: isoNow(),
}

export const useTaskStore = defineStore('tasks', () => {
  const state   = ref<AppState>(structuredClone(EMPTY_STATE))
  const filter  = ref<FilterState>({ listId: null, tag: null, priority: null, showCompleted: false, search: '', view: 'current' })
  const loading = ref(true)
  /** ID of the currently-expanded TaskItem — only one at a time */
  const expandedTaskId = ref<string | null>(null)
  /** Set to a task ID to request that TaskItem runs its collapse() animation */
  const collapseRequest = ref<string | null>(null)

  // ── Persistence ────────────────────────────────────────────────────────────
  const persistDebounced = debounce(async () => {
    state.value.lastModified = isoNow()
    await saveToDB(state.value)
  }, 400)

  async function loadState(incoming?: AppState) {
    const saved = incoming ?? await loadFromDB()
    if (saved) state.value = saved
    loading.value = false
    _resetOverdueStreaks()
  }

  function _resetOverdueStreaks() {
    const nowMs = Date.now()
    for (const task of Object.values(state.value.tasks)) {
      if (!task.recurrence || !task.streak) continue
      const intervalMs = recurrenceIntervalMs(task.recurrence)
      const intervalStartMs = nowMs - intervalMs
      // If last completion was more than one interval ago, streak is broken
      if (!task.lastStreakAt || task.lastStreakAt < intervalStartMs) {
        task.streak = 0
      }
    }
  }

  function markDirty() { persistDebounced() }

  // ── Getters ────────────────────────────────────────────────────────────────
  const allTasks = computed(() => Object.values(state.value.tasks))
  const allLists = computed(() => Object.values(state.value.lists).sort((a, b) => a.order - b.order))
  const allTags  = computed(() => {
    const s = new Set<string>(state.value.tags)
    for (const t of Object.values(state.value.tasks)) t.tags.forEach(tag => s.add(tag))
    return [...s]
  })

  function taskOrDescendantHasTag(task: Task, tag: string): boolean {
    if (task.tags.includes(tag)) return true
    return task.subtaskIds.some(id => {
      const sub = state.value.tasks[id]
      return sub ? taskOrDescendantHasTag(sub, tag) : false
    })
  }

  /** Incomplete top-level tasks, sorted: starred → priority → due → order */
  const filteredTasks = computed(() => {
    const { view, listId, tag, priority, search } = filter.value
    let tasks = allTasks.value.filter(t => !t.parentId)

    if (view === 'current') tasks = tasks.filter(t => !t.completed)
    else if (view === 'list' && listId) tasks = tasks.filter(t => t.listId === listId)
    // 'all' handled separately via allViewData

    if (tag)          tasks = tasks.filter(t => taskOrDescendantHasTag(t, tag))
    if (priority)     tasks = tasks.filter(t => t.priority === priority)
    if (search.trim()) {
      const q = search.toLowerCase()
      tasks = tasks.filter(t => t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q))
    }

    return tasks.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      // Recurring tasks float above all others (except completed)
      if (!a.completed) {
        const ar = !!a.recurrence, br = !!b.recurrence
        if (ar !== br) return ar ? -1 : 1
      }
      if (!a.completed && a.starred !== b.starred) return a.starred ? -1 : 1
      const pa = priorityOrder(a.priority), pb = priorityOrder(b.priority)
      if (pa !== pb) return pa - pb
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return a.order - b.order
    })
  })

  /**
   * For the "All Tasks" view:
   * active = incomplete tasks sorted normally
   * completedGroups = completed tasks grouped by month of completedAt, newest first
   */
  const allViewData = computed(() => {
    const { tag, priority, search } = filter.value
    let tasks = allTasks.value.filter(t => !t.parentId)

    if (tag)          tasks = tasks.filter(t => taskOrDescendantHasTag(t, tag))
    if (priority)     tasks = tasks.filter(t => t.priority === priority)
    if (search.trim()) {
      const q = search.toLowerCase()
      tasks = tasks.filter(t => t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q))
    }

    const completed = tasks.filter(t => t.completed)
    const groupMap = new Map<string, { key: string; label: string; tasks: Task[] }>()
    for (const t of completed) {
      const iso  = t.completedAt ?? t.updatedAt
      const key  = iso.slice(0, 7)   // YYYY-MM
      const label = formatMonthGroup(iso)
      if (!groupMap.has(key)) groupMap.set(key, { key, label, tasks: [] })
      groupMap.get(key)!.tasks.push(t)
    }
    const completedGroups = [...groupMap.values()]
      .sort((a, b) => b.key.localeCompare(a.key))

    return { completedGroups }
  })

  function priorityOrder(p: Priority): number {
    return { critical: 0, high: 1, medium: 2, low: 3, none: 4 }[p]
  }

  function getSubtasks(parentId: string): Task[] {
    return (state.value.tasks[parentId]?.subtaskIds ?? [])
      .map(id => state.value.tasks[id]).filter(Boolean)
  }

  // ── Task CRUD ──────────────────────────────────────────────────────────────
  function createTask(partial: Partial<Task> & { title: string }): Task {
    const id = generateId()
    const task: Task = {
      id, title: partial.title, notes: partial.notes ?? '',
      completed: false, createdAt: isoNow(), updatedAt: isoNow(),
      dueDate: partial.dueDate, dueTime: partial.dueTime,
      priority: partial.priority ?? 'none', tags: partial.tags ?? [],
      parentId: partial.parentId, subtaskIds: [],
      recurrence: partial.recurrence,
      listId: partial.listId ?? filter.value.listId ?? 'inbox',
      order: allTasks.value.length, starred: partial.starred ?? false, collapsed: false,
      streak: partial.streak ?? 0, lastStreakAt: partial.lastStreakAt,
    }
    state.value.tasks[id] = task
    if (partial.parentId) {
      const parent = state.value.tasks[partial.parentId]
      if (parent) parent.subtaskIds.push(id)
    }
    addTagsIfNew(task.tags)
    markDirty()
    if (task.dueDate) autoScheduleNotification(task)
    return task
  }

  function updateTask(id: string, changes: Partial<Task>) {
    const task = state.value.tasks[id]
    if (!task) return
    Object.assign(task, changes, { updatedAt: isoNow() })
    if (changes.tags) addTagsIfNew(changes.tags)
    markDirty()
    if ('dueDate' in changes || 'recurrence' in changes) {
      if (task.dueDate) autoScheduleNotification(task)
      else cancelTaskNotification(id)
    }
  }

  function deleteTask(id: string) {
    const task = state.value.tasks[id]
    if (!task) return
    if (task.parentId) {
      const parent = state.value.tasks[task.parentId]
      if (parent) parent.subtaskIds = parent.subtaskIds.filter(s => s !== id)
    }
    task.subtaskIds.forEach(sid => deleteTask(sid))
    delete state.value.tasks[id]
    if (expandedTaskId.value === id) expandedTaskId.value = null
    markDirty()
  }

  function completeTask(id: string, _completed: boolean) {
    const task = state.value.tasks[id]
    if (!task) return

    if (task.recurrence) {
      if (!_completed) return // unchecking a recurring task is a no-op

      const nowMs = Date.now()
      const intervalMs = recurrenceIntervalMs(task.recurrence)
      // The current interval started intervalMs ago.
      // If the user already completed within this window, block.
      const intervalStartMs = nowMs - intervalMs
      if (task.lastStreakAt !== undefined && task.lastStreakAt > intervalStartMs) return

      // Streak increments if completed on or before the due date (or no due date)
      const dueMs = task.dueDate
        ? new Date(task.dueTime ? `${task.dueDate}T${task.dueTime}:00` : `${task.dueDate}T23:59:59`).getTime()
        : Infinity
      const onTime = nowMs <= dueMs
      const newStreak = onTime ? (task.streak ?? 0) + 1 : 0

      // Advance due date if set
      const updates: Partial<Task> = { streak: newStreak, lastStreakAt: nowMs }
      if (task.dueDate) {
        const next = nextRecurrenceDatetime(task.dueDate, task.dueTime, task.recurrence)
        if (!task.recurrence.endDate || next.date <= task.recurrence.endDate) {
          updates.dueDate = next.date
          updates.dueTime = next.time
        }
      }
      updateTask(id, updates)
      return
    }

    // Non-recurring: normal complete/uncomplete
    updateTask(id, { completed: _completed, completedAt: _completed ? isoNow() : undefined })
  }

  function toggleStar(id: string) {
    const task = state.value.tasks[id]
    if (task) updateTask(id, { starred: !task.starred })
  }

  function reorderTask(id: string, newOrder: number) { updateTask(id, { order: newOrder }) }

  // ── List CRUD ──────────────────────────────────────────────────────────────
  function createList(partial: Partial<TaskList> & { name: string }): TaskList {
    const id = generateId()
    const list: TaskList = { id, name: partial.name, color: partial.color ?? '#6366f1', icon: partial.icon ?? '📋', order: allLists.value.length, showCompleted: false }
    state.value.lists[id] = list
    markDirty()
    return list
  }

  function updateList(id: string, changes: Partial<TaskList>) {
    const list = state.value.lists[id]
    if (list) Object.assign(list, changes)
    markDirty()
  }

  function deleteList(id: string) {
    if (['inbox', 'personal', 'work'].includes(id)) return
    Object.values(state.value.tasks).forEach(t => { if (t.listId === id) t.listId = 'inbox' })
    delete state.value.lists[id]
    markDirty()
  }

  // ── Tags ───────────────────────────────────────────────────────────────────
  function addTagsIfNew(tags: string[]) {
    tags.forEach(tag => { if (!state.value.tags.includes(tag)) state.value.tags.push(tag) })
  }

  function deleteTag(tag: string) {
    state.value.tags = state.value.tags.filter(t => t !== tag)
    Object.values(state.value.tasks).forEach(task => { task.tags = task.tags.filter(t => t !== tag) })
    markDirty()
  }

  // ── Filter helpers ─────────────────────────────────────────────────────────
  function setView(view: FilterState['view'], listId?: string) {
    filter.value.view   = view
    filter.value.listId = listId ?? null
    expandedTaskId.value = null   // collapse all when switching views
  }

  function setFilter(changes: Partial<FilterState>) { Object.assign(filter.value, changes) }

  return {
    state, filter, loading, expandedTaskId, collapseRequest,
    allTasks, allLists, allTags, filteredTasks, allViewData,
    loadState, markDirty,
    createTask, updateTask, deleteTask, completeTask, toggleStar, reorderTask,
    createList, updateList, deleteList,
    addTagsIfNew, deleteTag,
    getSubtasks, setView, setFilter,
  }
})
