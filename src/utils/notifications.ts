import type { Task } from '../types'

const NOTIF_KEY = 'taskflow_scheduled_notifs'

export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return await Notification.requestPermission()
}

export function isPermissionGranted(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

export function isSupported(): boolean {
  return 'Notification' in window
}

/**
 * Auto-schedule a notification for a task if it has a future due date.
 * Requests permission on first call if not yet granted.
 * Safe to call on every createTask/updateTask — skips if no due date or already past.
 */
export async function autoScheduleNotification(task: Task): Promise<void> {
  if (!task.dueDate || task.completed) return

  // Request permission if not yet decided
  if (Notification.permission === 'default') {
    const perm = await requestPermission()
    if (perm !== 'granted') return
  }
  if (!isPermissionGranted()) return

  const dueMs = parseDueMs(task.dueDate, task.dueTime)
  if (!dueMs || dueMs <= Date.now()) return

  // Replace any existing scheduled notification for this task
  const pending = getPending()
  pending[task.id] = { taskId: task.id, title: task.title, dueMs, dueDate: task.dueDate, dueTime: task.dueTime }
  savePending(pending)

  const delay = dueMs - Date.now()
  if (delay < 48 * 60 * 60 * 1000) {
    setTimeout(() => fireNotification(task.id, task.title, task.dueDate!, task.dueTime), delay)
  }
}

/** Schedule (or re-schedule) explicitly — kept for compatibility */
export const scheduleTaskNotification = autoScheduleNotification

export function cancelTaskNotification(taskId: string): void {
  const pending = getPending()
  delete pending[taskId]
  savePending(pending)
}

export async function fireNotification(taskId: string, title: string, dueDate: string, dueTime?: string): Promise<void> {
  console.error(dueDate);
  const body = dueTime ? `Due at ${formatTime(dueTime)}` : 'Due today'
  const options: NotificationOptions = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: `task-${taskId}`,
    data: { taskId },
    requireInteraction: false,
  }
  try {
    const reg = await navigator.serviceWorker?.ready
    if (reg?.showNotification) reg.showNotification(`TaskFlow: ${title}`, options)
    else new Notification(`TaskFlow: ${title}`, options)
  } catch {
    try { new Notification(`TaskFlow: ${title}`, options) } catch {}
  }
  const pending = getPending()
  delete pending[taskId]
  savePending(pending)
}

/**
 * Called on app start — re-schedules all pending notifications and also
 * picks up any tasks with due dates that haven't been scheduled yet.
 */
export async function restoreScheduledNotifications(tasks: Task[] = []): Promise<void> {
  // Auto-schedule any tasks with due dates (no-op if permission not granted yet)
  if (isPermissionGranted()) {
    for (const task of tasks) {
      if (task.dueDate && !task.completed) await autoScheduleNotification(task)
    }
  }

  // Re-arm setTimeout for pending items
  const pending = getPending()
  const now = Date.now()
  for (const [id, item] of Object.entries(pending)) {
    const delay = item.dueMs - now
    if (delay <= 0) {
      if (now - item.dueMs < 60 * 60 * 1000) fireNotification(id, item.title, item.dueDate, item.dueTime)
      else delete pending[id]
    } else if (delay < 48 * 60 * 60 * 1000) {
      setTimeout(() => fireNotification(id, item.title, item.dueDate, item.dueTime), delay)
    }
  }
  savePending(pending)
}

function parseDueMs(dueDate: string, dueTime?: string): number | null {
  try {
    // Default reminder at 9am if no time specified
    const dt = dueTime ? new Date(`${dueDate}T${dueTime}:00`) : new Date(`${dueDate}T09:00:00`)
    return isNaN(dt.getTime()) ? null : dt.getTime()
  } catch { return null }
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

interface PendingNotif { taskId: string; title: string; dueMs: number; dueDate: string; dueTime?: string }
function getPending(): Record<string, PendingNotif> {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) ?? '{}') } catch { return {} }
}
function savePending(p: Record<string, PendingNotif>) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(p))
}
