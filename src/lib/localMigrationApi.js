import { getAllLocal, putManyLocal } from './localDb'
import { commitBrokerCsv } from './importsApi'

export async function hasUnsyncedLocalImports() {
  const candidates = await getAllLocal('importCandidates')
  return candidates.some((item) => !item.cloud_synced)
}

export async function migrateLocalImportsToCloud() {
  const candidates = await getAllLocal('importCandidates')
  const pending = candidates.filter((item) => !item.cloud_synced)
  if (!pending.length) {
    return { migrated_count: 0, created_count: 0, updated_count: 0, skipped_count: 0, error_count: 0 }
  }
  const result = await commitBrokerCsv('rakuten', 'tradetrace-local-import.csv', pending)
  const now = new Date().toISOString()
  await putManyLocal('importCandidates', candidates.map((item) => (
    pending.some((p) => p.source_signature === item.source_signature)
      ? { ...item, cloud_synced: true, cloud_synced_at: now }
      : item
  )))
  return { migrated_count: pending.length, ...result }
}
