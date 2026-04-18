import { api } from './api'

export function previewRakutenCsv(filename, content) {
  return api.post('/api/v1/imports/rakuten-jp/preview', { filename, content })
}

export function previewBrokerCsv(broker, filename, content) {
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
  return api.post('/api/v1/imports/rakuten-jp/commit', { filename, items })
}

export function commitBrokerCsv(broker, filename, items, options = {}) {
  return api.post(`/api/v1/imports/${broker}/commit`, {
    broker,
    filename,
    realized_filename: options.realizedFilename || null,
    audit_gap_jpy: options.auditGapJpy ?? null,
    items,
  })
}

export function getLatestImportSessions() {
  return api.get('/api/v1/imports/sessions/latest')
}
