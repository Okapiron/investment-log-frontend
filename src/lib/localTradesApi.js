import { deleteLocal, getAllLocal, getLocal, putLocal } from './localDb'
import { enrichTrade, fillFeeTotal, principalValue } from './localTradeMath'

function parseTags(tags) {
  return String(tags || '').split(',').map((v) => v.trim()).filter(Boolean)
}

function statusOf(trade) {
  if (trade.is_open || !trade.closed_at) return 'open'
  return trade.review_done ? 'complete' : 'pending'
}

function matchesParams(trade, params = {}) {
  const q = String(params.q || params.search || '').trim().toLowerCase()
  if (q) {
    const haystack = `${trade.symbol || ''} ${trade.name || ''} ${trade.notes_buy || ''} ${trade.notes_sell || ''} ${trade.notes_review || ''} ${trade.next_action_note || ''}`.toLowerCase()
    if (!haystack.includes(q)) return false
  }
  if (params.market) {
    const markets = String(params.market).split(',').filter(Boolean)
    if (markets.length && !markets.includes(trade.market)) return false
  }
  if (params.status && params.status !== 'all' && statusOf(trade) !== params.status) return false
  if (params.rating) {
    const ratings = String(params.rating).split(',').filter(Boolean).map(Number)
    if (ratings.length && !ratings.includes(Number(trade.rating || 0))) return false
  }
  if (params.tag) {
    const wanted = String(params.tag).split(',').filter(Boolean)
    const tags = parseTags(trade.tags)
    if (wanted.length && !wanted.some((tag) => tags.includes(tag))) return false
  }
  if (params.win_only === '1' && Number(trade.profit_jpy || 0) <= 0) return false
  if (params.loss_only === '1' && Number(trade.profit_jpy || 0) >= 0) return false
  return true
}

function compareTrades(sort, dir) {
  const factor = dir === 'asc' ? 1 : -1
  return (a, b) => {
    let av = a.opened_at || ''
    let bv = b.opened_at || ''
    if (sort === 'sell_date') {
      av = a.closed_at || ''
      bv = b.closed_at || ''
    } else if (sort === 'profit') {
      av = Number(a.profit_jpy || 0)
      bv = Number(b.profit_jpy || 0)
    } else if (sort === 'roi') {
      av = localRoiPct(a) ?? -Infinity
      bv = localRoiPct(b) ?? -Infinity
    } else if (sort === 'holding') {
      av = Number(a.holding_days || 0)
      bv = Number(b.holding_days || 0)
    } else if (sort === 'rating') {
      av = Number(a.rating || 0)
      bv = Number(b.rating || 0)
    } else if (sort === 'name') {
      av = a.name || a.symbol || ''
      bv = b.name || b.symbol || ''
    } else if (sort === 'status') {
      av = statusOf(a)
      bv = statusOf(b)
    }
    if (typeof av === 'number' || typeof bv === 'number') return (Number(av) - Number(bv)) * factor
    return String(av).localeCompare(String(bv)) * factor
  }
}

function localRoiPct(trade) {
  if (trade.is_open) return null
  const principal = principalValue(trade)
  const profit = Number(trade.profit_jpy)
  if (!principal || !Number.isFinite(profit)) return null
  return (profit / principal) * 100
}

function statsFor(trades) {
  const closed = trades.filter((trade) => !trade.is_open && trade.closed_at)
  const wins = closed.filter((trade) => Number(trade.profit_jpy || 0) > 0)
  const totalProfit = closed.reduce((sum, trade) => sum + Number(trade.profit_jpy || 0), 0)
  const holdingValues = closed.map((trade) => Number(trade.holding_days)).filter(Number.isFinite)
  const roiValues = closed.map(localRoiPct).filter((v) => v != null && Number.isFinite(v))
  const ratings = trades.map((trade) => Number(trade.rating)).filter((v) => Number.isFinite(v) && v > 0)
  return {
    total_profit_jpy: totalProfit,
    total_profit_usd: 0,
    win_rate: closed.length ? (wins.length / closed.length) * 100 : null,
    avg_holding_days: holdingValues.length ? holdingValues.reduce((a, b) => a + b, 0) / holdingValues.length : null,
    avg_roi_pct: roiValues.length ? roiValues.reduce((a, b) => a + b, 0) / roiValues.length : null,
    avg_rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    pending_review_count: closed.filter((trade) => !trade.review_done).length,
  }
}

