import { api } from './api'

export function previewRakutenCsv(filename, content) {
  return api.post('/api/v1/imports/rakuten-jp/preview', { filename, content })
}

export function commitRakutenCsv(filename, items) {
  return api.post('/api/v1/imports/rakuten-jp/commit', { filename, items })
}
