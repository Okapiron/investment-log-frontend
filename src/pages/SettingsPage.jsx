import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { clearAuthSession, isAuthEnabled } from '../lib/auth'
import { deleteMyData, downloadMyExport, getMyProfile, getReadiness } from '../lib/settingsApi'

export default function SettingsPage() {
  const navigate = useNavigate()
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
  } = useQuery({
    queryKey: ['settings', 'readiness'],
    queryFn: getReadiness,
    retry: 1,
    refetchInterval: 60_000,
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
      const result = await deleteMyData()
      const deletedTrades = Number(result?.deleted_trades || 0)
      const deletedAuthUser = Boolean(result?.deleted_auth_user)
      const authDeleteError = String(result?.auth_delete_error || '').trim()
      if (authDeleteError) {
        setMsg(`データを削除しました（${deletedTrades}件）。${authDeleteError}`)
      } else if (deletedAuthUser) {
        setMsg(`データを削除しました（${deletedTrades}件）。Authユーザー削除も完了しました。`)
      } else {
        setMsg(`データを削除しました（${deletedTrades}件）。`)
      }
      setConfirmText('')
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

  return (
    <div style={{ display: 'grid', gap: 10, maxWidth: 760 }}>
      <h2 style={{ margin: 0 }}>Settings</h2>

      <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 13, color: '#667085', fontWeight: 700 }}>Account</div>
        {isLoading ? <div style={{ fontSize: 13, color: '#475467' }}>読み込み中…</div> : null}
        {meError ? <div style={{ fontSize: 13, color: '#b42318' }}>取得失敗: {String(meError?.message || meError)}</div> : null}
        {!isLoading && !meError ? (
          <>
            <div style={{ fontSize: 13, color: '#344054' }}>User ID: <b>{data?.user_id || '—'}</b></div>
            <div style={{ fontSize: 13, color: '#344054' }}>Email: <b>{data?.email || '—'}</b></div>
            <div style={{ fontSize: 12, color: '#667085' }}>
              Auth: {data?.auth_enabled ? 'ON' : 'OFF'} / Invite: {data?.invite_code_required ? 'ON' : 'OFF'}
            </div>
          </>
        ) : null}
        <div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={!isAuthEnabled()}
            style={{ background: '#f2f4f7', color: '#111', border: '1px solid #d0d5dd', borderRadius: 8, padding: '8px 12px', opacity: isAuthEnabled() ? 1 : 0.6 }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 13, color: '#667085', fontWeight: 700 }}>Runtime</div>
        {readinessLoading ? <div style={{ fontSize: 13, color: '#475467' }}>確認中…</div> : null}
        {readinessError ? (
          <div style={{ fontSize: 13, color: '#b42318' }}>
            API/DB: 障害の可能性があります（{String(readinessError?.message || readinessError)}）
          </div>
        ) : null}
        {!readinessLoading && !readinessError ? (
          <div style={{ fontSize: 13, color: '#344054' }}>
            API: <b>{readiness?.status === 'ok' ? 'OK' : 'NG'}</b> / DB: <b>{readiness?.db === 'ok' ? 'OK' : 'NG'}</b>
          </div>
        ) : null}
      </div>

      <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 13, color: '#667085', fontWeight: 700 }}>Data</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleExport('json')}
            disabled={Boolean(working)}
            style={{ background: '#2a8871', color: '#fff', border: '1px solid #2a8871', borderRadius: 8, padding: '8px 12px', opacity: working ? 0.6 : 1 }}
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

        <div style={{ marginTop: 4, padding: 10, border: '1px solid #fecaca', borderRadius: 10, background: '#fef3f2', display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 13, color: '#b42318', fontWeight: 700 }}>アカウントデータ削除</div>
          <div style={{ fontSize: 12, color: '#b42318' }}>
            取り消しできません。実行前にエクスポートを推奨します。
          </div>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#b42318' }}>確認文字列（DELETE）</span>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              style={{ border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 10px' }}
            />
          </label>
          <div>
            <button
              type="button"
              onClick={handleDeleteData}
              disabled={working === 'delete'}
              style={{ background: '#fef3f2', color: '#b42318', border: '1px solid #fecdca', borderRadius: 8, padding: '8px 12px', fontWeight: 700, opacity: working === 'delete' ? 0.6 : 1 }}
            >
              データを削除
            </button>
          </div>
        </div>
      </div>

      <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 13, color: '#667085', fontWeight: 700 }}>Legal</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
          <Link to="/terms">利用規約</Link>
          <Link to="/privacy">プライバシーポリシー</Link>
        </div>
      </div>

      {msg ? <div style={{ fontSize: 13, color: '#175cd3' }}>{msg}</div> : null}
      {error ? <div style={{ fontSize: 13, color: '#b42318' }}>{error}</div> : null}
    </div>
  )
}
