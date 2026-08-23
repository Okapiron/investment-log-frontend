const DB_NAME = 'tradetrace_local_trial_v1'
const DB_VERSION = 1

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('このブラウザではローカル保存を利用できません。'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('trades')) {
        const store = db.createObjectStore('trades', { keyPath: 'id' })
        store.createIndex('source_signature', 'source_signature', { unique: true })
        store.createIndex('opened_at', 'opened_at', { unique: false })
        store.createIndex('symbol', 'symbol', { unique: false })
      }
      if (!db.objectStoreNames.contains('importCandidates')) {
        const store = db.createObjectStore('importCandidates', { keyPath: 'source_signature' })
        store.createIndex('cloud_synced', 'cloud_synced', { unique: false })
      }
      if (!db.objectStoreNames.contains('importSessions')) {
        const store = db.createObjectStore('importSessions', { keyPath: 'id' })
        store.createIndex('imported_at', 'imported_at', { unique: false })
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('ローカルDBを開けませんでした。'))
  })
  return dbPromise
}

function txStore(db, storeName, mode = 'readonly') {
  const tx = db.transaction(storeName, mode)
  return { tx, store: tx.objectStore(storeName) }
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('ローカルDB操作に失敗しました。'))
  })
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('ローカルDB保存に失敗しました。'))
    tx.onabort = () => reject(tx.error || new Error('ローカルDB保存を中断しました。'))
  })
}

export async function getAllLocal(storeName) {
  const db = await openDb()
  const { store } = txStore(db, storeName)
  return requestToPromise(store.getAll())
}

export async function getLocal(storeName, key) {
  const db = await openDb()
  const { store } = txStore(db, storeName)
  return requestToPromise(store.get(key))
}

export async function putLocal(storeName, value) {
  const db = await openDb()
  const { tx, store } = txStore(db, storeName, 'readwrite')
  store.put(value)
  await txDone(tx)
  return value
}

export async function putManyLocal(storeName, values) {
  const db = await openDb()
  const { tx, store } = txStore(db, storeName, 'readwrite')
  values.forEach((value) => store.put(value))
  await txDone(tx)
  return values
}

export async function deleteLocal(storeName, key) {
  const db = await openDb()
  const { tx, store } = txStore(db, storeName, 'readwrite')
  store.delete(key)
  await txDone(tx)
}

export async function clearLocalTrialData() {
  const db = await openDb()
  const tx = db.transaction(['trades', 'importCandidates', 'importSessions', 'meta'], 'readwrite')
  tx.objectStore('trades').clear()
  tx.objectStore('importCandidates').clear()
  tx.objectStore('importSessions').clear()
  tx.objectStore('meta').clear()
  await txDone(tx)
}

export async function getLocalMeta(key, fallback = null) {
  const row = await getLocal('meta', key)
  return row ? row.value : fallback
}

export async function setLocalMeta(key, value) {
  return putLocal('meta', { key, value, updated_at: new Date().toISOString() })
}

export async function nextLocalId(key) {
  const current = Number(await getLocalMeta(key, 0) || 0)
  const next = current + 1
  await setLocalMeta(key, next)
  return next
}

export async function exportLocalTrialData() {
  const [trades, importCandidates, importSessions] = await Promise.all([
    getAllLocal('trades'),
    getAllLocal('importCandidates'),
    getAllLocal('importSessions'),
  ])
  return {
    exported_at: new Date().toISOString(),
    storage_mode: 'local',
    trades,
    importCandidates,
    importSessions,
  }
}
