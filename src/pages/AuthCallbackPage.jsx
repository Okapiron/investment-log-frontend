import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import {
  consumeAuthSessionFromUrl,
  exchangeTokenHashForSession,
  getAuthCallbackError,
  getAuthCallbackParams,
  isAuthEnabled,
  isAuthenticated,
} from '../lib/auth'

export default function AuthCallbackPage() {
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    async function run() {
      if (!isAuthEnabled()) {
        if (!active) return
        setDone(true)
        return
      }

      const authError = getAuthCallbackError({
        hash: window.location.hash,
        search: window.location.search,
      })
      if (authError) {
        if (!active) return
        setError(`認証に失敗しました: ${authError}`)
        setDone(true)
        return
      }

      let session = consumeAuthSessionFromUrl({
        hash: window.location.hash,
        search: window.location.search,
      })
      const params = getAuthCallbackParams({
        hash: window.location.hash,
        search: window.location.search,
      })
      if (!session && params.token_hash && params.type) {
        try {
          session = await exchangeTokenHashForSession({
            tokenHash: params.token_hash,
            type: params.type,
          })
        } catch (err) {
          if (!active) return
          setError(String(err?.message || err || '認証リンクの検証に失敗しました。'))
          setDone(true)
          return
        }
      }

      window.history.replaceState({}, document.title, window.location.pathname)

      if (!session) {
        if (!active) return
        setError('認証情報を取得できませんでした。メールリンクを開き直してください。')
        setDone(true)
        return
      }
      if (session.auth_flow_type === 'recovery' || params.type === 'recovery') {
        navigate('/auth/reset', { replace: true })
        return
      }
      navigate('/trades', { replace: true })
    }

    run()

    return () => {
      active = false
    }
  }, [navigate])

  if (!isAuthEnabled()) return <Navigate to="/trades" replace />
  if (done && isAuthenticated()) return <Navigate to="/trades" replace />

  return (
    <div style={{ maxWidth: 520, margin: '24px auto', border: '1px solid #e4e7ec', borderRadius: 12, padding: 16, background: '#fff' }}>
      <h2 style={{ marginTop: 0 }}>認証処理中</h2>
      {error ? (
        <div style={{ fontSize: 13, color: '#b42318' }}>{error}</div>
      ) : (
        <div style={{ fontSize: 13, color: '#475467' }}>ログインを確認しています…</div>
      )}
    </div>
  )
}
