import { api } from './api'
import { isLocalTrialMode } from './localMode'
import { getLocalAnalysisSummary } from './localAnalysisApi'

export async function getAnalysisSummary() {
  if (isLocalTrialMode()) return getLocalAnalysisSummary()
  return api.get('/api/v1/analysis/summary')
}
