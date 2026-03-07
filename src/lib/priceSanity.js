import { api, formatJPY, formatUSD } from './api'

const PRICE_TOLERANCE_RATE = 0.03

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

export async function validatePriceSanityAgainstDailyBars({ market, symbol, buyDate, buyPrice, sellDate, sellPrice }) {
  const normalizedMarket = String(market || '').trim()
  const normalizedSymbol = String(symbol || '').trim()
  if (!normalizedMarket || !normalizedSymbol) return null

  try {
    const pricesData = await api.get(
      `/prices?market=${encodeURIComponent(normalizedMarket)}&symbol=${encodeURIComponent(normalizedSymbol)}&interval=1d`
    )
    const bars = Array.isArray(pricesData?.bars) ? pricesData.bars : []
    if (bars.length === 0) return null

    const buyBar = findBarByDateOrPrev(bars, buyDate)
    if (buyBar) {
      const buyMessage = validateOneSide({
        market: normalizedMarket,
        sideLabel: 'BUY',
        date: buyBar.time,
        inputPrice: Number(buyPrice),
        bar: buyBar,
      })
      if (buyMessage) return buyMessage
    }

    if (sellDate && sellPrice != null) {
      const sellBar = findBarByDateOrPrev(bars, sellDate)
      if (sellBar) {
        const sellMessage = validateOneSide({
          market: normalizedMarket,
          sideLabel: 'SELL',
          date: sellBar.time,
          inputPrice: Number(sellPrice),
          bar: sellBar,
        })
        if (sellMessage) return sellMessage
      }
    }

    return null
  } catch {
    // 価格APIの一時エラーで保存を止めない
    return null
  }
}
