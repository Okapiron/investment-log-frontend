import { api } from './api'
import { isLocalTrialMode } from './localMode'
import {
  deleteLocalTrade,
  getLocalTrade,
  listLocalTrades,
  patchLocalTrade,
  updateLocalTradeReview,
} from './localTradesApi'

const TRADES_BASE = '/api/v1/trades'

// 一覧取得（将来フィルタ追加できる）
export async function listTrades(params = {}) {
  if (isLocalTrialMode()) return listLocalTrades(params)
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    qs.set(k, String(v))
  })
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return api.get(`${TRADES_BASE}${query}`)
}

export async function getTrade(tradeId) {
  if (isLocalTrialMode()) return getLocalTrade(tradeId)
  return api.get(`${TRADES_BASE}/${tradeId}`)
}

export async function patchTrade(tradeId, payload) {
  if (isLocalTrialMode()) return patchLocalTrade(tradeId, payload)
  return api.patch(`${TRADES_BASE}/${tradeId}`, payload)
}

export async function deleteTradeRecord(tradeId) {
  if (isLocalTrialMode()) return deleteLocalTrade(tradeId)
  return api.del(`${TRADES_BASE}/${tradeId}`)
}

export async function updateTradeReview(tradeId, reviewDone, reviewedAt = null) {
  if (isLocalTrialMode()) return updateLocalTradeReview(tradeId, reviewDone, reviewedAt)
  return patchTrade(tradeId, {
    review_done: Boolean(reviewDone),
    reviewed_at: reviewDone ? reviewedAt : null,
  })
}
