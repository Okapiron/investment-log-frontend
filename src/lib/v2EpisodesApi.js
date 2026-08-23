import { api } from './api'

const V2_BASE = '/api/v2'

function queryString(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })
  return query.toString() ? `?${query.toString()}` : ''
}

export function getReviewQueue(params = {}) {
  return api.get(`${V2_BASE}/review-queue${queryString(params)}`)
}

export function listEpisodes(params = {}) {
  return api.get(`${V2_BASE}/episodes${queryString(params)}`)
}

export function getEpisode(episodeId) {
  return api.get(`${V2_BASE}/episodes/${encodeURIComponent(episodeId)}`)
}

export function patchEpisodeReview(episodeId, payload) {
  return api.patch(`${V2_BASE}/episodes/${encodeURIComponent(episodeId)}/review`, payload)
}

export function patchDecisionPointReview(decisionPointId, payload) {
  return api.patch(`${V2_BASE}/decision-points/${encodeURIComponent(decisionPointId)}/review`, payload)
}

export function completeEpisodeReview(episodeId, version) {
  return api.post(`${V2_BASE}/episodes/${encodeURIComponent(episodeId)}/review/complete`, { version })
}

export function importRakutenExecutions({
  filename,
  content,
  realizedFilename = null,
  realizedContent = null,
  providerAccountId = 'primary',
}) {
  return api.post(`${V2_BASE}/imports/rakuten`, {
    filename,
    tradehistory_content: content,
    realized_filename: realizedFilename,
    realized_content: realizedContent,
    provider_account_id: providerAccountId,
  })
}

export function listV2ImportSessions(params = {}) {
  return api.get(`${V2_BASE}/imports${queryString(params)}`)
}

export function getV2ImportSession(sessionId) {
  return api.get(`${V2_BASE}/imports/${encodeURIComponent(sessionId)}`)
}

export function undoV2ImportSession(sessionId) {
  return api.post(`${V2_BASE}/imports/${encodeURIComponent(sessionId)}/undo`, {})
}
