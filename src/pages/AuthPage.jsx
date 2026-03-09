import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import {
  isAuthConfigured,
  isAuthEnabled,
  isAuthenticated,
  requestPasswordReset,
  signInWithPassword,
  signUpWithPassword,
} from '../lib/auth'

export default function AuthPage() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const enabled = isAuthEnabled()
  const configured = isAuthConfigured()

  if (!enabled) return <Navigate to="/trades" replace />
  if (isAuthenticated()) return <Navigate to="/trades" replace />

  async function onSubmit(e) {
    e.preventDefault()
    try {
      setSubmitting(true)
      setError('')
      setMsg('')
      if (mode === 'signin') {
        await signInWithPassword({ email, password })
        setMsg('ログインしました。')
        return
      }

      if (mode === 'recovery') {
        const redirectTo = `${window.location.origin}/auth/callback`
        await requestPasswordReset({ email, redirectTo })
        setMsg('パスワード再設定メールを送信しました。メール内のリンクを開いて新しいパスワードを設定してください。')
        return
      }

      if (password !== passwordConfirm) {
        throw new Error('確認用パスワードが一致しません。')
      }
      const result = await signUpWithPassword({ email, password, inviteCode })
      if (result?.needsEmailConfirmation) {
        setMsg('アカウントを作成しました。確認メール内のリンクからログインしてください。')
      } else {
        setMsg('アカウントを作成してログインしました。')
      }
    } catch (err) {
      setError(String(err?.message || err || '認証に失敗しました。'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '24px auto', border: '1px solid #e4e7ec', borderRadius: 12, padding: 16, background: '#fff' }}>
      <h2 style={{ marginTop: 0 }}>ログイン</h2>
      <p style={{ marginTop: 0, color: '#475467', fontSize: 14 }}>
        メールアドレスとパスワードでログインします。
      </p>
      <div style={{ display: 'inline-flex', gap: 6, marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => {
            setMode('signin')
            setMsg('')
            setError('')
          }}
          style={{
            borderRadius: 999,
            border: mode === 'signin' ? '1px solid #2a8871' : '1px solid #d0d5dd',
            background: mode === 'signin' ? '#e8f7f4' : '#f2f4f7',
            color: '#111',
            padding: '6px 12px',
            fontSize: 13,
          }}
        >
          ログイン
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('signup')
            setMsg('')
            setError('')
          }}
          style={{
            borderRadius: 999,
            border: mode === 'signup' ? '1px solid #2a8871' : '1px solid #d0d5dd',
            background: mode === 'signup' ? '#e8f7f4' : '#f2f4f7',
            color: '#111',
            padding: '6px 12px',
            fontSize: 13,
          }}
        >
          新規登録
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('recovery')
            setMsg('')
            setError('')
            setPassword('')
            setPasswordConfirm('')
          }}
          style={{
            borderRadius: 999,
            border: mode === 'recovery' ? '1px solid #2a8871' : '1px solid #d0d5dd',
            background: mode === 'recovery' ? '#e8f7f4' : '#f2f4f7',
            color: '#111',
            padding: '6px 12px',
            fontSize: 13,
          }}
        >
          パスワード再設定
        </button>
      </div>

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

          {mode !== 'recovery' ? (
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#667085' }}>パスワード</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8文字以上"
                minLength={8}
                required
              />
            </label>
          ) : (
            <div style={{ fontSize: 13, color: '#475467', background: '#f8fafc', border: '1px solid #e4e7ec', borderRadius: 8, padding: 10 }}>
              登録済みメールアドレスを入力すると、パスワード再設定メールを送信します。
            </div>
          )}

          {mode === 'signup' ? (
            <>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#667085' }}>パスワード（確認）</span>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="同じパスワードを再入力"
                  minLength={8}
                  required
                />
              </label>

              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#667085' }}>招待コード（招待制ONの時のみ）</span>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(String(e.target.value || '').toUpperCase())}
                  placeholder="任意"
                  minLength={8}
                  maxLength={12}
                  pattern="[A-Za-z0-9]{0,12}"
                />
              </label>
            </>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            style={{ background: '#2a8871', color: '#fff', border: '1px solid #2a8871', opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? '処理中…' : mode === 'signin' ? 'ログイン' : mode === 'signup' ? '新規登録' : '再設定メールを送信'}
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
