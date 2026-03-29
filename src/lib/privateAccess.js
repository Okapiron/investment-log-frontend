const PRIVATE_MODE_RAW = String(import.meta.env.VITE_PRIVATE_MODE_ENABLED || '').trim().toLowerCase()
const PRIVATE_MODE_ENABLED = PRIVATE_MODE_RAW === '1' || PRIVATE_MODE_RAW === 'true'
const PRIVATE_ACCESS_STORAGE_KEY = 'tt_private_access_v1'
const PRIVATE_ACCESS_HEADER = 'X-TradeTrace-Secret'
const PRIVATE_SESSION_HOURS = Number(import.meta.env.VITE_PRIVATE_MODE_SESSION_HOURS || 12)

function nowMs() {
  return Date.now()
}

function ttlMs() {
  const hours = Number.isFinite(PRIVATE_SESSION_HOURS) && PRIVATE_SESSION_HOURS > 0 ? PRIVATE_SESSION_HOURS : 12
  return hours * 60 * 60 * 1000
}

export function isPrivateModeEnabled() {
  return PRIVATE_MODE_ENABLED
}

export function clearPrivateAccessSession() {
  try {
    localStorage.removeItem(PRIVATE_ACCESS_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function savePrivateAccessSecret(secret) {
  const value = String(secret || '').trim()
  if (!value) {
    clearPrivateAccessSession()
    return
  }
  try {
    localStorage.setItem(
      PRIVATE_ACCESS_STORAGE_KEY,
      JSON.stringify({
        secret: value,
        expires_at_ms: nowMs() + ttlMs(),
      }),
    )
  } catch {
    // ignore
  }
}

function readPrivateAccessSession() {
  try {
    const raw = localStorage.getItem(PRIVATE_ACCESS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.secret) return null
    if (Number(parsed?.expires_at_ms || 0) <= nowMs()) {
      clearPrivateAccessSession()
      return null
    }
    return parsed
  } catch {
    clearPrivateAccessSession()
    return null
  }
}

export function getPrivateAccessSecret() {
  return String(readPrivateAccessSession()?.secret || '').trim()
}

export function hasPrivateAccess() {
  if (!PRIVATE_MODE_ENABLED) return true
  return Boolean(getPrivateAccessSecret())
}

export function buildPrivateAccessHeaders(secret = getPrivateAccessSecret()) {
  const value = String(secret || '').trim()
  return value ? { [PRIVATE_ACCESS_HEADER]: value } : {}
}
