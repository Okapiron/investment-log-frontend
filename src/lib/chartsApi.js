import { api } from './api'

const TIMEFRAME_INTERVALS = {
  daily: '1d',
  weekly: '1w',
  monthly: '1m',
}

function normalizeBars(bars) {
  if (!Array.isArray(bars)) return []
  return bars
    .map((bar) => ({
      time: String(bar?.time || bar?.date || '').slice(0, 10),
      open: Number(bar?.open),
      high: Number(bar?.high),
      low: Number(bar?.low),
      close: Number(bar?.close),
      volume: Number(bar?.volume || 0),
    }))
    .filter(
      (bar) =>
        bar.time &&
        Number.isFinite(bar.open) &&
        Number.isFinite(bar.high) &&
        Number.isFinite(bar.low) &&
        Number.isFinite(bar.close),
    )
}

async function getPriceSeries({ market, symbol, interval }) {
  const qs = new URLSearchParams({
    market: String(market || 'JP'),
    symbol: String(symbol || ''),
    interval,
  })
  const result = await api.get(`/api/v1/prices?${qs.toString()}`)
  return normalizeBars(result?.bars)
}

export async function getTradeReviewCharts({ market = 'JP', symbol }) {
  if (!String(symbol || '').trim()) {
    return { daily: [], weekly: [], monthly: [] }
  }

  const daily = await getPriceSeries({ market, symbol, interval: TIMEFRAME_INTERVALS.daily })
  const [weekly, monthly] = await Promise.all([
    getPriceSeries({ market, symbol, interval: TIMEFRAME_INTERVALS.weekly }),
    getPriceSeries({ market, symbol, interval: TIMEFRAME_INTERVALS.monthly }),
  ])

  return { daily, weekly, monthly }
}

export async function getEpisodeCharts({ market = 'JP', symbol, refresh = false }) {
  if (!String(symbol || '').trim()) {
    return { daily: [], weekly: [], monthly: [], cache: null }
  }
  const query = refresh ? '?refresh=true' : ''
  const result = await api.get(
    `/api/v2/charts/${encodeURIComponent(market)}/${encodeURIComponent(symbol)}${query}`,
  )
  return {
    daily: normalizeBars(result?.daily),
    weekly: normalizeBars(result?.weekly),
    monthly: normalizeBars(result?.monthly),
    cache: result?.cache || null,
  }
}

export { TIMEFRAME_INTERVALS }
