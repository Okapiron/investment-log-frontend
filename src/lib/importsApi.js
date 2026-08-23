import { api } from './api'
import { isLocalTrialMode } from './localMode'
import { commitRakutenCsvLocal, getLatestImportSessionsLocal, previewRakutenCsvLocal } from './localImportApi'

export function previewRakutenCsv(filename, content) {
  if (isLocalTrialMode()) return previewRakutenCsvLocal(filename, content)
  return api.post('/api/v1/imports/rakuten-jp/preview', { filename, content })
}

export function previewBrokerCsv(broker, filename, content) {
  if (isLocalTrialMode() && broker === 'rakuten') return previewRakutenCsvLocal(filename, content)
  return api.post(`/api/v1/imports/${broker}/preview`, { filename, content })
}

export function auditRakutenCsv(tradehistoryFilename, tradehistoryContent, realizedFilename, realizedContent) {
  return api.post('/api/v1/imports/rakuten-jp/audit', {
    tradehistory_filename: tradehistoryFilename,
    tradehistory_content: tradehistoryContent,
    realized_filename: realizedFilename,
    realized_content: realizedContent,
  })
}

export function auditBrokerCsv(broker, tradehistoryFilename, tradehistoryContent, realizedFilename, realizedContent) {
  return api.post(`/api/v1/imports/${broker}/audit`, {
    tradehistory_filename: tradehistoryFilename,
    tradehistory_content: tradehistoryContent,
    realized_filename: realizedFilename,
    realized_content: realizedContent,
  })
}

export function commitRakutenCsv(filename, items) {
  if (isLocalTrialMode()) return commitRakutenCsvLocal(filename, items)
  return api.post('/api/v1/imports/rakuten-jp/commit', { filename, items })
}

export function commitBrokerCsv(broker, filename, items, options = {}) {
  if (isLocalTrialMode() && broker === 'rakuten') return commitRakutenCsvLocal(filename, items)
  return api.post(`/api/v1/imports/${broker}/commit`, {
    broker,
    filename,
    realized_filename: options.realizedFilename || null,
    audit_gap_jpy: options.auditGapJpy ?? null,
    items,
  })
}

export function previewSbiRealizedCsv(filename, content) {
  return api.post('/api/v1/imports/sbi/realized/preview', { filename, content })
}

export function commitSbiRealizedCsv(filename, items) {
  return api.post('/api/v1/imports/sbi/realized/commit', { filename, items })
}

export function getLatestImportSessions() {
  if (isLocalTrialMode()) return getLatestImportSessionsLocal()
  return api.get('/api/v1/imports/sessions/latest')
}
