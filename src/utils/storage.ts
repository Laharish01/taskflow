import type { AppState } from '../types'

const DB_NAME = 'taskflow'
const DB_VERSION = 1
const STORE = 'state'
const KEY = 'appstate'

let db: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => { db = req.result; resolve(db) }
    req.onerror = () => reject(req.error)
  })
}

export async function loadFromDB(): Promise<AppState | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(KEY)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function saveToDB(state: AppState): Promise<void> {
  // Strip Vue reactive proxy — IDB structured clone cannot handle Proxy objects
  const plain = JSON.parse(JSON.stringify(state)) as AppState
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(plain, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function exportJSON(state: AppState): Promise<void> {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `taskflow-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importJSON(): Promise<AppState> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return reject(new Error('No file'))
      const reader = new FileReader()
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result as string))
        } catch {
          reject(new Error('Invalid JSON'))
        }
      }
      reader.readAsText(file)
    }
    input.click()
  })
}
