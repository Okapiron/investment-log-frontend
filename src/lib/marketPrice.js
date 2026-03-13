function toHalfWidthDigits(raw) {
  return String(raw || '').replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
}

function normalizeDecimalInput(raw) {
  const half = toHalfWidthDigits(raw)
    .replace(/[．。]/g, '.')
    .replace(/[，,、\s]/g, '')

  const cleaned = half.replace(/[^0-9.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  const head = cleaned.slice(0, firstDot + 1)
  const tail = cleaned.slice(firstDot + 1).replace(/\./g, '')
  return head + tail
}

function normalizeIntInput(raw) {
  const half = toHalfWidthDigits(raw).replace(/[，,、\s]/g, '')
  return half.replace(/[^0-9]/g, '')
}

function getDecimalPart(text) {
  const value = String(text || '')
  const idx = value.indexOf('.')
  if (idx < 0) return ''
  return value.slice(idx + 1)
}

export function normalizePriceInputByMarket(market, raw) {
  if (market === 'JP') return normalizeIntInput(raw)
  const normalized = normalizeDecimalInput(raw)
  const idx = normalized.indexOf('.')
  if (idx < 0) return normalized
  return `${normalized.slice(0, idx)}.${normalized.slice(idx + 1, idx + 3)}`
}

export function parsePriceText(text) {
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

export function marketPriceValidationError(market, text, sideLabel) {
  const valueText = String(text || '').trim()
  const n = parsePriceText(valueText)
  if (n == null || n <= 0) return `${sideLabel}は 0 より大きい数で入力してください`

  if (market === 'JP' && valueText.includes('.')) {
    return `${sideLabel}は日本株では整数で入力してください`
  }

  if (market === 'US') {
    const decimals = getDecimalPart(valueText)
    if (decimals.length > 2) {
      return `${sideLabel}は米国株では小数点以下2桁までです`
    }
  }

  return ''
}

export function marketPriceStep(market) {
  return market === 'US' ? '0.01' : '1'
}

export function marketPriceInputMode(market) {
  return market === 'US' ? 'decimal' : 'numeric'
}
