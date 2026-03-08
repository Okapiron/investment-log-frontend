const rawSupportEmail = String(import.meta.env.VITE_SUPPORT_EMAIL || '').trim()
const rawContactFormUrl = String(import.meta.env.VITE_CONTACT_FORM_URL || '').trim()

export const SUPPORT_EMAIL = rawSupportEmail
export const CONTACT_FORM_URL = rawContactFormUrl

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
