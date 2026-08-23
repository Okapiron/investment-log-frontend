import { storageMode } from './localMode'

export function trackProductEvent(eventName, properties = {}) {
  if (typeof window === 'undefined') return

  const cleanProperties = Object.fromEntries(
    Object.entries(properties || {}).filter(([, value]) => value !== undefined),
  )
  const detail = {
    event: String(eventName || '').trim(),
    path: window.location.pathname,
    timestamp_ms: Date.now(),
    storage_mode: cleanProperties.storage_mode || storageMode(),
    ...cleanProperties,
  }

  if (!detail.event) return

  window.dispatchEvent(new CustomEvent(`tradetrace:${detail.event}`, { detail }))
  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(detail)
  }
}

export function classifyAnalyticsError(error) {
  const message = String(error?.message || error || '').toLowerCase()

  if (message.includes('missing_headers') || message.includes('csvヘッダー')) return 'csv_missing_headers'
  if (message.includes('unsupported broker')) return 'unsupported_broker'
  if (message.includes('private access required')) return 'private_access_required'
  if (message.includes('401') || message.includes('403')) return 'auth_required'
  if (message.includes('429')) return 'rate_limited'
  if (message.includes('timeout')) return 'timeout'
  if (message.includes('network') || message.includes('接続')) return 'network'
  return 'unknown'
}
