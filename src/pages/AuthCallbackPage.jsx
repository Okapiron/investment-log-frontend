import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { consumeAuthSessionFromUrlHash, isAuthEnabled, isAuthenticated } from '../lib/auth'

export default function AuthCallbackPage() {
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!isAuthEnabled()) {
      setDone(true)
      return
    }

    const session = consumeAuthSessionFromUrlHash(window.location.hash)
    window.history.replaceState({}, document.title, window.location.pathname)
    if (!session) {
      setError('認証情報を取得できませんでした。メールリンクを開き直してください。')
      setDone(true)
      return
    }
    setDone(true)
  }, [])

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
