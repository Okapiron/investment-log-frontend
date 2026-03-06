import { api } from './api'

const TRADES_BASE = '/api/v1/trades'

// 一覧取得（将来フィルタ追加できる）
export async function listTrades(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    qs.set(k, String(v))
  })
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return api.get(`${TRADES_BASE}${query}`)
}

export async function patchTrade(tradeId, payload) {
  return api.patch(`${TRADES_BASE}/${tradeId}`, payload)
}

export async function updateTradeReview(tradeId, reviewDone, reviewedAt = null) {
  return patchTrade(tradeId, {
    review_done: Boolean(reviewDone),
    reviewed_at: reviewDone ? reviewedAt : null,
  })
}
