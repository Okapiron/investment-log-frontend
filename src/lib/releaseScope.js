function readEnvBool(name, fallback = false) {
  const raw = String(import.meta.env?.[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

const PUBLIC_V1_MODE = readEnvBool('VITE_PUBLIC_V1_MODE', true)
const SBI_IMPORTS_VISIBLE = readEnvBool('VITE_SHOW_SBI_IMPORTS', !PUBLIC_V1_MODE)
const SBI_IMPORTS_BETA_LABEL = readEnvBool('VITE_SBI_IMPORTS_BETA_LABEL', true)
const PRICE_SANITY_ENABLED = readEnvBool('VITE_ENABLE_PRICE_SANITY_CHECK', !PUBLIC_V1_MODE)
const TRADE_CHART_ENABLED = readEnvBool('VITE_ENABLE_TRADE_CHART', !PUBLIC_V1_MODE)

export function isPublicV1Mode() {
  return PUBLIC_V1_MODE
}

export function isSbiImportsVisible() {
  return SBI_IMPORTS_VISIBLE
}

export function shouldShowSbiBetaLabel() {
  return SBI_IMPORTS_VISIBLE && SBI_IMPORTS_BETA_LABEL
}

export function isPriceSanityCheckEnabled() {
  return PRICE_SANITY_ENABLED
}

export function isTradeChartEnabled() {
  return TRADE_CHART_ENABLED
}
