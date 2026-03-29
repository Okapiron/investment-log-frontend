import { api } from './api'

export async function getAnalysisSummary() {
  return api.get('/api/v1/analysis/summary')
}
