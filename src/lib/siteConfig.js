const rawSupportEmail = String(import.meta.env.VITE_SUPPORT_EMAIL || '').trim()
const rawContactFormUrl = String(import.meta.env.VITE_CONTACT_FORM_URL || '').trim()
const rawLegalOperatorName = String(import.meta.env.VITE_LEGAL_OPERATOR_NAME || '').trim()
const rawLegalRepresentative = String(import.meta.env.VITE_LEGAL_REPRESENTATIVE || '').trim()
const rawLegalAddress = String(import.meta.env.VITE_LEGAL_ADDRESS || '').trim()
const rawLegalGoverningLaw = String(import.meta.env.VITE_LEGAL_GOVERNING_LAW || '').trim()
const rawLegalJurisdiction = String(import.meta.env.VITE_LEGAL_JURISDICTION || '').trim()

function normalizeHttpUrl(value) {
  const v = String(value || '').trim()
  if (!v) return ''
  if (!/^https?:\/\//i.test(v)) return ''
  return v
}

export const SUPPORT_EMAIL = rawSupportEmail
export const CONTACT_FORM_URL = normalizeHttpUrl(rawContactFormUrl)
export const LEGAL_OPERATOR_NAME = rawLegalOperatorName || 'TradeTrace'
export const LEGAL_REPRESENTATIVE = rawLegalRepresentative || LEGAL_OPERATOR_NAME
export const LEGAL_ADDRESS = rawLegalAddress || '日本国内'
export const LEGAL_GOVERNING_LAW = rawLegalGoverningLaw || '日本法'
export const LEGAL_JURISDICTION = rawLegalJurisdiction || '東京地方裁判所'

export const HAS_LEGAL_OPERATOR_NAME = rawLegalOperatorName !== ''
export const HAS_LEGAL_ADDRESS = rawLegalAddress !== ''
export const HAS_SUPPORT_EMAIL = rawSupportEmail !== ''

export function getSupportMailto({ subject = '', body = '' } = {}) {
  if (!SUPPORT_EMAIL) return ''
  const q = new URLSearchParams()
  if (subject) q.set('subject', subject)
  if (body) q.set('body', body)
  const suffix = q.toString()
  return `mailto:${SUPPORT_EMAIL}${suffix ? `?${suffix}` : ''}`
}

export const SHOW_RUNTIME_PANEL = (() => {
  const v = String(import.meta.env.VITE_SHOW_RUNTIME_PANEL || '').trim().toLowerCase()
  return v === '1' || v === 'true'
})()
