import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { resolveApiUrl } from '../lib/api'
import {
  buildPrivateAccessHeaders,
  clearPrivateAccessSession,
  hasPrivateAccess,
  isPrivateModeEnabled,
  savePrivateAccessSecret,
} from '../lib/privateAccess'

async function verifyPrivateSecret(secret) {
  const response = await fetch(resolveApiUrl('/api/v1/settings/me'), {
    method: 'GET',
    headers: buildPrivateAccessHeaders(secret),
  })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('共通シークレットが一致しません。')
    }
    throw new Error('接続確認に失敗しました。しばらくしてから再度お試しください。')
  }
  return response.json()
}

export default function PrivateModePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const privateMode = isPrivateModeEnabled()
  const accessGranted = useMemo(() => hasPrivateAccess(), [location.key])
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!privateMode) return
    if (accessGranted) {
      navigate('/trades', { replace: true })
    }
  }, [accessGranted, navigate, privateMode])

  if (!privateMode) {
    return null
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const value = String(secret || '').trim()
    if (!value) {
      setError('共通シークレットを入力してください。')
      return
    }
    try {
      setWorking(true)
      setError('')
      await verifyPrivateSecret(value)
      savePrivateAccessSecret(value)
      navigate('/trades', { replace: true })
    } catch (err) {
      clearPrivateAccessSession()
      setError(String(err?.message || err || 'アクセス確認に失敗しました。'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="private-mode-page">
      <div className="private-mode-panel">
        <div className="private-mode-eyebrow">PERSONAL MODE</div>
        <h2>TradeTrace は現在、個人用モードで運用中です。</h2>
        <p className="private-mode-copy">
          公開運用はいったん停止し、アプリ本体と API は共通シークレットで保護しています。
          個人用アクセス権がある場合のみ、下の入力欄から続行してください。
        </p>

        <form className="private-mode-form" onSubmit={handleSubmit}>
          <label htmlFor="private-mode-secret">共通シークレット</label>
          <input
            id="private-mode-secret"
            type="password"
            autoComplete="current-password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder="共有されたシークレットを入力"
          />
          <button type="submit" disabled={working}>
            {working ? '確認中…' : 'アプリを開く'}
          </button>
        </form>

        {error ? <div className="private-mode-error">{error}</div> : null}

        <div className="private-mode-note">
          価格データは暫定的に個人用ソースを利用しています。公開運用再開時に認証と商用データソースへ戻します。
        </div>
      </div>
    </section>
  )
}
