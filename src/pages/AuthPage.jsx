import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { isAuthConfigured, isAuthEnabled, isAuthenticated, requestMagicLink } from '../lib/auth'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const enabled = isAuthEnabled()
  const configured = isAuthConfigured()
  const redirectTo = useMemo(() => `${window.location.origin}/auth/callback`, [])

  if (!enabled) return <Navigate to="/trades" replace />
  if (isAuthenticated()) return <Navigate to="/trades" replace />

  async function onSubmit(e) {
    e.preventDefault()
    try {
      setSubmitting(true)
      setError('')
      setMsg('')
      await requestMagicLink({ email, inviteCode, redirectTo })
      setMsg('認証メールを送信しました。メール内リンクからログインしてください。')
    } catch (err) {
      setError(String(err?.message || err || '認証メール送信に失敗しました。'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '24px auto', border: '1px solid #e4e7ec', borderRadius: 12, padding: 16, background: '#fff' }}>
      <h2 style={{ marginTop: 0 }}>ログイン</h2>
      <p style={{ marginTop: 0, color: '#475467', fontSize: 14 }}>
        招待コード付きマジックリンクでログインします。
      </p>

      {!configured ? (
        <div style={{ fontSize: 13, color: '#b42318', background: '#fef3f2', border: '1px solid #fecaca', borderRadius: 8, padding: 10 }}>
          Supabase設定が不足しています。`VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を設定してください。
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#667085' }}>メールアドレス</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#667085' }}>招待コード</span>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(String(e.target.value || '').toUpperCase())}
              placeholder="例: A1B2C3D4E5"
              minLength={8}
              maxLength={12}
              pattern="[A-Za-z0-9]{8,12}"
              required
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            style={{ background: '#2a8871', color: '#fff', border: '1px solid #2a8871', opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? '送信中…' : '認証メールを送信'}
          </button>
        </form>
      )}

      {msg ? <div style={{ marginTop: 10, fontSize: 13, color: '#175cd3' }}>{msg}</div> : null}
      {error ? <div style={{ marginTop: 10, fontSize: 13, color: '#b42318' }}>{error}</div> : null}

      <div style={{ marginTop: 12, fontSize: 12, color: '#667085' }}>
        <Link to="/trades">開発モードでそのまま使う</Link>
      </div>
    </div>
  )
}
