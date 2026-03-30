import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { clearAuthSession, isAuthEnabled } from '../lib/auth'
import { auditRakutenCsv, commitRakutenCsv, previewRakutenCsv } from '../lib/importsApi'
import { clearPrivateAccessSession, isPrivateModeEnabled } from '../lib/privateAccess'
import { CONTACT_FORM_URL, SHOW_RUNTIME_PANEL, SUPPORT_EMAIL } from '../lib/siteConfig'
import { deleteMyData, downloadMyExport, getMyProfile, getReadiness } from '../lib/settingsApi'

async function readCsvFileText(file) {
  const buffer = await file.arrayBuffer()
  const uint8 = new Uint8Array(buffer)

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(uint8)
  } catch {
    try {
      return new TextDecoder('shift-jis', { fatal: true }).decode(uint8)
    } catch {
      return new TextDecoder('utf-8').decode(uint8)
    }
  }
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const frontendVersion = String(import.meta.env.VITE_APP_VERSION || '').trim() || 'dev-local'
  const supportEmail = SUPPORT_EMAIL
  const showRuntime = SHOW_RUNTIME_PANEL
  const privateModeEnabled = isPrivateModeEnabled()
  const [working, setWorking] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [importFile, setImportFile] = useState(null)
  const [auditRealizedFile, setAuditRealizedFile] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [auditResult, setAuditResult] = useState(null)
  const { data, isLoading, error: meError, refetch } = useQuery({
    queryKey: ['settings', 'me'],
    queryFn: getMyProfile,
  })
  const {
    data: readiness,
    isLoading: readinessLoading,
    error: readinessError,
    dataUpdatedAt: readinessUpdatedAt,
    isFetching: readinessFetching,
    refetch: refetchReadiness,
  } = useQuery({
    queryKey: ['settings', 'readiness'],
    queryFn: getReadiness,
    retry: 1,
    refetchInterval: 60_000,
    enabled: showRuntime,
  })

  async function handleExport(format) {
    try {
      setWorking(`export_${format}`)
      setError('')
      setMsg('')
      await downloadMyExport(format)
      setMsg(`エクスポート(${format.toUpperCase()})をダウンロードしました。`)
    } catch (e) {
      setError(String(e?.message || e || 'エクスポートに失敗しました。'))
    } finally {
      setWorking('')
    }
  }

  async function handleDeleteData() {
    if (confirmText !== 'DELETE') {
      setError('削除するには確認欄に DELETE と入力してください。')
      return
    }
    const ok = window.confirm('あなたのTradeデータを削除します。元に戻せません。実行しますか？')
    if (!ok) return

    try {
      setWorking('delete')
      setError('')
      setMsg('')
      const result = await deleteMyData(confirmText)
      const deletedTrades = Number(result?.deleted_trades || 0)
      const anonymizedInvites = Number(result?.anonymized_invites || 0)
      const deletedAuthUser = Boolean(result?.deleted_auth_user)
      const authDeleteError = String(result?.auth_delete_error || '').trim()
      const inviteNotice = anonymizedInvites > 0 ? `招待コード履歴を匿名化しました（${anonymizedInvites}件）。` : ''
      const notice = authDeleteError
        ? `データを削除しました（${deletedTrades}件）。${inviteNotice}${authDeleteError}`
        : deletedAuthUser
          ? `データを削除しました（${deletedTrades}件）。${inviteNotice}Authユーザー削除も完了しました。`
          : `データを削除しました（${deletedTrades}件）。${inviteNotice}`
      setConfirmText('')

      if (isAuthEnabled()) {
        clearAuthSession()
        window.alert(`${notice}\nログアウトしました。`)
        navigate('/auth', { replace: true })
        return
      }

      setMsg(notice)
      await refetch()
    } catch (e) {
      setError(String(e?.message || e || '削除に失敗しました。'))
    } finally {
      setWorking('')
    }
  }

  async function handleImportPreview() {
    if (!importFile) {
      setError('楽天証券の国内株CSVを選択してください。')
      return
    }
    try {
      setWorking('import_preview')
      setError('')
      setMsg('')
      const content = await readCsvFileText(importFile)
      const result = await previewRakutenCsv(importFile.name, content)
      setImportPreview(result)
      setMsg(`CSVを解析しました。作成予定 ${result.candidate_count} 件、スキップ ${result.skipped_count} 件、エラー ${result.error_count} 件です。`)
    } catch (e) {
      setImportPreview(null)
      setError(String(e?.message || e || 'CSVの解析に失敗しました。'))
    } finally {
      setWorking('')
    }
  }

  async function handleImportCommit() {
    if (!importPreview?.candidates?.length) {
      setError('先にプレビューを実行してください。')
      return
    }
    try {
      setWorking('import_commit')
      setError('')
      setMsg('')
      const result = await commitRakutenCsv(importPreview.filename || importFile?.name || 'rakuten.csv', importPreview.candidates)
      setMsg(
        `取込が完了しました。作成 ${result.created_count} 件、更新 ${result.updated_count || 0} 件、スキップ ${result.skipped_count} 件、エラー ${result.error_count} 件です。`
      )
      navigate('/analysis', {
        replace: false,
        state: {
          importSummary: {
            filename: importPreview.filename || importFile?.name || 'rakuten.csv',
            createdCount: result.created_count,
            updatedCount: result.updated_count || 0,
            skippedCount: result.skipped_count,
            errorCount: result.error_count,
          },
        },
      })
    } catch (e) {
      setError(String(e?.message || e || 'CSV取込に失敗しました。'))
    } finally {
      setWorking('')
    }
  }

  async function handleRakutenAudit() {
    if (!importFile || !auditRealizedFile) {
      setError('tradehistory(JP) と realized_pl(JP) の両方を選択してください。')
      return
    }
    try {
      setWorking('import_audit')
      setError('')
      setMsg('')
      const [tradehistoryContent, realizedContent] = await Promise.all([
        readCsvFileText(importFile),
        readCsvFileText(auditRealizedFile),
      ])
      const result = await auditRakutenCsv(importFile.name, tradehistoryContent, auditRealizedFile.name, realizedContent)
      setAuditResult(result)
      setMsg(`整合性チェックが完了しました。差額は ${result.gap_jpy >= 0 ? '+' : ''}${Math.round(result.gap_jpy).toLocaleString('ja-JP')} 円です。`)
    } catch (e) {
      setAuditResult(null)
      setError(String(e?.message || e || '整合性チェックに失敗しました。'))
    } finally {
      setWorking('')
    }
  }

  function handleLogout() {
    if (privateModeEnabled) {
      clearPrivateAccessSession()
      navigate('/', { replace: true })
      return
    }
    clearAuthSession()
    navigate('/auth', { replace: true })
  }

  const canDeleteData = String(confirmText || '').trim().toUpperCase() === 'DELETE'

  return (
    <div style={{ display: 'grid', gap: 10, maxWidth: 760 }}>
      <h2 style={{ margin: 0 }}>設定</h2>

      <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 13, color: '#667085', fontWeight: 700 }}>アカウント</div>
        {isLoading ? <div style={{ fontSize: 13, color: '#475467' }}>読み込み中…</div> : null}
        {meError ? <div style={{ fontSize: 13, color: '#b42318' }}>取得失敗: {String(meError?.message || meError)}</div> : null}
        {!isLoading && !meError ? (
          <>
            <div style={{ fontSize: 13, color: '#344054' }}>
              Email: <b>{privateModeEnabled ? '個人用モード' : (data?.email || '—')}</b>
            </div>
          </>
        ) : null}
        <div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={!privateModeEnabled && !isAuthEnabled()}
            style={{
              background: '#2a8871',
              color: '#fff',
              border: '1px solid #2a8871',
              borderRadius: 8,
              padding: '8px 12px',
              fontWeight: 700,
              opacity: privateModeEnabled || isAuthEnabled() ? 1 : 0.6,
            }}
          >
            {privateModeEnabled ? 'アクセス解除' : 'ログアウト'}
          </button>
        </div>
      </div>

      {showRuntime ? (
        <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 13, color: '#667085', fontWeight: 700 }}>稼働状況</div>
            <button
              type="button"
              onClick={() => refetchReadiness()}
              disabled={readinessFetching}
              style={{
                background: '#f2f4f7',
                color: '#111',
                border: '1px solid #d0d5dd',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 12,
                opacity: readinessFetching ? 0.6 : 1,
              }}
            >
              {readinessFetching ? '確認中…' : '再確認'}
            </button>
          </div>
          {readinessLoading ? <div style={{ fontSize: 13, color: '#475467' }}>確認中…</div> : null}
          {readinessError ? (
            <div style={{ fontSize: 13, color: '#b42318' }}>
              API/DB: 障害の可能性があります（{String(readinessError?.message || readinessError)}）
            </div>
          ) : null}
          {!readinessLoading && !readinessError ? (
            <>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color:
                    readiness?.release_status === 'error'
                      ? '#b42318'
                      : readiness?.release_status === 'warning'
                        ? '#b54708'
                        : readiness?.release_status === 'ok'
                          ? '#027a48'
                          : '#667085',
                }}
              >
                リリース状態:{' '}
                <b>
                  {readiness?.release_status === 'error'
                    ? 'ERROR'
                    : readiness?.release_status === 'warning'
                      ? 'WARNING'
                      : readiness?.release_status === 'ok'
                        ? 'OK'
                        : 'UNKNOWN'}
                </b>
              </div>
              <div style={{ fontSize: 13, color: '#344054' }}>
                API: <b>{readiness?.status === 'ok' ? 'OK' : readiness?.status === 'unknown' ? '未対応' : 'NG'}</b> / DB:{' '}
                <b>{readiness?.db === 'ok' ? 'OK' : readiness?.status === 'unknown' ? '未対応' : '確認中'}</b>
              </div>
              <div style={{ fontSize: 12, color: '#667085' }}>
                バックエンド版: <b>{readiness?.app_version || '—'}</b>
              </div>
              <div style={{ fontSize: 12, color: '#667085' }}>
                サーバー時刻 (UTC): <b>{readiness?.server_time_utc || '—'}</b>
              </div>
              <div style={{ fontSize: 12, color: '#667085' }}>
                フロントエンド版: <b>{frontendVersion}</b>
              </div>
              {(readiness?.config_errors?.length || readiness?.config_warnings?.length) ? (
                <div style={{ fontSize: 12, color: '#b54708', display: 'grid', gap: 2 }}>
                  {readiness?.config_errors?.length ? (
                    <div style={{ color: '#b42318' }}>リリースエラー: {readiness.config_errors.join(' / ')}</div>
                  ) : null}
                  {readiness?.config_warnings?.length ? <div>リリース警告: {readiness.config_warnings.join(' / ')}</div> : null}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#667085' }}>リリース確認: 問題なし</div>
              )}
              {readiness?.status === 'unknown' ? (
                <div style={{ fontSize: 12, color: '#b54708' }}>
                  Runtime確認エンドポイントが未対応のため状態を判定できません（旧バージョンの可能性があります）。
                </div>
              ) : null}
              <div style={{ fontSize: 12, color: '#667085' }}>
                最終確認: {readinessUpdatedAt ? new Date(readinessUpdatedAt).toLocaleTimeString('ja-JP') : '—'}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 13, color: '#667085', fontWeight: 700 }}>楽天証券 CSV取込</div>
        <div style={{ fontSize: 12, color: '#667085', lineHeight: 1.6 }}>
          国内株の現物売買と信用買いを読み込み、TradeTrace の trade に変換します。分割決済は複数 trade に分け、
          残建玉は保有中として残します。信用売りなど対象外のケースはスキップまたはエラーとして表示します。
        </div>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, color: '#667085' }}>tradehistory(JP) CSV</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setImportFile(e.target.files?.[0] || null)
              setImportPreview(null)
              setAuditResult(null)
            }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, color: '#667085' }}>realized_pl(JP) CSV</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setAuditRealizedFile(e.target.files?.[0] || null)
              setAuditResult(null)
            }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleImportPreview}
            disabled={working === 'import_preview' || !importFile}
            style={{ background: '#f2f4f7', color: '#111', border: '1px solid #d0d5dd', borderRadius: 8, padding: '8px 12px', opacity: working === 'import_preview' || !importFile ? 0.6 : 1 }}
          >
            {working === 'import_preview' ? '解析中…' : 'プレビュー'}
          </button>
          <button
            type="button"
            onClick={handleRakutenAudit}
            disabled={working === 'import_audit' || !importFile || !auditRealizedFile}
            style={{ background: '#f2f4f7', color: '#111', border: '1px solid #d0d5dd', borderRadius: 8, padding: '8px 12px', opacity: working === 'import_audit' || !importFile || !auditRealizedFile ? 0.6 : 1 }}
          >
            {working === 'import_audit' ? '照合中…' : '整合性チェック'}
          </button>
          <button
            type="button"
            onClick={handleImportCommit}
            disabled={working === 'import_commit' || !importPreview?.candidates?.length}
            style={{ background: '#2a8871', color: '#fff', border: '1px solid #2a8871', borderRadius: 8, padding: '8px 12px', opacity: working === 'import_commit' || !importPreview?.candidates?.length ? 0.6 : 1 }}
          >
            {working === 'import_commit' ? '取込中…' : 'この内容で取り込む'}
          </button>
        </div>

        {importPreview ? (
          <div style={{ display: 'grid', gap: 8, border: '1px solid #eaecf0', borderRadius: 10, padding: 10, background: '#fcfcfd' }}>
            <div style={{ fontSize: 13, color: '#344054' }}>
              作成予定 <b>{importPreview.candidate_count}</b> 件 / スキップ <b>{importPreview.skipped_count}</b> 件 / エラー <b>{importPreview.error_count}</b> 件
            </div>
            {importPreview.candidates?.length ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {importPreview.candidates.map((item) => (
                  <div key={item.source_signature} style={{ border: '1px solid #eaecf0', borderRadius: 8, padding: 8, background: '#fff', display: 'grid', gap: 4 }}>
                    <div style={{ fontWeight: 700 }}>{item.symbol} {item.name || ''}</div>
                    <div style={{ fontSize: 12, color: '#475467' }}>
                      BUY {item.buy.date} / {item.buy.qty}株 / {item.buy.price}円 / fee {item.buy.fee}円
                    </div>
                    {item.sell ? (
                      <div style={{ fontSize: 12, color: '#475467' }}>
                        SELL {item.sell.date} / {item.sell.qty}株 / {item.sell.price}円 / fee {item.sell.fee}円
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#475467' }}>
                        OPEN / {item.buy.qty}株を保有中 / fee {item.buy.fee}円
                      </div>
                    )}
                    {item.is_partial_exit ? (
                      <div style={{ fontSize: 12, color: '#b54708' }}>
                        {item.sell
                          ? `この候補は分割決済の一部です。残り ${item.remaining_qty_after_sell} 株は保有中として扱います。`
                          : 'この候補は分割決済の残建玉です。'}
                      </div>
                    ) : null}
                    {item.already_imported ? (
                      <div style={{ fontSize: 12, color: '#b54708' }}>既に取込済みです。commit 時はスキップされます。</div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            {importPreview.skipped?.length ? (
              <div style={{ fontSize: 12, color: '#667085', display: 'grid', gap: 4 }}>
                <div style={{ fontWeight: 700 }}>スキップ</div>
                {importPreview.skipped.map((item, idx) => (
                  <div key={`skip-${idx}`}>行 {item.line ?? '—'}: {item.message}</div>
                ))}
              </div>
            ) : null}
            {importPreview.errors?.length ? (
              <div style={{ fontSize: 12, color: '#b42318', display: 'grid', gap: 4 }}>
                <div style={{ fontWeight: 700 }}>エラー</div>
                {importPreview.errors.map((item, idx) => (
                  <div key={`err-${idx}`}>行 {item.line ?? '—'}: {item.message}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {auditResult ? (
          <div style={{ display: 'grid', gap: 8, border: '1px solid #eaecf0', borderRadius: 10, padding: 10, background: '#fff' }}>
            <div style={{ fontSize: 13, color: '#344054', fontWeight: 700 }}>楽天整合性チェック</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
              <div style={{ border: '1px solid #eaecf0', borderRadius: 8, padding: 8, background: '#fcfcfd' }}>
                <div style={{ fontSize: 12, color: '#667085' }}>TT合計</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{Math.round(auditResult.tt_total_jpy).toLocaleString('ja-JP')}円</div>
              </div>
              <div style={{ border: '1px solid #eaecf0', borderRadius: 8, padding: 8, background: '#fcfcfd' }}>
                <div style={{ fontSize: 12, color: '#667085' }}>楽天合計</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{Math.round(auditResult.rakuten_total_jpy).toLocaleString('ja-JP')}円</div>
              </div>
              <div style={{ border: '1px solid #eaecf0', borderRadius: 8, padding: 8, background: '#fcfcfd' }}>
                <div style={{ fontSize: 12, color: '#667085' }}>差額</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: auditResult.gap_jpy === 0 ? '#101828' : '#b42318' }}>
                  {auditResult.gap_jpy > 0 ? '+' : ''}{Math.round(auditResult.gap_jpy).toLocaleString('ja-JP')}円
                </div>
              </div>
              <div style={{ border: '1px solid #eaecf0', borderRadius: 8, padding: 8, background: '#fcfcfd' }}>
                <div style={{ fontSize: 12, color: '#667085' }}>一致件数</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{auditResult.matched_count}件</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#667085' }}>{auditResult.reimport_hint}</div>
            {[
              ['楽天にあるがTTにない決済', auditResult.missing_in_tt],
              ['損益が一致しない決済', auditResult.pnl_mismatch],
              ['TTにあるが楽天と結びつかない決済', auditResult.unmatched_tt],
            ].map(([title, items]) =>
              items?.length ? (
                <div key={title} style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#344054' }}>{title}</div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {items.map((item, idx) => (
                      <div key={`${title}-${idx}`} style={{ border: '1px solid #eaecf0', borderRadius: 8, padding: 8, background: '#fcfcfd', fontSize: 12, color: '#475467' }}>
                        <div style={{ fontWeight: 700, color: '#101828' }}>
                          {item.symbol} {item.name || ''} / {item.sell_date} / {item.qty}株
                        </div>
                        <div>
                          売値 {item.sell_price}円 / 買値・平均取得 {item.buy_price_or_avg_cost}円 / TT {item.tt_profit_jpy ?? '—'}円 / 楽天 {item.rakuten_profit_jpy ?? '—'}円
                        </div>
                        {item.message ? <div style={{ color: '#b54708' }}>{item.message}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        ) : null}
      </div>

      <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 13, color: '#667085', fontWeight: 700 }}>データ</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleExport('json')}
            disabled={Boolean(working)}
            style={{ background: '#f2f4f7', color: '#111', border: '1px solid #d0d5dd', borderRadius: 8, padding: '8px 12px', opacity: working ? 0.6 : 1 }}
          >
            JSONをエクスポート
          </button>
          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={Boolean(working)}
            style={{ background: '#f2f4f7', color: '#111', border: '1px solid #d0d5dd', borderRadius: 8, padding: '8px 12px', opacity: working ? 0.6 : 1 }}
          >
            CSVをエクスポート
          </button>
        </div>

        <div style={{ marginTop: 4, padding: 10, border: '1px solid #f4c7cc', borderRadius: 10, background: '#fcfcfd', display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 13, color: '#b42318', fontWeight: 700 }}>アカウントデータ削除</div>
          <div style={{ fontSize: 12, color: '#667085' }}>
            取り消しできません。実行前にエクスポートを推奨します。
          </div>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#667085' }}>確認文字列（DELETE）</span>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              style={{ border: '1px solid #d0d5dd', borderRadius: 8, padding: '8px 10px' }}
            />
          </label>
          <div>
            <button
              type="button"
              onClick={handleDeleteData}
              disabled={working === 'delete' || !canDeleteData}
              style={{
                background: '#fff5f5',
                color: '#b42318',
                border: '1px solid #f4c7cc',
                borderRadius: 8,
                padding: '8px 12px',
                fontWeight: 700,
                opacity: working === 'delete' || !canDeleteData ? 0.6 : 1,
              }}
            >
              データを削除
            </button>
          </div>
          {!canDeleteData ? (
            <div style={{ fontSize: 12, color: '#98a2b3' }}>DELETE と入力するとボタンが有効になります。</div>
          ) : null}
        </div>
      </div>

      <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 13, color: '#667085', fontWeight: 700 }}>法務</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
          <Link to="/help">ヘルプ</Link>
          <Link to="/terms">利用規約</Link>
          <Link to="/privacy">プライバシーポリシー</Link>
          {CONTACT_FORM_URL ? (
            <a href={CONTACT_FORM_URL} target="_blank" rel="noreferrer">
              お問い合わせフォーム
            </a>
          ) : supportEmail ? (
            <a href={`mailto:${supportEmail}`}>お問い合わせ</a>
          ) : null}
        </div>
      </div>

      {msg ? <div style={{ fontSize: 13, color: '#175cd3' }}>{msg}</div> : null}
      {error ? <div style={{ fontSize: 13, color: '#b42318' }}>{error}</div> : null}
    </div>
  )
}
