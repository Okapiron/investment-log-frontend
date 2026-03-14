import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { clearAuthSession, isAuthEnabled } from '../lib/auth'
import { CONTACT_FORM_URL, SHOW_RUNTIME_PANEL, SUPPORT_EMAIL } from '../lib/siteConfig'
import { deleteMyData, downloadMyExport, getMyProfile, getReadiness } from '../lib/settingsApi'

export default function SettingsPage() {
  const navigate = useNavigate()
  const frontendVersion = String(import.meta.env.VITE_APP_VERSION || '').trim() || 'dev-local'
  const supportEmail = SUPPORT_EMAIL
  const showRuntime = SHOW_RUNTIME_PANEL
  const [working, setWorking] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [confirmText, setConfirmText] = useState('')
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

  function handleLogout() {
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
            <div style={{ fontSize: 13, color: '#344054' }}>Email: <b>{data?.email || '—'}</b></div>
          </>
        ) : null}
        <div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={!isAuthEnabled()}
            style={{
              background: '#2a8871',
              color: '#fff',
              border: '1px solid #2a8871',
              borderRadius: 8,
              padding: '8px 12px',
              fontWeight: 700,
              opacity: isAuthEnabled() ? 1 : 0.6,
            }}
          >
            ログアウト
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
