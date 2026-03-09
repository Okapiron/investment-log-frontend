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
    token_hash: params.get('token_hash') || '',
    error: params.get('error') || '',
    error_description: params.get('error_description') || '',
  }
}

function parseSearchParams(search) {
  const raw = String(search || '').replace(/^\?/, '')
  const params = new URLSearchParams(raw)
  return {
    access_token: params.get('access_token') || '',
    refresh_token: params.get('refresh_token') || '',
    token_type: params.get('token_type') || 'bearer',
    expires_in: Number(params.get('expires_in') || 0),
    type: params.get('type') || '',
    token_hash: params.get('token_hash') || '',
    error: params.get('error') || '',
    error_description: params.get('error_description') || '',
  }
}

function pickString(...values) {
  for (const value of values) {
    const clean = String(value || '').trim()
    if (clean) return clean
  }
  return ''
}

export function getAuthCallbackParams({ hash = window.location.hash, search = window.location.search } = {}) {
  const fromHash = parseHashParams(hash)
  const fromSearch = parseSearchParams(search)
  return {
    access_token: pickString(fromHash.access_token, fromSearch.access_token),
    refresh_token: pickString(fromHash.refresh_token, fromSearch.refresh_token),
    token_type: pickString(fromHash.token_type, fromSearch.token_type, 'bearer'),
    expires_in: Number(fromHash.expires_in || fromSearch.expires_in || 0),
    type: pickString(fromHash.type, fromSearch.type),
    token_hash: pickString(fromHash.token_hash, fromSearch.token_hash),
    error: pickString(fromHash.error, fromSearch.error),
    error_description: pickString(fromHash.error_description, fromSearch.error_description),
  }
}

export function hasAuthCallbackParams({ hash = window.location.hash, search = window.location.search } = {}) {
  const parsed = getAuthCallbackParams({ hash, search })
  return Boolean(
    parsed.access_token
      || parsed.refresh_token
      || parsed.token_hash
      || parsed.error
      || parsed.error_description
      || parsed.type,
  )
}

export function getAuthCallbackError({ hash = window.location.hash, search = window.location.search } = {}) {
  const parsed = getAuthCallbackParams({ hash, search })
  return pickString(parsed.error_description, parsed.error)
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
  const expiresInSec = Number(data.expires_in || 0)
  const expiresAtSec = Number(data.expires_at || 0)
  const expiresAtMs = Number.isFinite(expiresAtSec) && expiresAtSec > 0
    ? Math.max(nowMs + 30_000, expiresAtSec * 1000)
    : nowMs + Math.max(30, expiresInSec || 3600) * 1000
  return {
    access_token: String(data.access_token),
    refresh_token: String(data.refresh_token || ''),
    token_type: String(data.token_type || 'bearer'),
    expires_at_ms: expiresAtMs,
    created_at_ms: nowMs,
    auth_flow_type: String(data.type || ''),
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

export function getAuthFlowType() {
  return String(getAuthSession()?.auth_flow_type || '').trim()
}

export function getAccessToken() {
  let session = getAuthSession()
  if ((!session?.access_token || !session?.expires_at_ms) && typeof window !== 'undefined') {
    const fromUrl = consumeAuthSessionFromUrl({
      hash: window.location.hash,
      search: window.location.search,
    })
    if (fromUrl) {
      session = fromUrl
      window.history.replaceState({}, document.title, window.location.pathname)
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
  return consumeAuthSessionFromUrl({ hash, search: '' })
}

export function consumeAuthSessionFromUrl({ hash = window.location.hash, search = window.location.search } = {}) {
  const parsed = getAuthCallbackParams({ hash, search })
  const normalized = normalizeSession(parsed)
  if (!normalized) return null
  saveAuthSession(normalized)
  return normalized
}

export async function exchangeTokenHashForSession({ tokenHash, type = 'recovery' }) {
  if (!isAuthConfigured()) {
    throw new Error('Supabase設定が不足しています。VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。')
  }
  const cleanTokenHash = String(tokenHash || '').trim()
  const cleanType = String(type || '').trim()
  if (!cleanTokenHash || !cleanType) {
    throw new Error('認証リンク情報が不足しています。メール内のリンクを開き直してください。')
  }

  const res = await fetch(buildAuthUrl('/verify'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      token_hash: cleanTokenHash,
      type: cleanType,
    }),
  })

  if (!res.ok) {
    throw new Error(await parseAuthError(res, '認証リンクの検証に失敗しました。メール内のリンクを開き直してください。'))
  }

  const body = await res.json()
  const session = normalizeSession(body) || normalizeSession(body?.session)
  if (!session) {
    throw new Error('認証セッションを取得できませんでした。メール内のリンクを開き直してください。')
  }
  saveAuthSession(session)
  return session
}

async function parseAuthError(res, fallback = '認証に失敗しました。') {
  let msg = fallback
  try {
    const body = await res.json()
    msg = body?.msg || body?.message || body?.error_description || body?.error || msg
  } catch {
    // ignore
  }
  return String(msg || fallback)
}

export async function signInWithPassword({ email, password }) {
  if (!isAuthConfigured()) {
    throw new Error('Supabase設定が不足しています。VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。')
  }
  const cleanEmail = String(email || '').trim()
  const cleanPassword = String(password || '')
  if (!cleanEmail) throw new Error('メールアドレスを入力してください。')
  if (!cleanPassword) throw new Error('パスワードを入力してください。')

  const res = await fetch(buildAuthUrl('/token?grant_type=password'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      email: cleanEmail,
      password: cleanPassword,
    }),
  })

  if (!res.ok) {
    throw new Error(await parseAuthError(res, 'ログインに失敗しました。メールアドレスまたはパスワードを確認してください。'))
  }

  const body = await res.json()
  const session = normalizeSession(body)
  if (!session) throw new Error('ログインセッションを取得できませんでした。')
  saveAuthSession(session)
  return body?.user || null
}

