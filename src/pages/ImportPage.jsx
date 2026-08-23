import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import {
  getV2ImportSession,
  importRakutenExecutions,
  listV2ImportSessions,
  undoV2ImportSession,
} from '../lib/v2EpisodesApi'

async function readCsvFileText(file) {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    try {
      return new TextDecoder('shift-jis', { fatal: true }).decode(bytes)
    } catch {
      return new TextDecoder('utf-8').decode(bytes)
    }
  }
}

function anomalyMessage(anomalies) {
  if (!Array.isArray(anomalies) || !anomalies.length) return ''
  const first = anomalies[0] || {}
  if (first.code === 'missing_headers') {
    return '楽天証券の「取引履歴（国内株式）」から保存したCSVを選んでください。必要な列を確認できませんでした。'
  }
  return first.message || first.code || 'CSVを取り込めない行がありました。'
}

function userFacingError(error) {
  const message = String(error?.message || error || '')
  if (message.includes('missing_headers') || message.includes('CSVヘッダー')) {
    return '楽天証券の「取引履歴（国内株式）」から保存したCSVを選んでください。'
  }
  return message.replace(/^\d{3}:\s*/, '') || 'CSVの取込に失敗しました。'
}

function isRealizedPlCsv(file, content) {
  const name = String(file?.name || '').toLowerCase()
  const header = String(content || '').split(/\r?\n/, 1)[0]
  return name.includes('realized') || name.includes('実現損益') || header.includes('実現損益[円]')
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function statusText(status) {
  if (status === 'completed') return '完了'
  if (status === 'completed_with_anomalies') return '要確認'
  if (status === 'undone') return '取消済み'
  if (status === 'failed') return '失敗'
  return '処理中'
}

function ImportHistoryRow({ item, busy, onToggle, detail, expanded, onUndo }) {
  const fileNames = item.source_names?.length ? item.source_names.join('、') : 'CSV'
  return (
    <article className={`v2-import-history-row ${item.anomaly_count ? 'has-anomaly' : ''}`}>
      <button type="button" className="v2-import-history-summary" onClick={onToggle} aria-expanded={expanded}>
        <span className={`v2-import-status is-${item.status}`}>{statusText(item.status)}</span>
        <span className="v2-import-history-file" title={fileNames}>{fileNames}</span>
        <span>{formatDateTime(item.completed_at || item.started_at)}</span>
        <span>新規 {item.execution_created_count} / 更新 {item.execution_updated_count}</span>
        <span className="v2-import-history-chevron" aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
      </button>
      {expanded ? (
        <div className="v2-import-history-detail">
          <div className="v2-import-history-counts">
            <span>変更なし {item.execution_ignored_count}</span>
            <span>要確認 {item.anomaly_count}</span>
            {item.audit_gap_jpy == null ? null : <span>監査差額 {Number(item.audit_gap_jpy).toLocaleString('ja-JP')}円</span>}
          </div>
          {detail === undefined ? <div className="v2-import-detail-loading">詳細を読み込み中...</div> : null}
          {detail?.loadError ? <div className="v2-page-message is-error">{detail.loadError}</div> : null}
          {detail?.anomalies?.length ? (
            <ul className="v2-import-anomaly-list">
              {detail.anomalies.map((anomaly, index) => (
                <li key={`${anomaly.code}-${index}`}>
                  <strong>{anomaly.code}</strong>
                  <span>{anomaly.message}</span>
                  {anomaly.source_lines?.length ? <small>CSV行: {anomaly.source_lines.join(', ')}</small> : null}
                </li>
              ))}
            </ul>
          ) : detail && !detail.loadError ? <div className="v2-import-detail-ok">確認が必要な項目はありません。</div> : null}
          <div className="v2-import-history-actions">
            <button
              type="button"
              className="v2-import-undo-button"
              disabled={!item.can_undo || busy}
              title={item.can_undo ? 'この取込だけを取り消します' : item.undo_block_reason || ''}
              onClick={onUndo}
            >
              {busy ? '取り消し中...' : 'この取込を取り消す'}
            </button>
            {!item.can_undo && item.undo_block_reason ? <span>{item.undo_block_reason}</span> : null}
          </div>
        </div>
      ) : null}
    </article>
  )
}

export default function ImportPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const inputRef = useRef(null)
  const folderInputRef = useRef(null)
  const [working, setWorking] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [details, setDetails] = useState({})
  const [undoingId, setUndoingId] = useState(null)
  const historyQuery = useQuery({
    queryKey: ['v2-import-history'],
    queryFn: () => listV2ImportSessions({ limit: 12 }),
    retry: 1,
  })

  async function importFiles(fileList) {
    if (working) return
    const files = Array.from(fileList || [])
      .filter((file) => String(file?.name || '').toLowerCase().endsWith('.csv'))
      .sort((a, b) => String(a.webkitRelativePath || a.name).localeCompare(String(b.webkitRelativePath || b.name), 'ja'))
    if (!files.length) {
      setError('CSVファイルを選んでください。')
      return
    }
    const summary = {
      createdCount: 0,
      updatedCount: 0,
      ignoredCount: 0,
      episodeCount: 0,
      anomalyCount: 0,
      fileCount: files.length,
      failedFileCount: 0,
    }
    const failures = []
    try {
      setWorking(true)
      setError('')
      setNotice('')
      const loadedFiles = []
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        setProgress({ current: index + 1, total: files.length, name: `読込中: ${file.webkitRelativePath || file.name}` })
        try {
          const content = await readCsvFileText(file)
          loadedFiles.push({ file, content })
        } catch (nextError) {
          summary.failedFileCount += 1
          failures.push(`${file.name}: ${userFacingError(nextError)}`)
        }
      }
      const tradeFiles = loadedFiles.filter((item) => !isRealizedPlCsv(item.file, item.content))
      const realizedFiles = loadedFiles.filter((item) => isRealizedPlCsv(item.file, item.content))
      if (!tradeFiles.length) {
        setError('取引履歴CSVが見つかりませんでした。実現損益CSVだけでは取り込めません。')
        return
      }
      for (let index = 0; index < tradeFiles.length; index += 1) {
        const { file, content } = tradeFiles[index]
        const auditFile = realizedFiles.length === tradeFiles.length
          ? realizedFiles[index]
          : realizedFiles.length === 1
            ? realizedFiles[0]
            : null
        setProgress({ current: index + 1, total: tradeFiles.length, name: `取込中: ${file.webkitRelativePath || file.name}` })
        try {
          const result = await importRakutenExecutions({
            filename: file.name,
            content,
            realizedFilename: auditFile?.file?.name || null,
            realizedContent: auditFile?.content || null,
          })
          summary.createdCount += Number(result?.execution_created_count || 0)
          summary.updatedCount += Number(result?.execution_updated_count || 0)
          summary.ignoredCount += Number(result?.execution_ignored_count || 0)
          summary.episodeCount += Number(result?.episode_count || 0)
          summary.anomalyCount += Number(result?.anomalies?.length || 0)
          if (
            Number(result?.execution_created_count || 0) === 0
            && Number(result?.execution_updated_count || 0) === 0
            && Number(result?.execution_ignored_count || 0) === 0
            && result?.anomalies?.length
          ) {
            failures.push(`${file.name}: ${anomalyMessage(result.anomalies)}`)
          }
        } catch (nextError) {
          summary.failedFileCount += 1
          failures.push(`${file.name}: ${userFacingError(nextError)}`)
        }
      }
      if (realizedFiles.length > 1 && realizedFiles.length !== tradeFiles.length) {
        failures.push('実現損益CSVの対応先を特定できなかったため、損益監査は省略しました。約定取込は完了しています。')
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['v2-import-history'] }),
        queryClient.invalidateQueries({ queryKey: ['v2-review-queue'] }),
      ])
      const handled = summary.createdCount + summary.updatedCount + summary.ignoredCount
      if (handled > 0) {
        navigate('/review', { state: { importSummary: summary, importFailures: failures } })
      } else {
        setError(failures.join('\n') || '取り込める約定データがありませんでした。')
      }
    } finally {
      setWorking(false)
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
      if (folderInputRef.current) folderInputRef.current.value = ''
    }
  }

  async function toggleHistory(item) {
    if (expandedId === item.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(item.id)
    if (Object.prototype.hasOwnProperty.call(details, item.id)) return
    try {
      const detail = await getV2ImportSession(item.id)
      setDetails((current) => ({ ...current, [item.id]: detail }))
    } catch (nextError) {
      setDetails((current) => ({ ...current, [item.id]: { anomalies: [], loadError: userFacingError(nextError) } }))
    }
  }

  async function undoImport(item) {
    if (!item.can_undo || undoingId) return
    const agreed = window.confirm('この取込で追加・更新した約定を元に戻します。続けますか？')
    if (!agreed) return
    try {
      setUndoingId(item.id)
      setError('')
      setNotice('')
      const result = await undoV2ImportSession(item.id)
      setNotice(`取込を取り消しました。追加 ${result.deleted_execution_count}件を削除し、更新 ${result.restored_execution_count}件を復元しました。`)
      setExpandedId(null)
      setDetails((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['v2-import-history'] }),
        queryClient.invalidateQueries({ queryKey: ['v2-review-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['v2-episodes'] }),
      ])
    } catch (nextError) {
      setError(userFacingError(nextError))
    } finally {
      setUndoingId(null)
    }
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragActive(false)
    importFiles(event.dataTransfer?.files)
  }

  const history = historyQuery.data?.items || []
  return (
    <main className="v2-import-page">
      <header>
        <div className="v2-eyebrow">FAST IMPORT</div>
        <h1>楽天証券CSVを取り込む</h1>
        <p>複数ファイルでも、選ぶ操作は一度だけ。順番に整理してレビューキューへ送ります。</p>
      </header>

      <section
        className={`v2-import-dropzone ${dragActive ? 'is-active' : ''} ${working ? 'is-working' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <div className="v2-import-symbol" aria-hidden="true">↑</div>
        <div className="v2-import-title">{working ? '取引履歴を整理しています...' : 'CSVをここへドロップ'}</div>
        <div className="v2-import-progress">
          {progress ? `${progress.current} / ${progress.total}  ${progress.name}` : '楽天証券 取引履歴（国内株式）'}
        </div>
        <div className="v2-import-picker-actions">
          <button type="button" className="v2-import-button" disabled={working} onClick={() => inputRef.current?.click()}>
            CSVを選択
          </button>
          <button type="button" className="v2-import-folder-button" disabled={working} onClick={() => folderInputRef.current?.click()}>
            フォルダから選択
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          style={{ display: 'none' }}
          onChange={(event) => importFiles(event.target.files)}
        />
        <input
          ref={folderInputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          webkitdirectory=""
          directory=""
          style={{ display: 'none' }}
          onChange={(event) => importFiles(event.target.files)}
        />
      </section>

      {error ? <div className="v2-page-message is-error v2-preserve-lines">{error}</div> : null}
      {notice ? <div className="v2-page-message is-success">{notice}</div> : null}

      <section className="v2-import-notes">
        <div><strong>保存するもの</strong><span>約定データ、Episode、売買判断</span></div>
        <div><strong>保存しないもの</strong><span>CSVファイルそのもの</span></div>
        <div><strong>対応範囲</strong><span>楽天証券・国内株・現物ロング中心</span></div>
      </section>

      <section className="v2-import-history">
        <div className="v2-import-history-heading">
          <div>
            <div className="v2-eyebrow">IMPORT HISTORY</div>
            <h2>最近の取込</h2>
          </div>
          {historyQuery.isFetching ? <span>更新中...</span> : null}
        </div>
        {historyQuery.error ? <div className="v2-page-message is-error">取込履歴を取得できませんでした。</div> : null}
        {history.length ? (
          <div className="v2-import-history-list">
            {history.map((item) => (
              <ImportHistoryRow
                key={item.id}
                item={item}
                busy={undoingId === item.id}
                expanded={expandedId === item.id}
                detail={details[item.id]}
                onToggle={() => toggleHistory(item)}
                onUndo={() => undoImport(item)}
              />
            ))}
          </div>
        ) : historyQuery.isLoading ? <div className="v2-import-history-empty">履歴を読み込み中...</div> : (
          <div className="v2-import-history-empty">まだ取込履歴はありません。</div>
        )}
      </section>
    </main>
  )
}
