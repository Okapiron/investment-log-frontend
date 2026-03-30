import { api } from './api'

export function previewRakutenCsv(filename, content) {
  return api.post('/api/v1/imports/rakuten-jp/preview', { filename, content })
}

export function auditRakutenCsv(tradehistoryFilename, tradehistoryContent, realizedFilename, realizedContent) {
  return api.post('/api/v1/imports/rakuten-jp/audit', {
    tradehistory_filename: tradehistoryFilename,
    tradehistory_content: tradehistoryContent,
    realized_filename: realizedFilename,
    realized_content: realizedContent,
  })
}

export function commitRakutenCsv(filename, items) {
  return api.post('/api/v1/imports/rakuten-jp/commit', { filename, items })
}
