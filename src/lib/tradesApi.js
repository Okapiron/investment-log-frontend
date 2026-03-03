import { api } from './api'

// 一覧取得（将来フィルタ追加できる）
export async function listTrades(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    qs.set(k, String(v))
  })
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return api.get(`/trades${query}`)
}
