const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api/v1'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })

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