export async function signUpWithPassword({ email, password, inviteCode = '' }) {
  if (!isAuthConfigured()) {
    throw new Error('Supabase設定が不足しています。VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。')
  }
  const cleanEmail = String(email || '').trim()
  const cleanPassword = String(password || '')
  const cleanInviteCode = normalizeInviteCode(inviteCode)
  if (!cleanEmail) throw new Error('メールアドレスを入力してください。')
  if (!cleanPassword) throw new Error('パスワードを入力してください。')
  if (cleanPassword.length < 8) throw new Error('パスワードは8文字以上で入力してください。')
  if (cleanInviteCode && !isValidInviteCode(cleanInviteCode)) throw new Error('招待コードは英数字8〜12文字で入力してください。')

  const payload = {
    email: cleanEmail,
    password: cleanPassword,
  }
  if (cleanInviteCode) {
    payload.data = { invite_code: cleanInviteCode }
    payload.options = { data: { invite_code: cleanInviteCode } }
  }

  const res = await fetch(buildAuthUrl('/signup'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(await parseAuthError(res, 'アカウント作成に失敗しました。'))
  }

  const body = await res.json()
  const session = normalizeSession(body)
  if (session) {
    saveAuthSession(session)
    return { needsEmailConfirmation: false }
  }
  if (body?.user) {
    return { needsEmailConfirmation: true }
  }
  throw new Error('アカウント作成後の状態を確認できませんでした。')
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

export async function requestPasswordReset({ email, redirectTo }) {
  if (!isAuthConfigured()) {
    throw new Error('Supabase設定が不足しています。VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。')
  }

  const cleanEmail = String(email || '').trim()
  if (!cleanEmail) throw new Error('メールアドレスを入力してください。')

  const url = new URL(buildAuthUrl('/recover'))
  if (redirectTo) {
    url.searchParams.set('redirect_to', String(redirectTo))
  }

  const payload = {
    email: cleanEmail,
  }
  if (redirectTo) {
    payload.email_redirect_to = String(redirectTo)
    payload.options = {
      emailRedirectTo: String(redirectTo),
      redirectTo: String(redirectTo),
    }
  }

  const res = await fetch(String(url), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(await parseAuthError(res, 'パスワード再設定メールの送信に失敗しました。'))
  }
}

export async function updatePassword({ password }) {
  if (!isAuthConfigured()) {
    throw new Error('Supabase設定が不足しています。VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。')
  }

  const cleanPassword = String(password || '')
  if (!cleanPassword) throw new Error('新しいパスワードを入力してください。')
  if (cleanPassword.length < 8) throw new Error('パスワードは8文字以上で入力してください。')

  const accessToken = getAccessToken()
  if (!accessToken) {
    throw new Error('再設定用セッションが確認できません。メール内のリンクを開き直してください。')
  }

  const res = await fetch(buildAuthUrl('/user'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      password: cleanPassword,
    }),
  })

  if (!res.ok) {
    throw new Error(await parseAuthError(res, 'パスワードの更新に失敗しました。'))
  }

  const session = getAuthSession()
  if (session?.access_token) {
    saveAuthSession({
      ...session,
      auth_flow_type: '',
    })
  }
}
