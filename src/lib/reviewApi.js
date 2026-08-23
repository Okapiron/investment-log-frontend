import { api } from './api'

const TRADES_BASE = '/api/v1/trades'

export async function getNextReviewTrade(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    qs.set(key, String(value))
  })
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return api.get(`${TRADES_BASE}/next-review${query}`)
}

export async function patchTradeReview(tradeId, payload) {
  return api.patch(`${TRADES_BASE}/${encodeURIComponent(tradeId)}/review`, payload)
}

export async function completeTradeReview(tradeId) {
  return api.post(`${TRADES_BASE}/${encodeURIComponent(tradeId)}/review/complete`, {})
}
