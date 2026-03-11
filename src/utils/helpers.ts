export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isoNow(): string {
  return new Date().toISOString()
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const t = new Date()
  const todayStr = t.toISOString().slice(0, 10)
  const tomorrowStr = new Date(t.getTime() + 86400000).toISOString().slice(0, 10)
  const yesterdayStr = new Date(t.getTime() - 86400000).toISOString().slice(0, 10)
  if (dateStr === todayStr) return 'Today'
  if (dateStr === tomorrowStr) return 'Tomorrow'
  if (dateStr === yesterdayStr) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== t.getFullYear() ? 'numeric' : undefined })
}

export function formatMonthGroup(isoStr: string): string {
  const d = new Date(isoStr)
  const now = new Date()
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return 'This month'
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function isOverdue(dateStr: string): boolean {
  return dateStr < today()
}

export function isDueToday(dateStr: string): boolean {
  return dateStr === today()
}

/** Returns { date, time? } for the next recurrence after dueDate/dueTime */
export function nextRecurrenceDatetime(
  dueDate: string,
  dueTime: string | undefined,
  recurrence: { interval: number; unit: string }
): { date: string; time?: string } {
  const { interval, unit } = recurrence

  if (unit === 'hour') {
    const base = dueTime ? new Date(`${dueDate}T${dueTime}:00`) : new Date(`${dueDate}T09:00:00`)
    base.setHours(base.getHours() + interval)
    return {
      date: base.toISOString().slice(0, 10),
      time: base.toTimeString().slice(0, 5),
    }
  }

  const d = new Date(dueDate + 'T00:00:00')
  switch (unit) {
    case 'day':   d.setDate(d.getDate() + interval); break
    case 'week':  d.setDate(d.getDate() + interval * 7); break
    case 'month': d.setMonth(d.getMonth() + interval); break
    case 'year':  d.setFullYear(d.getFullYear() + interval); break
  }
  return { date: d.toISOString().slice(0, 10), time: dueTime }
}

/** Returns the start of the current recurrence interval (one period before dueDate) */
export function prevRecurrenceDatetime(
  dueDate: string,
  dueTime: string | undefined,
  recurrence: { interval: number; unit: string }
): { date: string; time?: string } {
  const { interval, unit } = recurrence
  if (unit === 'hour') {
    const base = dueTime ? new Date(`${dueDate}T${dueTime}:00`) : new Date(`${dueDate}T09:00:00`)
    base.setHours(base.getHours() - interval)
    return { date: base.toISOString().slice(0, 10), time: base.toTimeString().slice(0, 5) }
  }
  const d = new Date(dueDate + 'T00:00:00')
  switch (unit) {
    case 'day':   d.setDate(d.getDate() - interval); break
    case 'week':  d.setDate(d.getDate() - interval * 7); break
    case 'month': d.setMonth(d.getMonth() - interval); break
    case 'year':  d.setFullYear(d.getFullYear() - interval); break
  }
  return { date: d.toISOString().slice(0, 10), time: dueTime }
}

// Legacy — used in a few places
export function nextRecurrenceDate(dueDate: string, recurrence: { interval: number; unit: string }): string {
  return nextRecurrenceDatetime(dueDate, undefined, recurrence).date
}

export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

/** Returns the duration of one recurrence interval in milliseconds */
export function recurrenceIntervalMs(recurrence: { interval: number; unit: string }): number {
  const { interval, unit } = recurrence
  switch (unit) {
    case 'hour':  return interval * 60 * 60 * 1000
    case 'day':   return interval * 24 * 60 * 60 * 1000
    case 'week':  return interval * 7 * 24 * 60 * 60 * 1000
    case 'month': return interval * 30 * 24 * 60 * 60 * 1000   // approx
    case 'year':  return interval * 365 * 24 * 60 * 60 * 1000  // approx
    default:      return interval * 24 * 60 * 60 * 1000
  }
}

/** Given a recurrence and creation time, return the first due datetime */
export function firstDueDatetime(
  createdAt: string,
  recurrence: { interval: number; unit: string }
): { date: string; time?: string } {
  const ms = new Date(createdAt).getTime() + recurrenceIntervalMs(recurrence)
  const d  = new Date(ms)
  return {
    date: d.toISOString().slice(0, 10),
    time: d.toTimeString().slice(0, 5),
  }
}
