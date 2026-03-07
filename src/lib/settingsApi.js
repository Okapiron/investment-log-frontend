import { api, resolveApiUrl } from './api'
import { getAccessToken } from './auth'

export function getMyProfile() {
  return api.get('/api/v1/settings/me')
}

export function getReadiness() {
  return requestReadinessWithFallback()
}

async function _buildHttpError(res) {
  let detail = 'Request failed'
  let requestId = ''
  try {
    const body = await res.json()
    detail = body.detail || detail
    requestId = String(body.request_id || '').trim()
  } catch {
    detail = res.statusText || detail
  }
  if (!requestId) requestId = String(res.headers.get('x-request-id') || '').trim()
  const retryAfter = String(res.headers.get('retry-after') || '').trim()
  const retryHint = res.status === 429 && retryAfter ? ` ${retryAfter}秒後に再試行してください。` : ''
  const baseMsg = `${res.status}: ${detail}${retryHint}`
  return new Error(requestId ? `${baseMsg} (request_id: ${requestId})` : baseMsg)
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
    throw await _buildHttpError(res)
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
    throw await _buildHttpError(res)
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

export function deleteMyData(confirmText = 'DELETE') {
  const value = String(confirmText || '').trim().toUpperCase()
  return api.del(`/api/v1/settings/me?confirm=true&confirm_text=${encodeURIComponent(value)}`)
}
