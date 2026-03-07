import { getAccessToken } from './auth'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api/v1'
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000)

export function resolveApiUrl(path) {
  const base = String(API_BASE || '').replace(/\/+$/, '')
  const p = String(path || '')
  let url = ''

  if (/^https?:\/\//.test(p)) {
    url = p
  } else {
    const normalizedPath = p.startsWith('/') ? p : `/${p}`
    // If caller passes /api/v1/... and base already ends with /api/v1, avoid duplicated prefix.
    if (base.endsWith('/api/v1') && normalizedPath.startsWith('/api/v1/')) {
      url = `${base.slice(0, -7)}${normalizedPath}`
    } else if (base.endsWith('/api/v1') && normalizedPath === '/api/v1') {
      url = `${base.slice(0, -7)}${normalizedPath}`
    } else {
      url = `${base}${normalizedPath}`
    }
  }
  return url
}

async function request(path, options = {}) {
  const url = resolveApiUrl(path)

  const useTimeout = !options.signal && Number.isFinite(REQUEST_TIMEOUT_MS) && REQUEST_TIMEOUT_MS > 0
  const controller = useTimeout ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null

  let res
  try {
    const accessToken = getAccessToken()
    const authHeader = accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...authHeader, ...(options.headers || {}) },
      signal: controller ? controller.signal : options.signal,
      ...options,
    })
  } catch {
    throw new Error(
      controller?.signal.aborted
        ? `API応答がタイムアウトしました（${REQUEST_TIMEOUT_MS}ms）。`
        : 'APIに接続できません。バックエンド起動状態またはネットワークを確認してください。',
    )
  } finally {
    if (timer) clearTimeout(timer)
  }

  if (!res.ok) {
    let detail = 'Request failed'
    let requestId = ''
    try {
      const body = await res.json()
      detail = body.detail || detail
      requestId = String(body.request_id || '').trim()
    } catch {
      detail = res.statusText || detail
    }
    if (!requestId) {
      requestId = String(res.headers.get('x-request-id') || '').trim()
    }
    throw new Error(requestId ? `${res.status}: ${detail} (request_id: ${requestId})` : `${res.status}: ${detail}`)
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
}

export function formatJPY(value) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(
    Number(value || 0),
  )
}

export function formatUSD(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
    Number(value || 0),
  )
}