export async function listLocalTrades(params = {}) {
  const limit = Number(params.limit || 20)
  const offset = Number(params.offset || 0)
  const all = (await getAllLocal('trades')).map(enrichTrade).filter((trade) => matchesParams(trade, params))
  const sort = String(params.sort || 'buy_date')
  const dir = String(params.sort_dir || 'desc')
  const sorted = all.sort(compareTrades(sort, dir))
  return {
    items: sorted.slice(offset, offset + limit),
    total: sorted.length,
    limit,
    offset,
    stats: statsFor(all),
  }
}

export async function getLocalTrade(id) {
  const numericId = Number(id)
  const trade = await getLocal('trades', numericId)
  return trade ? enrichTrade(trade) : null
}

export async function patchLocalTrade(id, payload) {
  const trade = await getLocalTrade(id)
  if (!trade) throw new Error('ローカルデータが見つかりません。')
  const now = new Date().toISOString()
  let next = {
    ...trade,
    rating: payload.rating !== undefined ? payload.rating : trade.rating,
    tags: payload.tags !== undefined ? payload.tags : trade.tags,
    notes_buy: payload.notes_buy !== undefined ? payload.notes_buy : trade.notes_buy,
    notes_sell: payload.notes_sell !== undefined ? payload.notes_sell : trade.notes_sell,
    notes_review: payload.notes_review !== undefined ? payload.notes_review : trade.notes_review,
    strategy_timeframe: payload.strategy_timeframe !== undefined ? payload.strategy_timeframe : trade.strategy_timeframe,
    entry_pattern: payload.entry_pattern !== undefined ? payload.entry_pattern : trade.entry_pattern,
    entry_pattern_note: payload.entry_pattern_note !== undefined ? payload.entry_pattern_note : trade.entry_pattern_note,
    entry_evaluation: payload.entry_evaluation !== undefined ? payload.entry_evaluation : trade.entry_evaluation,
    exit_evaluation: payload.exit_evaluation !== undefined ? payload.exit_evaluation : trade.exit_evaluation,
    exit_reason: payload.exit_reason !== undefined ? payload.exit_reason : trade.exit_reason,
    exit_reason_note: payload.exit_reason_note !== undefined ? payload.exit_reason_note : trade.exit_reason_note,
    next_action_note: payload.next_action_note !== undefined ? payload.next_action_note : trade.next_action_note,
    review_done: payload.review_done !== undefined ? Boolean(payload.review_done) : trade.review_done,
    reviewed_at: payload.reviewed_at !== undefined ? payload.reviewed_at : trade.reviewed_at,
    updated_at: now,
  }
  if (payload.buy_date && payload.buy_price && payload.buy_qty) {
    const buy = {
      ...(next.fills || []).find((fill) => fill.side === 'buy'),
      id: Number(next.id) * 10 + 1,
      trade_id: Number(next.id),
      side: 'buy',
      date: payload.buy_date,
      price: Number(payload.buy_price),
      qty: Number(payload.buy_qty),
      fee: fillFeeTotal((next.fills || []).find((fill) => fill.side === 'buy')),
    }
    const fills = [buy]
    if (payload.sell_date && payload.sell_price && payload.sell_qty) {
      fills.push({
        ...(next.fills || []).find((fill) => fill.side === 'sell'),
        id: Number(next.id) * 10 + 2,
        trade_id: Number(next.id),
        side: 'sell',
        date: payload.sell_date,
        price: Number(payload.sell_price),
        qty: Number(payload.sell_qty),
        fee: fillFeeTotal((next.fills || []).find((fill) => fill.side === 'sell')),
      })
    }
    next.fills = fills
    next.opened_at = buy.date
    next.closed_at = fills.find((fill) => fill.side === 'sell')?.date || ''
  }
  if (!next.closed_at) {
    next.rating = null
    next.review_done = false
    next.reviewed_at = null
  }
  next = enrichTrade(next)
  await putLocal('trades', next)
  return next
}

export async function updateLocalTradeReview(id, reviewDone, reviewedAt = null) {
  return patchLocalTrade(id, { review_done: Boolean(reviewDone), reviewed_at: reviewDone ? reviewedAt : null })
}

export async function deleteLocalTrade(id) {
  await deleteLocal('trades', Number(id))
}
