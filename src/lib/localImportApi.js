import { getAllLocal, nextLocalId, putLocal, putManyLocal } from './localDb'
import { enrichTrade } from './localTradeMath'

const HEADER_ALIASES = {
  date: ['約定日', '受渡日', '取引日'],
  symbol: ['銘柄コード', 'コード', '銘柄ｺｰﾄﾞ'],
  name: ['銘柄', '銘柄名', '銘柄名称'],
  side: ['売買区分', '売買'],
  qty: ['約定数量', '数量', '株数', '約定株数', '約定数', '数量［株］', '数量[株]'],
  price: ['約定単価', '単価', '価格', '約定価格', '単価［円］', '単価[円]'],
  fee: ['手数料', '手数料等', '委託手数料', '手数料［円］', '手数料[円]'],
  other_fee: ['諸費用', '諸費用［円］', '諸費用[円]', '手数料・諸費用'],
  tax_fee: ['税金等', '税金等［円］', '税金等[円]'],
  trade_type: ['取引区分', '取引種別', '取引', '商品', '現物信用', '口座区分'],
  credit_type: ['信用区分', '新規返済', '建区分', '新規建区分', '信用新規建区分'],
  market: ['市場', '市場名', '市場名称'],
  build_date: ['建約定日', '建日付'],
  build_price: ['建単価［円］', '建単価[円]', '建単価'],
  build_fee: ['建手数料［円］', '建手数料[円]', '建手数料'],
  build_fee_tax: ['建手数料消費税［円］', '建手数料消費税[円]', '建手数料消費税'],
  settlement_amount: ['受渡金額［円］', '受渡金額[円]', '受渡金額'],
}

function normalizeHeader(text) {
  return String(text || '').trim().replace(/^\uFEFF/, '')
}

function parseCsv(text) {
  const rows = []
  const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  let row = []
  let value = ''
  let inQuotes = false
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i]
    const next = normalized[i + 1]
    if (ch === '"') {
      if (inQuotes && next === '"') {
        value += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      row.push(value)
      value = ''
      continue
    }
    if (ch === '\n' && !inQuotes) {
      row.push(value)
      rows.push(row)
      row = []
      value = ''
      continue
    }
    value += ch
  }
  if (value || row.length) {
    row.push(value)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => String(cell || '').trim()))
}

function mapHeaders(headers) {
  const byName = new Map(headers.map((h) => [normalizeHeader(h), h]))
  const mapped = {}
  Object.entries(HEADER_ALIASES).forEach(([key, aliases]) => {
    const found = aliases.find((alias) => byName.has(alias))
    if (found) mapped[key] = byName.get(found)
  })
  return mapped
}

function clean(value) {
  return String(value || '').trim()
}

