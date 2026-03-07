import { api, resolveApiUrl } from './api'
import { getAccessToken } from './auth'

export function getMyProfile() {
  return api.get('/api/v1/settings/me')
}

export function getReadiness() {
  return requestReadinessWithFallback()
}

async function requestReadinessWithFallback() {
  const token = getAccessToken()
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const candidates = ['/health/ready', '/api/v1/health/ready', '/health', '/api/v1/health']
  let lastError = null

  for (const path of candidates) {
    const url = resolveApiUrl(path)
    let res
    try {
      res = await fetch(url, { method: 'GET', headers })
    } catch {
      lastError = new Error('APIに接続できません。バックエンド起動状態またはネットワークを確認してください。')
      continue
    }

    if (res.ok) {
      let body = {}
      try {
        body = await res.json()
      } catch {
        body = {}
      }
      const status = body?.status === 'ok' ? 'ok' : 'ng'
      const db = body?.db === 'ok' ? 'ok' : null
      return { status, db }
    }

    if (res.status === 404) {
      lastError = new Error('404: Not Found')
      continue
    }

    let detail = 'Request failed'
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      detail = res.statusText || detail
    }
    throw new Error(`${res.status}: ${detail}`)
  }

  throw lastError || new Error('ヘルスチェックに失敗しました。')
}

function _readFilenameFromDisposition(disposition, fallback) {
  const raw = String(disposition || '')
  const m = raw.match(/filename=\"?([^\";]+)\"?/)
  if (!m) return fallback
  const name = String(m[1] || '').trim()
  return name || fallback
}

export async function downloadMyExport(format = 'json') {
  const f = String(format || '').toLowerCase()
  const fallback = f === 'csv' ? 'tradetrace_export.csv' : 'tradetrace_export.json'
  const url = resolveApiUrl(`/api/v1/settings/export?format=${encodeURIComponent(f)}`)
  const token = getAccessToken()

  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, { method: 'GET', headers })
  if (!res.ok) {
    let detail = 'Request failed'
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      detail = res.statusText || detail
    }
    throw new Error(`${res.status}: ${detail}`)
  }

  const blob = await res.blob()
  const disposition = res.headers.get('content-disposition')
  const filename = _readFilenameFromDisposition(disposition, fallback)

  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

export function deleteMyData() {
  return api.del('/api/v1/settings/me?confirm=true')
}
