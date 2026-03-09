import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { getAuthFlowType, isAuthEnabled, isAuthenticated, updatePassword } from '../lib/auth'

export default function AuthResetPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  if (!isAuthEnabled()) return <Navigate to="/trades" replace />

  const authed = isAuthenticated()
  const recoveryFlow = getAuthFlowType() === 'recovery'

  if (!authed) {
    return (
      <div style={{ maxWidth: 520, margin: '24px auto', border: '1px solid #e4e7ec', borderRadius: 12, padding: 16, background: '#fff' }}>
        <h2 style={{ marginTop: 0 }}>パスワード再設定</h2>
        <div style={{ fontSize: 13, color: '#b42318', marginBottom: 12 }}>
          再設定用セッションを確認できませんでした。メール内のリンクを開き直してください。
        </div>
        <Link to="/auth">ログイン画面へ戻る</Link>
      </div>
    )
  }

  async function onSubmit(e) {
    e.preventDefault()
    try {
      setSubmitting(true)
      setError('')
      setMsg('')

      if (password !== passwordConfirm) {
        throw new Error('確認用パスワードが一致しません。')
      }

      await updatePassword({ password })
      setMsg('パスワードを更新しました。')
      setTimeout(() => navigate('/trades', { replace: true }), 600)
    } catch (err) {
      setError(String(err?.message || err || 'パスワードの更新に失敗しました。'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '24px auto', border: '1px solid #e4e7ec', borderRadius: 12, padding: 16, background: '#fff' }}>
      <h2 style={{ marginTop: 0 }}>新しいパスワードを設定</h2>
      <p style={{ marginTop: 0, color: '#475467', fontSize: 14 }}>
        {recoveryFlow ? 'メール内のリンクを確認しました。' : '現在のセッションでパスワードを更新します。'} 8文字以上の新しいパスワードを入力してください。
      </p>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, color: '#667085' }}>新しいパスワード</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8文字以上"
            minLength={8}
            required
          />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, color: '#667085' }}>新しいパスワード（確認）</span>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="同じパスワードを再入力"
            minLength={8}
            required
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          style={{ background: '#2a8871', color: '#fff', border: '1px solid #2a8871', opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? '更新中…' : 'パスワードを更新'}
        </button>
      </form>

      {msg ? <div style={{ marginTop: 10, fontSize: 13, color: '#175cd3' }}>{msg}</div> : null}
      {error ? <div style={{ marginTop: 10, fontSize: 13, color: '#b42318' }}>{error}</div> : null}
    </div>
  )
}
