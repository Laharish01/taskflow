export type Priority = 'none' | 'low' | 'medium' | 'high' | 'critical'
export type RecurrenceUnit = 'hour' | 'day' | 'week' | 'month' | 'year'

export interface Recurrence {
  interval: number
  unit: RecurrenceUnit
  endDate?: string
}

export interface Task {
  id: string
  title: string
  notes: string
  completed: boolean
  completedAt?: string
  createdAt: string
  updatedAt: string
  dueDate?: string
  dueTime?: string
  priority: Priority
  tags: string[]
  parentId?: string
  subtaskIds: string[]
  recurrence?: Recurrence
  listId: string
  order: number
  starred: boolean
  collapsed: boolean
  streak: number
  lastStreakAt?: number  // epoch ms — timestamp of last streak completion
}

export interface TaskList {
  id: string
  name: string
  color: string
  icon: string
  order: number
  showCompleted: boolean
}

export interface AppState {
  tasks: Record<string, Task>
  lists: Record<string, TaskList>
  tags: string[]
  version: number
  lastModified: string
}

export interface FilterState {
  listId: string | null
  tag: string | null
  priority: Priority | null
  showCompleted: boolean
  search: string
  view: 'current' | 'all' | 'list'
}

export interface GoogleDriveConfig {
  fileId: string | null
  connected: boolean
  syncing: boolean
  lastSync: string | null
}