function parseDate(value) {
  const text = clean(value).replace('年', '-').replace('月', '-').replace('日', '').replace(/\//g, '-').replace(/\./g, '-')
  const m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return null
  return `${Number(m[1]).toString().padStart(4, '0')}-${Number(m[2]).toString().padStart(2, '0')}-${Number(m[3]).toString().padStart(2, '0')}`
}

function parseNumber(value) {
  let text = clean(value)
    .replace(/,/g, '')
    .replace(/円/g, '')
    .replace(/株/g, '')
    .replace(/口/g, '')
    .replace(/￥/g, '')
    .replace(/¥/g, '')
    .trim()
  if (!text || text === '-' || text === '—') return null
  const sign = text.startsWith('-') ? -1 : 1
  text = text.replace(/^[+-]/, '')
  if (!/^\d+(\.\d+)?$/.test(text)) return null
  const n = sign * Number(text)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

function parseIntJp(value) {
  const n = parseNumber(value)
  return n == null ? null : Math.round(n)
}

function parseSide(value) {
  const text = clean(value)
  if (text.includes('買')) return 'buy'
  if (text.includes('売')) return 'sell'
  return null
}

function rowValue(row, headers, key) {
  return clean(row[headers[key]] || '')
}

function tradeContext(row, headers) {
  return [rowValue(row, headers, 'trade_type'), rowValue(row, headers, 'credit_type'), rowValue(row, headers, 'side')]
}

function parseTradeKind(row, headers) {
  const combined = tradeContext(row, headers).filter(Boolean).join(' ')
  if (combined.includes('信用') || ['買建', '売建', '返済', '売埋', '買埋'].some((m) => combined.includes(m))) return 'credit'
  return 'spot'
}

function isCreditCloseRow(row, headers) {
  const combined = tradeContext(row, headers).filter(Boolean).join(' ')
  return ['信用返済', '返済売', '売埋', '返済買', '買埋'].some((m) => combined.includes(m))
}

function parsePositionSide(row, headers) {
  const combined = tradeContext(row, headers).filter(Boolean).join(' ')
  return ['売建', '新規売', '返済買', '買埋'].some((m) => combined.includes(m)) ? 'short' : 'long'
}

function parseRowSide(row, headers) {
  const side = parseSide(rowValue(row, headers, 'side'))
  if (side) return side
  const combined = [rowValue(row, headers, 'credit_type'), rowValue(row, headers, 'trade_type')].filter(Boolean).join(' ')
  if (['買建', '新規買', '返済買', '買埋'].some((m) => combined.includes(m))) return 'buy'
  if (['売建', '新規売', '返済売', '売埋'].some((m) => combined.includes(m))) return 'sell'
  return null
}

function isSupportedDomesticStock(row, headers) {
  const [tradeType, creditType, sideText] = tradeContext(row, headers)
  const market = clean(row[headers.market] || '')
  if (tradeType) {
    if (tradeType.includes('先物') || tradeType.includes('オプション') || tradeType.includes('投信')) return false
    if (tradeType.includes('信用')) {
      const combined = [tradeType, creditType, sideText].filter(Boolean).join(' ')
      return ['買建', '新規買', '返済売', '売埋', '売建', '新規売', '返済買', '買埋', '新規', '返済'].some((m) => combined.includes(m)) || Boolean(parseSide(sideText))
    }
  }
  if (market && (market.includes('米') || market.toUpperCase().includes('NASDAQ') || market.toUpperCase().includes('NYSE'))) return false
  return true
}

function hashText(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `local_${(h >>> 0).toString(16).padStart(8, '0')}`
}

function priceText(value) {
  return Number(value || 0).toFixed(2)
}

function rowSignature(row) {
  return hashText(`${row.symbol}|${row.name}|${row.side}|${row.date}|${row.qty}|${priceText(row.price)}|${row.fee}`)
}

function positionKey(symbol, positionSide, date, price) {
  return hashText(['rakuten', 'JP', positionSide, symbol, date, priceText(price)].join('|'))
}

function candidateSignature(openLot, sequence, matchedQty, openFeeTotal, sell = null) {
  const parts = [
    'rakuten',
    'JP',
    sell ? 'closed' : 'open',
    openLot.symbol,
    openLot.source_position_key,
    String(sequence),
    openLot.date,
    String(matchedQty),
    priceText(openLot.price),
    String(openFeeTotal),
    (openLot.row_signatures || []).join(','),
  ]
  if (sell) {
    parts.push(sell.date, String(matchedQty), priceText(sell.price), String(sell.fee), (sell.row_signatures || []).join(','))
  }
  return hashText(parts.join('|'))
}

function aggregateRows(rows) {
  const grouped = new Map()
  rows.forEach((row) => {
    const key = [
      row.symbol,
      row.trade_kind,
      row.side,
      row.position_side,
      row.date,
      priceText(row.price),
      row.fee,
      row.fee_commission_jpy,
      row.fee_tax_jpy,
      row.fee_other_jpy,
      row.build_date || '',
      row.build_price == null ? '' : priceText(row.build_price),
      row.build_fee,
      row.build_fee_commission_jpy,
      row.build_fee_tax_jpy,
      row.settlement_amount_jpy ?? '',
      row.is_credit_close ? '1' : '0',
    ].join('|')
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(row)
  })

  const aggregated = []
  grouped.forEach((items) => {
    const first = items[0]
    const qty = items.reduce((sum, item) => sum + item.qty, 0)
    const weighted = items.reduce((sum, item) => sum + item.price * item.qty, 0)
    const buildWeighted = items.reduce((sum, item) => sum + Number(item.build_price || 0) * item.qty, 0)
    aggregated.push({
      ...first,
      qty,
      price: Math.round((weighted / Math.max(1, qty)) * 100) / 100,
      fee: items.reduce((sum, item) => sum + item.fee, 0),
      fee_commission_jpy: items.reduce((sum, item) => sum + item.fee_commission_jpy, 0),
      fee_tax_jpy: items.reduce((sum, item) => sum + item.fee_tax_jpy, 0),
      fee_other_jpy: items.reduce((sum, item) => sum + item.fee_other_jpy, 0),
      build_price: items.some((item) => item.build_price != null) ? Math.round((buildWeighted / Math.max(1, qty)) * 100) / 100 : null,
      build_fee: items.reduce((sum, item) => sum + item.build_fee, 0),
      build_fee_commission_jpy: items.reduce((sum, item) => sum + item.build_fee_commission_jpy, 0),
      build_fee_tax_jpy: items.reduce((sum, item) => sum + item.build_fee_tax_jpy, 0),
      settlement_amount_jpy: items.some((item) => item.settlement_amount_jpy != null)
        ? items.reduce((sum, item) => sum + Number(item.settlement_amount_jpy || 0), 0)
        : null,
      lines: items.map((item) => item.line).sort((a, b) => a - b),
      row_signatures: items.map(rowSignature).sort(),
    })
  })
  return aggregated.sort((a, b) => `${a.symbol}|${a.date}|${a.side}`.localeCompare(`${b.symbol}|${b.date}|${b.side}`))
}

function allocateFee(total, portionQty, totalQty) {
  if (!total || !portionQty || !totalQty) return 0
  if (portionQty >= totalQty) return Math.max(0, Math.round(total))
  return Math.max(0, Math.min(Math.round(total), Math.round((total * portionQty) / totalQty)))
}

function allocateBreakdown(row, portionQty, totalQty) {
  const commission = allocateFee(row.fee_commission_jpy, portionQty, totalQty)
  const tax = allocateFee(row.fee_tax_jpy, portionQty, totalQty)
  const other = allocateFee(row.fee_other_jpy, portionQty, totalQty)
  const total = allocateFee(row.fee, portionQty, totalQty)
  return { commission, tax, other, total: Math.max(total, commission + tax + other) }
}

function fillPreview(row, qty, fee) {
  return {
    date: row.date,
    price: row.price,
    qty,
    fee: fee.total,
    fee_commission_jpy: fee.commission,
    fee_tax_jpy: fee.tax,
    fee_other_jpy: fee.other,
    fee_total_jpy: fee.total,
    settlement_amount_jpy: row.settlement_amount_jpy ?? null,
  }
}

function candidateFromOpenLot(openLot, sequence, qty, openFee, closeRow = null, closeFee = null, flags = {}) {
  const buy = openLot.position_side === 'short'
    ? closeRow ? fillPreview(closeRow, qty, closeFee) : null
    : fillPreview(openLot, qty, openFee)
  const sell = openLot.position_side === 'short'
    ? fillPreview(openLot, qty, openFee)
    : closeRow ? fillPreview(closeRow, qty, closeFee) : null
  return {
    source_signature: candidateSignature(openLot, sequence, qty, openFee.total, closeRow),
    source_position_key: openLot.source_position_key,
    source_lot_sequence: sequence,
    symbol: openLot.symbol,
    name: openLot.name || closeRow?.name || openLot.symbol,
    market: 'JP',
    trade_kind: openLot.trade_kind,
    position_side: openLot.position_side,
    buy,
    sell,
    source_lines: [...new Set([...(openLot.lines || []), ...(closeRow?.lines || [])])].sort((a, b) => a - b),
    already_imported: false,
    is_partial_exit: Boolean(flags.is_partial_exit),
    remaining_qty_after_sell: Math.max(0, Number(flags.remaining_qty_after_sell || 0)),
    build_info_fallback_used: Boolean(flags.build_info_fallback_used),
  }
}

function syntheticOpenLot(closeRow) {
  const openDate = closeRow.build_date || closeRow.date
  const openPrice = closeRow.build_price || closeRow.price
  const key = positionKey(closeRow.symbol, closeRow.position_side, openDate, openPrice)
  return {
    symbol: closeRow.symbol,
    name: closeRow.name,
    trade_kind: closeRow.trade_kind,
    position_side: closeRow.position_side,
    date: openDate,
    qty: closeRow.qty,
    price: openPrice,
    remaining_qty: closeRow.qty,
    fee: closeRow.build_fee || 0,
    fee_commission_jpy: closeRow.build_fee_commission_jpy || 0,
    fee_tax_jpy: closeRow.build_fee_tax_jpy || 0,
    fee_other_jpy: 0,
    lines: [],
    row_signatures: [`synthetic:${key}`],
    source_position_key: key,
    settlement_amount_jpy: null,
    next_sequence: 1,
  }
}

function pairRoundTrips(rows) {
  const candidates = []
  const skipped = []
  const byKey = new Map()
  rows.forEach((row) => {
    const key = `${row.symbol}|${row.position_side}|${row.trade_kind}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(row)
  })

  byKey.forEach((items) => {
    const positionSide = items[0]?.position_side || 'long'
    const openSide = positionSide === 'short' ? 'sell' : 'buy'
    const openLots = []
    const sorted = [...items].sort((a, b) => `${a.date}|${a.side === openSide ? '0' : '1'}`.localeCompare(`${b.date}|${b.side === openSide ? '0' : '1'}`))
    sorted.forEach((item) => {
      if (item.side === openSide) {
        openLots.push({
          ...item,
          remaining_qty: item.qty,
          source_position_key: positionKey(item.symbol, item.position_side, item.date, item.price),
          next_sequence: 1,
        })
        return
      }

      let remainingCloseQty = item.qty
      while (remainingCloseQty > 0) {
        let lot = null
        let fallback = false
        if (item.build_date && item.build_price) {
          lot = openLots.find((candidate) => candidate.date === item.build_date && Number(candidate.price) === Number(item.build_price)) || null
        }
        if (!lot) {
          lot = openLots.find((candidate) => candidate.remaining_qty === remainingCloseQty) || openLots[0] || null
          fallback = Boolean(lot)
        }
        if (!lot && item.is_credit_close && item.build_date && item.build_price) {
          lot = syntheticOpenLot(item)
        }
        if (!lot) {
          skipped.push({
            line: item.lines?.[0] || null,
            code: 'sell_without_buy',
            message: `${item.symbol} の返済に対応する建玉が見つかりません。`,
          })
          break
        }

        const lotQtyBefore = lot.remaining_qty
        const closeQtyBefore = remainingCloseQty
        const matchedQty = Math.min(lotQtyBefore, closeQtyBefore)
        const openFee = allocateBreakdown(lot, matchedQty, lotQtyBefore)
        const closeFee = allocateBreakdown(item, matchedQty, closeQtyBefore)
        const remainingAfterSell = Math.max(0, lotQtyBefore - matchedQty)
        const sequence = lot.next_sequence || 1
        lot.next_sequence = sequence + 1
        candidates.push(candidateFromOpenLot(lot, sequence, matchedQty, openFee, item, closeFee, {
          is_partial_exit: lot.qty !== matchedQty || item.qty !== matchedQty,
          remaining_qty_after_sell: remainingAfterSell,
          build_info_fallback_used: fallback,
        }))

        lot.remaining_qty -= matchedQty
        lot.fee = Math.max(0, Number(lot.fee || 0) - openFee.total)
        lot.fee_commission_jpy = Math.max(0, Number(lot.fee_commission_jpy || 0) - openFee.commission)
        lot.fee_tax_jpy = Math.max(0, Number(lot.fee_tax_jpy || 0) - openFee.tax)
        lot.fee_other_jpy = Math.max(0, Number(lot.fee_other_jpy || 0) - openFee.other)
        remainingCloseQty -= matchedQty
        if (lot.remaining_qty <= 0 && openLots.includes(lot)) openLots.splice(openLots.indexOf(lot), 1)
      }
    })

    openLots.forEach((lot) => {
      const sequence = lot.next_sequence || 1
      candidates.push(candidateFromOpenLot(lot, sequence, lot.remaining_qty, {
        total: lot.fee,
        commission: lot.fee_commission_jpy,
        tax: lot.fee_tax_jpy,
        other: lot.fee_other_jpy,
      }, null, null, {
        is_partial_exit: lot.remaining_qty !== lot.qty,
        remaining_qty_after_sell: lot.remaining_qty,
      }))
    })
  })

  candidates.sort((a, b) => {
    const aDate = a.buy?.date || a.sell?.date || ''
    const bDate = b.buy?.date || b.sell?.date || ''
    return `${aDate}|${a.symbol}|${a.sell ? '0' : '1'}|${a.source_lot_sequence}`.localeCompare(`${bDate}|${b.symbol}|${b.sell ? '0' : '1'}|${b.source_lot_sequence}`)
  })
  return { candidates, skipped, errors: [] }
}

function rowObject(headers, cells) {
  const obj = {}
  headers.forEach((header, index) => {
    obj[header] = cells[index] || ''
  })
  return obj
}

export async function previewRakutenCsvLocal(filename, content) {
  const parsed = parseCsv(content)
  const headerRow = parsed[0] || []
  const headers = mapHeaders(headerRow)
  const required = ['date', 'symbol', 'name', 'side', 'qty', 'price']
  const missing = required.filter((key) => !headers[key])
  if (missing.length) {
    return {
      broker: 'rakuten',
      market_scope: 'JP',
      filename,
      candidate_count: 0,
      skipped_count: 0,
      error_count: 1,
      candidates: [],
      skipped: [],
      errors: [{ line: null, code: 'missing_headers', message: '楽天証券の国内株式CSVを選択してください。必要な列を確認できませんでした。' }],
    }
  }

  const rows = []
  const skipped = []
  const errors = []
  parsed.slice(1).forEach((cells, offset) => {
    const line = offset + 2
    const row = rowObject(headerRow, cells)
    if (!Object.values(row).some((v) => clean(v))) return
    if (!isSupportedDomesticStock(row, headers)) {
      skipped.push({ line, code: 'unsupported_product', message: '国内株の現物・信用取引以外の行は対象外のためスキップしました。' })
      return
    }
    const date = parseDate(row[headers.date])
    const symbol = clean(row[headers.symbol])
    const name = clean(row[headers.name])
    const side = parseRowSide(row, headers)
    const qty = parseIntJp(row[headers.qty])
    const price = parseNumber(row[headers.price])
    if (!date || !symbol || !name || !side || qty == null || price == null || qty <= 0 || price <= 0) {
      errors.push({ line, code: 'invalid_row', message: '日付・銘柄・売買・数量・価格のいずれかを解釈できませんでした。' })
      return
    }
    const feeCommission = parseIntJp(row[headers.fee]) || 0
    const feeOther = parseIntJp(row[headers.other_fee]) || 0
    const feeTax = parseIntJp(row[headers.tax_fee]) || 0
    const buildFeeCommission = parseIntJp(row[headers.build_fee]) || 0
    const buildFeeTax = parseIntJp(row[headers.build_fee_tax]) || 0
    rows.push({
      line,
      symbol,
      name,
      trade_kind: parseTradeKind(row, headers),
      side,
      position_side: parsePositionSide(row, headers),
      date,
      qty,
      price,
      fee: feeCommission + feeOther + feeTax,
      fee_commission_jpy: feeCommission,
      fee_tax_jpy: feeTax,
      fee_other_jpy: feeOther,
      build_date: parseDate(row[headers.build_date]),
      build_price: parseNumber(row[headers.build_price]),
      build_fee: buildFeeCommission + buildFeeTax,
      build_fee_commission_jpy: buildFeeCommission,
      build_fee_tax_jpy: buildFeeTax,
      is_credit_close: isCreditCloseRow(row, headers),
      settlement_amount_jpy: parseIntJp(row[headers.settlement_amount]),
    })
  })

  const paired = pairRoundTrips(aggregateRows(rows))
  const existingCandidates = await getAllLocal('importCandidates')
  const existingSignatures = new Set(existingCandidates.map((item) => item.source_signature))
  const candidates = paired.candidates.map((item) => ({ ...item, already_imported: existingSignatures.has(item.source_signature) }))
  return {
    broker: 'rakuten',
    market_scope: 'JP',
    filename,
    candidate_count: candidates.length,
    skipped_count: skipped.length + paired.skipped.length,
    error_count: errors.length + paired.errors.length,
    candidates,
    skipped: [...skipped, ...paired.skipped],
    errors: [...errors, ...paired.errors],
  }
}

function fillFromPreview(fill, side, id, tradeId) {
  return {
    id,
    trade_id: tradeId,
    side,
    date: fill.date,
    price: Number(fill.price),
    qty: Number(fill.qty),
    fee: Number(fill.fee || fill.fee_total_jpy || 0),
    fee_commission_jpy: fill.fee_commission_jpy ?? null,
    fee_tax_jpy: fill.fee_tax_jpy ?? null,
    fee_other_jpy: fill.fee_other_jpy ?? null,
    fee_total_jpy: fill.fee_total_jpy ?? fill.fee ?? 0,
  }
}

function tradeFromCandidate(item, id, now) {
  const fills = []
  if (item.buy) fills.push(fillFromPreview(item.buy, 'buy', id * 10 + 1, id))
  if (item.sell) fills.push(fillFromPreview(item.sell, 'sell', id * 10 + 2, id))
  return enrichTrade({
    id,
    source_signature: item.source_signature,
    source_position_key: item.source_position_key,
    source_lot_sequence: item.source_lot_sequence,
    market: 'JP',
    position_side: item.position_side || 'long',
    data_quality: 'full',
    broker_profit_jpy: null,
    symbol: item.symbol,
    name: item.name || null,
    notes_buy: null,
    notes_sell: null,
    notes_review: null,
    strategy_timeframe: null,
    entry_pattern: null,
    entry_pattern_note: null,
    entry_evaluation: null,
    exit_evaluation: null,
    exit_reason: null,
    exit_reason_note: null,
    next_action_note: null,
    rating: null,
    tags: null,
    chart_image_url: null,
    review_done: false,
    reviewed_at: null,
    opened_at: item.buy?.date || item.sell?.date || '',
    closed_at: item.sell && item.buy ? item.sell.date : '',
    created_at: now,
    updated_at: now,
    fills,
    import_source: 'rakuten',
    is_partial_exit: Boolean(item.is_partial_exit),
  })
}

export async function commitRakutenCsvLocal(filename, items) {
  const existingCandidates = await getAllLocal('importCandidates')
  const bySignature = new Map(existingCandidates.map((item) => [item.source_signature, item]))
  const now = new Date().toISOString()
  const tradesToPut = []
  const candidatesToPut = []
  const createdTradeIds = []
  const updatedTradeIds = []

  for (const item of items || []) {
    const existing = bySignature.get(item.source_signature)
    const id = existing?.trade_id || await nextLocalId('next_trade_id')
    const trade = tradeFromCandidate(item, id, existing?.created_at || now)
    trade.created_at = existing?.created_at || now
    trade.updated_at = now
    tradesToPut.push(trade)
    candidatesToPut.push({
      ...item,
      trade_id: id,
      broker: 'rakuten',
      source_name: filename || null,
      created_at: existing?.created_at || now,
      updated_at: now,
      cloud_synced: Boolean(existing?.cloud_synced),
    })
    if (existing) updatedTradeIds.push(id)
    else createdTradeIds.push(id)
  }

  await putManyLocal('trades', tradesToPut)
  await putManyLocal('importCandidates', candidatesToPut)
  const sessionId = await nextLocalId('next_import_session_id')
  await putLocal('importSessions', {
    id: sessionId,
    broker: 'rakuten',
    source_name: filename || null,
    realized_source_name: null,
    imported_at: now,
    created_count: createdTradeIds.length,
    updated_count: updatedTradeIds.length,
    skipped_count: 0,
    error_count: 0,
    audit_gap_jpy: null,
  })

  return {
    broker: 'rakuten',
    created_count: createdTradeIds.length,
    updated_count: updatedTradeIds.length,
    skipped_count: 0,
    error_count: 0,
    created_trade_ids: createdTradeIds,
    updated_trade_ids: updatedTradeIds,
    skipped: [],
    errors: [],
  }
}

export async function getLatestImportSessionsLocal() {
  const sessions = await getAllLocal('importSessions')
  return sessions.sort((a, b) => String(b.imported_at || '').localeCompare(String(a.imported_at || ''))).slice(0, 1)
}
