import { api, formatJPY, formatUSD } from './api'

const PRICE_TOLERANCE_RATE = 0.03
const TODAY_YMD = () => new Date().toISOString().slice(0, 10)
const BARS_CACHE_TTL_MS = 3 * 60 * 1000
const barsCache = new Map()
const barsInflight = new Map()

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function findBarByDateOrPrev(bars, date) {
  if (!Array.isArray(bars) || bars.length === 0 || !date) return null
  const exact = bars.find((b) => b?.time === date)
  if (exact) return exact

  let candidate = null
  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i]
    if (!bar?.time) continue
    if (bar.time <= date) candidate = bar
    if (bar.time > date) break
  }
  return candidate
}

function resolveReferenceBar({ market, bars, inputDate, latestDate }) {
  const exactBar = findBarByDate(bars, inputDate)
  if (exactBar) return { bar: exactBar, exactBar, fallbackBar: null }

  if (market === 'US' && latestDate && inputDate && inputDate > latestDate) {
    const latestBar = bars[bars.length - 1] || null
    return { bar: latestBar, exactBar: null, fallbackBar: latestBar }
  }

  const fallbackBar = findBarByDateOrPrev(bars, inputDate)
  return { bar: fallbackBar, exactBar: null, fallbackBar }
}

function findBarByDate(bars, date) {
  if (!Array.isArray(bars) || !date) return null
  return bars.find((b) => b?.time === date) || null
}

function formatPrice(market, value) {
  if (market === 'US') return formatUSD(value)
  return formatJPY(value)
}

function validateOneSide({ market, sideLabel, date, inputPrice, bar }) {
  const low = toNumber(bar?.low)
  const high = toNumber(bar?.high)
  if (low === null || high === null || low <= 0 || high <= 0) return null

  const min = low * (1 - PRICE_TOLERANCE_RATE)
  const max = high * (1 + PRICE_TOLERANCE_RATE)
  if (inputPrice >= min && inputPrice <= max) return null

  const rangeLabel = `${formatPrice(market, low)} - ${formatPrice(market, high)}`
  return `${sideLabel}価格が ${date} の実勢レンジ（${rangeLabel}）から外れています。入力値を確認してください。`
}

function collectDateWarnings({ sideLabel, inputDate, exactBar, fallbackBar, latestDate }) {
  if (!inputDate) return []
  if (exactBar) return []

  const warnings = []
  if (fallbackBar?.time) {
    warnings.push(`${sideLabel}日付 ${inputDate} の価格データがなく、${fallbackBar.time} を代替参照しました。`)
  } else {
    warnings.push(`${sideLabel}日付 ${inputDate} の価格データを参照できませんでした。`)
  }
  if (latestDate && inputDate > latestDate && inputDate === TODAY_YMD()) {
    warnings.push(`価格データの最新日付は ${latestDate} です。最新データ反映前の可能性があります。`)
  }
  return warnings
}

function collectDateWarningsByMarket({ market, sideLabel, inputDate, exactBar, fallbackBar, latestDate }) {
  if (market !== 'US') return collectDateWarnings({ sideLabel, inputDate, exactBar, fallbackBar, latestDate })
  if (!inputDate || exactBar) return []

  const warnings = []
  if (fallbackBar?.time) {
    if (latestDate && inputDate > latestDate) {
      warnings.push(
        `${sideLabel}日付 ${inputDate} は US 市場の最新確定日（${latestDate}）より新しいため、${fallbackBar.time} を参照しました。時差により当日終値が未反映の可能性があります。`
      )
    } else {
      warnings.push(`${sideLabel}日付 ${inputDate} の価格データがなく、${fallbackBar.time} を代替参照しました。`)
    }
  } else {
    warnings.push(`${sideLabel}日付 ${inputDate} の価格データを参照できませんでした。`)
  }
  if (latestDate && inputDate > latestDate && inputDate === TODAY_YMD()) {
    warnings.push(`US市場データの最新日付は ${latestDate} です。時差により当日データが反映前の可能性があります。`)
  }
  return warnings
}

async function fetchDailyBars(market, symbol) {
  const cacheKey = `${market}:${symbol}`.toUpperCase()
  const now = Date.now()
  const cached = barsCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.bars

  const inflight = barsInflight.get(cacheKey)
  if (inflight) return inflight

  const req = api
    .get(`/prices?market=${encodeURIComponent(market)}&symbol=${encodeURIComponent(symbol)}&interval=1d`)
    .then((pricesData) => {
      const bars = Array.isArray(pricesData?.bars) ? pricesData.bars : []
      barsCache.set(cacheKey, { bars, expiresAt: Date.now() + BARS_CACHE_TTL_MS })
      return bars
    })
    .finally(() => {
      barsInflight.delete(cacheKey)
    })

  barsInflight.set(cacheKey, req)
  return req
}

export async function assessPriceSanityAgainstDailyBars({ market, symbol, buyDate, buyPrice, sellDate, sellPrice }) {
  const normalizedMarket = String(market || '').trim()
  const normalizedSymbol = String(symbol || '').trim()
  if (!normalizedMarket || !normalizedSymbol) {
    return { blockingMessage: null, warnings: [] }
  }

  try {
    const bars = await fetchDailyBars(normalizedMarket, normalizedSymbol)
    if (bars.length === 0) {
      return { blockingMessage: null, warnings: ['価格データが取得できないため、価格チェックをスキップしました。'] }
    }

    const warnings = []
    const latestDate = bars[bars.length - 1]?.time || ''

    const buyRef = resolveReferenceBar({ market: normalizedMarket, bars, inputDate: buyDate, latestDate })
    const buyBar = buyRef.bar
    warnings.push(
      ...collectDateWarningsByMarket({
        market: normalizedMarket,
        sideLabel: '買付',
        inputDate: buyDate,
        exactBar: buyRef.exactBar,
        fallbackBar: buyRef.fallbackBar,
        latestDate,
      })
    )
    if (buyBar) {
      const buyMessage = validateOneSide({
        market: normalizedMarket,
        sideLabel: '買付',
        date: buyBar.time,
        inputPrice: Number(buyPrice),
        bar: buyBar,
      })
      if (buyMessage) warnings.push(buyMessage)
    }

    if (sellDate && sellPrice != null) {
      const sellRef = resolveReferenceBar({ market: normalizedMarket, bars, inputDate: sellDate, latestDate })
      const sellBar = sellRef.bar
      warnings.push(
        ...collectDateWarningsByMarket({
          market: normalizedMarket,
          sideLabel: '売却',
          inputDate: sellDate,
          exactBar: sellRef.exactBar,
          fallbackBar: sellRef.fallbackBar,
          latestDate,
        })
      )
      if (sellBar) {
        const sellMessage = validateOneSide({
          market: normalizedMarket,
          sideLabel: '売却',
          date: sellBar.time,
          inputPrice: Number(sellPrice),
          bar: sellBar,
        })
        if (sellMessage) warnings.push(sellMessage)
      }
    }

    return { blockingMessage: null, warnings: Array.from(new Set(warnings)) }
  } catch {
    return { blockingMessage: null, warnings: ['価格データ取得エラーのため、価格チェックをスキップしました。'] }
  }
}
