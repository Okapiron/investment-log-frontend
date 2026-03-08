const AUTH_STORAGE_KEY = 'tt_auth_session_v1'

const AUTH_ENABLED_RAW = String(import.meta.env.VITE_AUTH_ENABLED || '').trim().toLowerCase()
const AUTH_ENABLED = AUTH_ENABLED_RAW === '1' || AUTH_ENABLED_RAW === 'true'

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export function isAuthEnabled() {
  return AUTH_ENABLED
}

export function isAuthConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

function buildAuthUrl(path) {
  return `${SUPABASE_URL}/auth/v1/${path.replace(/^\/+/, '')}`
}

function parseHashParams(hash) {
  const raw = String(hash || '').replace(/^#/, '')
  const params = new URLSearchParams(raw)
  return {
    access_token: params.get('access_token') || '',
    refresh_token: params.get('refresh_token') || '',
    token_type: params.get('token_type') || 'bearer',
    expires_in: Number(params.get('expires_in') || 0),
    type: params.get('type') || '',
  }
}

function normalizeInviteCode(value) {
  return String(value || '').trim().toUpperCase()
}

function isValidInviteCode(value) {
  return /^[A-Z0-9]{8,12}$/.test(normalizeInviteCode(value))
}

function normalizeSession(data) {
  if (!data?.access_token) return null
  const nowMs = Date.now()
  const expiresInSec = Number(data.expires_in || 3600)
  const expiresAtMs = nowMs + Math.max(30, expiresInSec) * 1000
  return {
    access_token: String(data.access_token),
    refresh_token: String(data.refresh_token || ''),
    token_type: String(data.token_type || 'bearer'),
    expires_at_ms: expiresAtMs,
    created_at_ms: nowMs,
  }
}

export function saveAuthSession(session) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // ignore
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function getAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.access_token) return null
    return parsed
  } catch {
    return null
  }
}

export function getAccessToken() {
  let session = getAuthSession()
  if ((!session?.access_token || !session?.expires_at_ms) && typeof window !== 'undefined') {
    const fromHash = consumeAuthSessionFromUrlHash(window.location.hash)
    if (fromHash) {
      session = fromHash
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
    }
  }
  if (!session?.access_token) return ''
  if (!session?.expires_at_ms || Number(session.expires_at_ms) <= Date.now() + 15_000) return ''
  return session.access_token
}

export function isAuthenticated() {
  return Boolean(getAccessToken())
}

export function consumeAuthSessionFromUrlHash(hash = window.location.hash) {
  const parsed = parseHashParams(hash)
  const normalized = normalizeSession(parsed)
  if (!normalized) return null
  saveAuthSession(normalized)
  return normalized
}

export async function requestMagicLink({ email, inviteCode, redirectTo }) {
  if (!isAuthConfigured()) {
    throw new Error('Supabase設定が不足しています。VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。')
  }

  const cleanEmail = String(email || '').trim()
  if (!cleanEmail) throw new Error('メールアドレスを入力してください。')
  const cleanInviteCode = normalizeInviteCode(inviteCode)
  if (!cleanInviteCode) throw new Error('招待コードを入力してください。')
  if (!isValidInviteCode(cleanInviteCode)) throw new Error('招待コードは英数字8〜12文字で入力してください。')

  const res = await fetch(buildAuthUrl('/otp'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      email: cleanEmail,
      create_user: true,
      email_redirect_to: redirectTo,
      data: {
        invite_code: cleanInviteCode,
      },
      gotrue_meta_security: {},
      options: {
        emailRedirectTo: redirectTo,
        data: {
          invite_code: cleanInviteCode,
        },
      },
    }),
  })

  if (!res.ok) {
    let msg = '認証メールの送信に失敗しました。'
    try {
      const body = await res.json()
      msg = body?.msg || body?.message || body?.error_description || msg
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
}
