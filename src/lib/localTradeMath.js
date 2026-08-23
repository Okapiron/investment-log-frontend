export function parseYmd(value) {
  const text = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const d = new Date(`${text}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function daysBetween(from, to) {
  const a = parseYmd(from)
  const b = parseYmd(to)
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function openSide(positionSide = 'long') {
  return positionSide === 'short' ? 'sell' : 'buy'
}

export function closeSide(positionSide = 'long') {
  return positionSide === 'short' ? 'buy' : 'sell'
}

export function fillFeeTotal(fill) {
  if (!fill) return 0
  if (fill.fee_total_jpy != null) return Number(fill.fee_total_jpy || 0)
  return Number(fill.fee || 0)
}

export function computeTradeFinancials(trade) {
  const positionSide = trade?.position_side || 'long'
  const open = (trade?.fills || []).find((fill) => fill?.side === openSide(positionSide))
  const close = (trade?.fills || []).find((fill) => fill?.side === closeSide(positionSide))
  if (!open || !close) {
    return {
      profit_jpy: null,
      profit_usd: null,
      profit_currency: 'JPY',
      gross_profit_jpy: null,
      net_profit_jpy: null,
      holding_days: null,
      is_open: true,
    }
  }
  const qty = Number(open.qty || 0)
  const openPrice = Number(open.price || 0)
  const closePrice = Number(close.price || 0)
  const gross = positionSide === 'short' ? (openPrice - closePrice) * qty : (closePrice - openPrice) * qty
  const openCost = fillFeeTotal(open)
  const closeCost = fillFeeTotal(close)
  const net = gross - openCost - closeCost
  const commission =
    Number(open.fee_commission_jpy || 0) + Number(close.fee_commission_jpy || 0)
  const tax = Number(open.fee_tax_jpy || 0) + Number(close.fee_tax_jpy || 0)
  const other = Number(open.fee_other_jpy || 0) + Number(close.fee_other_jpy || 0)
  return {
    profit_jpy: Number(net.toFixed(2)),
    profit_usd: null,
    profit_currency: 'JPY',
    gross_profit_jpy: Number(gross.toFixed(2)),
    net_profit_jpy: Number(net.toFixed(2)),
    open_leg_cost_jpy: openCost,
    close_leg_cost_jpy: closeCost,
    total_commission_jpy: commission,
    total_tax_jpy: tax,
    total_other_cost_jpy: other,
    holding_days: daysBetween(open.date, close.date),
    is_open: false,
  }
}

export function enrichTrade(trade) {
  const positionSide = trade?.position_side || 'long'
  const open = (trade?.fills || []).find((fill) => fill?.side === openSide(positionSide))
  const close = (trade?.fills || []).find((fill) => fill?.side === closeSide(positionSide))
  const financials = computeTradeFinancials({ ...trade, fills: trade?.fills || [] })
  return {
    ...trade,
    market: trade?.market || 'JP',
    position_side: positionSide,
    data_quality: trade?.data_quality || 'full',
    fills: trade?.fills || [],
    opened_at: trade?.opened_at || open?.date || '',
    closed_at: trade?.closed_at ?? close?.date ?? '',
    review_done: Boolean(trade?.review_done),
    reviewed_at: trade?.reviewed_at || null,
    rating: trade?.rating ?? null,
    tags: trade?.tags ?? null,
    notes_buy: trade?.notes_buy ?? null,
    notes_sell: trade?.notes_sell ?? null,
    notes_review: trade?.notes_review ?? null,
    strategy_timeframe: trade?.strategy_timeframe ?? null,
    entry_pattern: trade?.entry_pattern ?? null,
    entry_pattern_note: trade?.entry_pattern_note ?? null,
    entry_evaluation: trade?.entry_evaluation ?? null,
    exit_evaluation: trade?.exit_evaluation ?? null,
    exit_reason: trade?.exit_reason ?? null,
    exit_reason_note: trade?.exit_reason_note ?? null,
    next_action_note: trade?.next_action_note ?? null,
    chart_image_url: trade?.chart_image_url ?? null,
    is_partial_exit: Boolean(trade?.is_partial_exit),
    import_source: trade?.import_source || null,
    ...financials,
  }
}

export function principalValue(trade) {
  const buy = (trade?.fills || []).find((fill) => fill?.side === 'buy')
  if (!buy) return null
  const value = Number(buy.price || 0) * Number(buy.qty || 0) + fillFeeTotal(buy)
  return Number.isFinite(value) && value > 0 ? value : null
}
