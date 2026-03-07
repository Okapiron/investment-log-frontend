import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { api, formatJPY, formatUSD } from '../lib/api'
import { useEffect, useMemo, useState } from 'react'
import { TAG_OPTIONS } from '../lib/tags'
import TradeChart from '../components/TradeChart'
import { patchTrade, updateTradeReview } from '../lib/tradesApi'

function addTagCSV(csv, tag) {
  if (tag === '未設定') return ''
  const parts = (csv || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

  if (!parts.includes(tag)) parts.push(tag)
  return parts.join(',')
}

function removeTagCSV(csv, tag) {
  const target = String(tag || '').trim()
  if (!target) return (csv || '').trim()

  const parts = (csv || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x !== target)

  return parts.join(',')
}

function hasTagCSV(csv, tag) {
  const target = String(tag || '').trim()
  if (!target) return false
  if (target === '未設定') return (csv || '').trim() === ''
  return (csv || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .some((x) => x === target)
}

function toggleTagCSV(csv, tag) {
  return hasTagCSV(csv, tag) ? removeTagCSV(csv, tag) : addTagCSV(csv, tag)
}

function Rating({ value }) {
  const v = Number(value || 0)
  if (!v) return <span>—</span>
  return (
    <span>
      {'★'.repeat(v)}
      {'☆'.repeat(5 - v)}
    </span>
  )
}

function parseTagsCSV(tags) {
  if (!tags || typeof tags !== 'string') return []
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function findBarIndexByDateOrPrev(bars, dateStr) {
  if (!Array.isArray(bars) || bars.length === 0 || !dateStr) return -1
  const exact = bars.findIndex((b) => b.time === dateStr)
  if (exact >= 0) return exact
  let idx = -1
  for (let i = 0; i < bars.length; i += 1) {
    if (bars[i].time <= dateStr) idx = i
    if (bars[i].time > dateStr) break
  }
  if (idx >= 0) return idx
  return 0
}

function isYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())
}

export default function TradeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [isEditing, setIsEditing] = useState(false)
  const [interval] = useState('1d')
  const [chartMode, setChartMode] = useState('entry')
  const [chartViewKey, setChartViewKey] = useState(0)
  const [form, setForm] = useState({
    rating: 0,
    tags: '',
    notes_buy: '',
    notes_sell: '',
    notes_review: '',
    buy_date: '',
    buy_price: '',
    buy_qty: '',
    sell_date: '',
    sell_price: '',
    sell_qty: '',
  })
  const [saveMsg, setSaveMsg] = useState('')
  const [chartError, setChartError] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['trade', id],
    queryFn: () => api.get(`/api/v1/trades/${id}`),
  })

  // buy/sell は表示のみ
  const buy = useMemo(() => data?.fills?.find((f) => f.side === 'buy'), [data])
  const sell = useMemo(() => data?.fills?.find((f) => f.side === 'sell'), [data])
  const isOpen = useMemo(() => {
    if (!data) return false
    if (data.is_open === true) return true
    if (!data.closed_at) return true
    return !sell
  }, [data, sell])
  const isPendingReview = useMemo(() => !Boolean(data?.review_done), [data?.review_done])
  const profitNumber = useMemo(() => {
    if (!data || isOpen) return null
    const n =
      data.profit_currency === 'USD'
        ? Number(data.profit_usd ?? data.profit ?? data.pnl_usd)
        : Number(data.profit_jpy ?? data.profit ?? data.pnl_jpy)
    return Number.isFinite(n) ? n : null
  }, [data, isOpen])

  const profitLabel = useMemo(() => {
    if (!data || isOpen) return '—'

    const sign = Number.isFinite(profitNumber) && profitNumber > 0 ? '+' : ''

    if (data.profit_currency === 'USD') return `${sign}${formatUSD(data.profit_usd)}`
    return `${sign}${formatJPY(data.profit_jpy)}`
  }, [data, isOpen, profitNumber])

  const profitRateNumber = useMemo(() => {
    if (!data || isOpen) return null

    // 1) まずAPIが返してくる損益率らしきフィールドを優先
    const candidates = [data.profit_rate, data.profit_rate_pct, data.profit_pct, data.pnl_rate, data.pnl_rate_pct]

    let raw = candidates.find((v) => v !== undefined && v !== null && String(v).trim() !== '')
    if (typeof raw === 'string') raw = raw.replace('%', '').trim()

    let n = Number(raw)

    // 2) それでも取れない場合は buy の元本から計算（profit / (buy.price*qty)）
    if (!Number.isFinite(n)) {
      const buyFill = Array.isArray(data?.fills) ? data.fills.find((f) => f?.side === 'buy') : null
      const invested = Number(buyFill?.price || 0) * Number(buyFill?.qty || 0)
      if (!(invested > 0)) return null

      // profit_currency が USD なら profit_usd を、そうでなければ profit_jpy を使う
      const profit =
        data?.profit_currency === 'USD'
          ? Number(data?.profit_usd ?? data?.profit ?? data?.pnl_usd)
          : Number(data?.profit_jpy ?? data?.profit ?? data?.pnl_jpy)

      if (!Number.isFinite(profit)) return null

      n = (profit / invested) * 100
    } else {
      // APIが 0.12 のような比率で返すケースを % に寄せる
      if (Math.abs(n) <= 1) n = n * 100
    }

    return Number.isFinite(n) ? n : null
  }, [data, isOpen])

  const profitRateLabel = useMemo(() => {
    if (!data || isOpen) return '—'
    const n = profitRateNumber
    if (!Number.isFinite(n)) return '—'
    const sign = n > 0 ? '+' : ''
    return `${sign}${n.toFixed(1)}%`
  }, [data, isOpen, profitRateNumber])

  const profitColor = useMemo(() => {
    if (!Number.isFinite(profitNumber)) return '#111'
    if (profitNumber > 0) return '#067647'
    if (profitNumber < 0) return '#b42318'
    return '#111'
  }, [profitNumber])

  const profitRateColor = useMemo(() => {
    if (!Number.isFinite(profitRateNumber)) return '#111'
    if (profitRateNumber > 0) return '#067647'
    if (profitRateNumber < 0) return '#b42318'
    return '#111'
  }, [profitRateNumber])

  const fmtMoney = useMemo(() => {
    if (!data) return formatJPY
    // JPは円、USはドルとして表示
    return data.market === 'US' ? formatUSD : formatJPY
  }, [data])

  const { data: pricesData, isLoading: isPricesLoading, error: pricesError } = useQuery({
    queryKey: ['prices', data?.market, data?.symbol, interval],
    enabled: Boolean(data?.market && data?.symbol),
    queryFn: () =>
      api.get(
        `/prices?market=${encodeURIComponent(data.market)}&symbol=${encodeURIComponent(data.symbol)}&interval=${encodeURIComponent(interval)}`
      ),
  })

  const tvExternalUrl = useMemo(() => {
    if (!data?.market || !data?.symbol) return ''
    if (data.market === 'JP') return `https://www.tradingview.com/symbols/TSE-${data.symbol}/`
    if (data.market === 'US') return `https://www.tradingview.com/symbols/NASDAQ-${data.symbol}/`
    return ''
  }, [data?.market, data?.symbol])

  const allBars = Array.isArray(pricesData?.bars) ? pricesData.bars : []
  const buyIndex = useMemo(() => findBarIndexByDateOrPrev(allBars, buy?.date), [allBars, buy?.date])
  const sellIndex = useMemo(() => findBarIndexByDateOrPrev(allBars, sell?.date), [allBars, sell?.date])
  const focusSpec = useMemo(
    () => ({
      mode: chartMode,
      preBars: 20,
      postBars: 20,
      buyDate: buy?.date || null,
      sellDate: sell?.date || null,
      isOpen,
      buyIndex,
      sellIndex,
    }),
    [chartMode, buy?.date, sell?.date, isOpen, buyIndex, sellIndex]
  )

  useEffect(() => {
    if (isOpen && chartMode === 'exit') {
      setChartMode('entry')
    }
  }, [isOpen, chartMode])

  useEffect(() => {
    if (pricesError) {
      setChartError('チャートを表示できませんでした')
      return
    }
    if (!isPricesLoading && allBars.length === 0) {
      setChartError('チャートを表示できませんでした')
      return
    }
    setChartError('')
  }, [pricesError, isPricesLoading, allBars.length])

  // 編集開始時に data → form をコピー（レンダー中に setState しない）
  useEffect(() => {
    if (!data) return
    if (!isEditing) return
    setForm({
      rating: Number(data.rating ?? 0),
      tags: data.tags ?? '',
      notes_buy: data.notes_buy ?? '',
      notes_sell: data.notes_sell ?? '',
      notes_review: data.notes_review ?? '',
      buy_date: buy?.date ?? '',
      buy_price: buy?.price != null ? String(buy.price) : '',
      buy_qty: buy?.qty != null ? String(buy.qty) : '',
      sell_date: sell?.date ?? '',
      sell_price: sell?.price != null ? String(sell.price) : '',
      sell_qty: sell?.qty != null ? String(sell.qty) : '',
    })
  }, [data, isEditing, buy?.date, buy?.price, buy?.qty, sell?.date, sell?.price, sell?.qty])

  if (isLoading) return <p style={{ padding: 16 }}>読み込み中…</p>
  if (error) return <p style={{ padding: 16, color: 'crimson' }}>エラー: {String(error.message || error)}</p>
  if (!data) return <p style={{ padding: 16 }}>データがありません</p>

  function startEdit() {
    setSaveMsg('')
    setIsEditing(true)
  }

  function cancelEdit() {
    setSaveMsg('')
    setIsEditing(false)
    // form は useEffect で再同期するのでここでは触らなくてOK
  }

  async function saveAll() {
    try {
      setSaveMsg('')
      const buyDate = String(form.buy_date || '').trim()
      const buyPrice = Number(form.buy_price)
      const buyQty = Number(form.buy_qty)
      const sellDate = String(form.sell_date || '').trim()
      const sellPrice = Number(form.sell_price)
      const sellQty = Number(form.sell_qty)
      const hasAnySell = Boolean(sellDate) || String(form.sell_price || '').trim() !== '' || String(form.sell_qty || '').trim() !== ''
      const hasAllSell = Boolean(sellDate) && String(form.sell_price || '').trim() !== '' && String(form.sell_qty || '').trim() !== ''

      if (!isYmd(buyDate)) {
        setSaveMsg('保存に失敗: BUY日付は YYYY-MM-DD 形式で入力してください')
        return
      }
      if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
        setSaveMsg('保存に失敗: BUY価格は 0 より大きい数値で入力してください')
        return
      }
      if (!Number.isFinite(buyQty) || buyQty <= 0) {
        setSaveMsg('保存に失敗: BUY数量は 1 以上で入力してください')
        return
      }

      if (!isOpen && !hasAllSell) {
        setSaveMsg('保存に失敗: 売却済トレードを保存するには SELL日付・SELL価格・SELL数量が必要です')
        return
      }
      if (hasAnySell && !hasAllSell) {
        setSaveMsg('保存に失敗: SELL日付・SELL価格・SELL数量は3つとも入力してください')
        return
      }
      if (hasAllSell) {
        if (!isYmd(sellDate)) {
          setSaveMsg('保存に失敗: SELL日付は YYYY-MM-DD 形式で入力してください')
          return
        }
        if (!Number.isFinite(sellPrice) || sellPrice <= 0) {
          setSaveMsg('保存に失敗: SELL価格は 0 より大きい数値で入力してください')
          return
        }
        if (!Number.isFinite(sellQty) || sellQty <= 0) {
          setSaveMsg('保存に失敗: SELL数量は 1 以上で入力してください')
          return
        }
      }

      const payload = {
        rating: Number(form.rating || 0) || null,
        tags: (form.tags || '').trim() || null,
        notes_buy: (form.notes_buy || '').trim() || null,
        notes_sell: isOpen ? (data.notes_sell || null) : (form.notes_sell || '').trim() || null,
        notes_review: isOpen ? (data.notes_review || null) : (form.notes_review || '').trim() || null,
        buy_date: buyDate,
        buy_price: buyPrice,
        buy_qty: buyQty,
        sell_date: hasAllSell ? sellDate : null,
        sell_price: hasAllSell ? sellPrice : null,
        sell_qty: hasAllSell ? sellQty : null,
      }

      await patchTrade(id, payload)

      // 最新化
      await refetch()
      await queryClient.invalidateQueries({ queryKey: ['trades'] })

      setIsEditing(false)
      setSaveMsg('保存しました')
    } catch (e) {
      setSaveMsg(`保存に失敗: ${e.message}`)
    }
  }

  async function deleteTrade() {
    const ok = window.confirm('この投資ログを削除しますか？（元に戻せません）')
    if (!ok) return

    try {
      setSaveMsg('')
      await api.del(`/api/v1/trades/${id}`)
      await queryClient.invalidateQueries({ queryKey: ['trades'] })
      navigate('/trades')
    } catch (e) {
      setSaveMsg(`削除に失敗: ${e.message}`)
    }
  }

  async function markReviewDone() {
    if (!data || isOpen) return
    if (!data.notes_review || String(data.notes_review).trim() === '') {
      const ok = window.confirm('振り返りメモが空ですが、レビュー完了にしますか？')
      if (!ok) return
    }
    try {
      setSaveMsg('')
      const today = new Date().toISOString().slice(0, 10)
      await updateTradeReview(id, true, today)
      await refetch()
      await queryClient.invalidateQueries({ queryKey: ['trades'] })
      setSaveMsg('レビュー完了にしました')
    } catch (e) {
      setSaveMsg(`レビュー更新に失敗: ${e.message}`)
    }
  }

  async function markReviewPending() {
    if (!data || isOpen) return
    try {
      setSaveMsg('')
      await updateTradeReview(id, false, null)
      await refetch()
      await queryClient.invalidateQueries({ queryKey: ['trades'] })
      setSaveMsg('未レビューに戻しました')
    } catch (e) {
      setSaveMsg(`レビュー更新に失敗: ${e.message}`)
    }
  }

  return (
    <div style={{ padding: 12, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'grid', gap: 8 }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'start', gap: 12 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 12,
                  color: '#475467',
                  border: '1px solid #e4e7ec',
                  background: '#f9fafb',
                  borderRadius: 999,
                  padding: '2px 8px',
                  lineHeight: 1.2,
                }}
              >
                {data.market}
              </span>

              <span style={{ fontSize: 20, fontWeight: 800, color: '#111' }}>{data.symbol}</span>

              {data.name ? <span style={{ fontSize: 14, color: '#475467' }}>{data.name}</span> : null}
              {isOpen ? (
                <span
                  style={{
                    fontSize: 11,
                    color: '#344054',
                    background: '#f2f4f7',
                    border: '1px solid #eaecf0',
                    borderRadius: 999,
                    padding: '3px 8px',
                  }}
                >
                  保有中
                </span>
              ) : null}
              {/* --- Insert review badge here --- */}
              {!isOpen ? (
                isPendingReview ? (
                  <span
                    style={{
                      fontSize: 12,
                      color: '#344054',
                      background: '#fdf2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 999,
                      padding: '4px 10px',
                      lineHeight: 1.2,
                    }}
                  >
                    未レビュー
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 12,
                      color: '#175cd3',
                      background: '#eff8ff',
                      border: '1px solid #b2ddff',
                      borderRadius: 999,
                      padding: '4px 10px',
                      lineHeight: 1.2,
                    }}
                  >
                    レビュー済{data?.reviewed_at ? ` (${data.reviewed_at})` : ''}
                  </span>
                )
              ) : null}
            </h2>

            {/* tags */}
            {!isEditing ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {parseTagsCSV(data.tags).map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 12,
                      color: '#344054',
                      background: '#f2f4f7',
                      border: '1px solid #eaecf0',
                      borderRadius: 999,
                      padding: '4px 10px',
                      lineHeight: 1.2,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {TAG_OPTIONS.map((t) => {
                    const active = hasTagCSV(form.tags, t)
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, tags: toggleTagCSV(p.tags, t) }))}
                        style={{
                          border: active ? '1px solid #2a9d8f' : '1px solid #ddd',
                          borderRadius: 999,
                          padding: '6px 10px',
                          background: active ? '#e8f7f4' : '#fff',
                          cursor: 'pointer',
                          fontSize: 12,
                          color: '#111',
                          fontWeight: 600,
                          lineHeight: 1.2,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                        title={active ? 'クリックでタグを外す' : 'クリックでタグに追加'}
                      >
                        {active ? '✓' : '+'} {t}
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#475467' }}>評価</span>
                  <select
                    value={form.rating}
                    onChange={(e) => setForm((p) => ({ ...p, rating: Number(e.target.value) }))}
                    disabled={isOpen}
                    style={{ opacity: isOpen ? 0.6 : 1 }}
                  >
                    <option value={0}>—</option>
                    <option value={1}>★1</option>
                    <option value={2}>★2</option>
                    <option value={3}>★3</option>
                    <option value={4}>★4</option>
                    <option value={5}>★5</option>
                  </select>
                  {isOpen ? <span style={{ fontSize: 12, color: '#667085' }}>保有中は変更しません</span> : null}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {tvExternalUrl ? (
              <a href={tvExternalUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <button type="button">TradingViewで開く</button>
              </a>
            ) : (
              <span style={{ fontSize: 12, color: '#b42318' }}>外部リンクなし</span>
            )}

            <button
              onClick={deleteTrade}
              disabled={isEditing}
              style={{
                background: '#fff',
                border: '1px solid #f2b8b5',
                color: '#b42318',
                opacity: isEditing ? 0.5 : 1,
                cursor: isEditing ? 'not-allowed' : 'pointer',
              }}
              title={isEditing ? '編集モード中は削除できません' : '削除'}
            >
              削除
            </button>

            {!isEditing ? (
              <button onClick={startEdit}>編集</button>
            ) : (
              <>
                <button onClick={cancelEdit}>キャンセル</button>
                <button onClick={saveAll}>保存</button>
              </>
            )}

            <Link to="/trades" style={{ textDecoration: 'none' }}>
              <button>← 一覧へ</button>
            </Link>
          </div>
        </div>

      </div>

      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'stretch' }}>
      {/* 売買データ */}
      <div style={{ marginTop: 0, border: '1px solid #ddd', borderRadius: 12, padding: 10, height: '100%', background: '#fff', fontSize: 15, color: '#111' }}>
        
        <h3
          style={{
            marginTop: 0,
            marginBottom: 8,
            fontSize: 16,
            fontWeight: 800,
            borderLeft: '4px solid #ddd',
            paddingLeft: 10,
          }}
        >
          売買データ
        </h3>
        <div style={{ height: 1, background: '#eee', marginBottom: 10 }} />

          {!isEditing ? (
            <div style={{ display: 'grid', gap: 8, fontSize: 15, color: '#111', paddingLeft: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 8, alignItems: 'baseline' }}>
                <b>BUY</b>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#000' }}>
                  {buy?.date || '—'} / {fmtMoney(buy?.price)} × {buy?.qty ?? '—'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 8, alignItems: 'baseline' }}>
                <b>SELL</b>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#000' }}>
                  {isOpen ? '—' : `${sell?.date || '—'} / ${fmtMoney(sell?.price)} × ${sell?.qty ?? '—'}`}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12, paddingLeft: 10 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <b>BUY</b>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <input
                    type="date"
                    value={form.buy_date}
                    onChange={(e) => setForm((p) => ({ ...p, buy_date: e.target.value }))}
                  />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.buy_price}
                    onChange={(e) => setForm((p) => ({ ...p, buy_price: e.target.value }))}
                    placeholder="BUY価格"
                  />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.buy_qty}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        buy_qty: e.target.value,
                        sell_qty: e.target.value,
                      }))
                    }
                    placeholder="BUY数量"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <b>SELL</b>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <input
                    type="date"
                    value={form.sell_date}
                    onChange={(e) => setForm((p) => ({ ...p, sell_date: e.target.value }))}
                  />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.sell_price}
                    onChange={(e) => setForm((p) => ({ ...p, sell_price: e.target.value }))}
                    placeholder="SELL価格"
                  />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.sell_qty}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        sell_qty: e.target.value,
                        buy_qty: e.target.value,
                      }))
                    }
                    placeholder="SELL数量"
                  />
                </div>
                {isOpen ? (
                  <div style={{ fontSize: 12, color: '#667085' }}>
                    保有中のまま保存する場合は SELL を空欄のままにしてください。売却済にするには SELL日付・SELL価格・SELL数量の3つを入力してください。
                  </div>
                ) : null}
              </div>
            </div>
          )}
      </div>
      {/* サマリー */}
      {!isEditing ? (
      <div style={{ marginTop: 0, border: '1px solid #ddd', borderRadius: 12, padding: 10, height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', fontSize: 15, color: '#111' }}>
        <h3
          style={{
            marginTop: 0,
            marginBottom: 8,
            fontSize: 16,
            fontWeight: 800,
            borderLeft: '4px solid #ddd',
            paddingLeft: 10,
          }}
        >
          サマリー
        </h3>
        <div style={{ height: 1, background: '#eee', marginBottom: 10 }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, alignItems: 'start', paddingLeft: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, opacity: 0.75 }}>損益</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: profitColor }}>{profitLabel}</div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, opacity: 0.75 }}>損益率</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: profitRateColor }}>{profitRateLabel}</div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, opacity: 0.75 }}>保有日数</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{isOpen ? '—' : `${data.holding_days ?? '—'} 日`}</div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, opacity: 0.75 }}>評価</div>
            <div style={{ fontSize: 14 }}>
              <Rating value={data.rating} />
            </div>
          </div>
        </div>

        {/* (Review badge and buttons moved to header and thought log sections) */}

      </div>
      ) : null}
      </div>

      {/* チャート */}
      <div style={{ marginTop: 10, border: '1px solid #ddd', borderRadius: 12, padding: 10, background: '#fff', fontSize: 15, color: '#111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h3
            style={{
              marginTop: 0,
              marginBottom: 8,
              fontSize: 16,
              fontWeight: 800,
              borderLeft: '4px solid #ddd',
              paddingLeft: 10,
            }}
          >
            チャート
          </h3>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setChartMode('entry')
                setChartViewKey((k) => k + 1)
              }}
              style={{
                border: '1px solid #ddd',
                background: '#f2f4f7',
                color: '#344054',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                marginRight: 6,
              }}
            >
              Reset
            </button>
          </div>
        </div>
        <div style={{ height: 1, background: '#eee', marginBottom: 10 }} />
        {isPricesLoading ? (
          <div style={{ color: '#475467', fontSize: 15 }}>チャート読み込み中…</div>
        ) : chartError || allBars.length === 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ color: '#b42318', fontSize: 15 }}>チャートを表示できませんでした</div>
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', height: 420, overflow: 'hidden', borderRadius: 8 }}>
            <TradeChart
              bars={allBars}
              buyFill={buy}
              sellFill={isOpen ? null : sell}
              focusSpec={focusSpec}
              resetKey={chartViewKey}
              onError={(msg) => setChartError(msg || 'チャートを表示できませんでした')}
            />
          </div>
        )}
      </div>

      {/* 思考ログ */}
      <div style={{ marginTop: 10 }}>
        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 10, background: '#fff', fontSize: 15, color: '#111' }}>
        <h3
          style={{
            marginTop: 0,
            marginBottom: 8,
            fontSize: 16,
            fontWeight: 800,
            borderLeft: '4px solid #ddd',
            paddingLeft: 10,
          }}
        >
          思考ログ
        </h3>
        <div style={{ height: 1, background: '#eee', marginBottom: 12 }} />

        <div style={{ display: 'grid', gap: 10, paddingLeft: 10 }}>
          {/* 購入理由 */}
          <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: 10, alignItems: 'start' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#667085', paddingTop: 2 }}>購入理由</div>
            {!isEditing ? (
              <div style={{ whiteSpace: 'pre-wrap', color: '#111', lineHeight: 1.6 }}>{data.notes_buy || '—'}</div>
            ) : (
              <textarea
                value={form.notes_buy}
                onChange={(e) => setForm((p) => ({ ...p, notes_buy: e.target.value }))}
                rows={4}
                style={{ width: '100%', borderRadius: 8, border: '1px solid #ddd', padding: 10 }}
                placeholder="購入理由（根拠・材料・仮説）"
              />
            )}
          </div>

          <div style={{ height: 1, background: '#eee' }} />

          {/* 売却理由 */}
          <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: 10, alignItems: 'start', opacity: isEditing && isOpen ? 0.6 : 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#667085', paddingTop: 2 }}>売却理由</div>
            {!isEditing ? (
              <div style={{ whiteSpace: 'pre-wrap', color: '#111', lineHeight: 1.6 }}>{data.notes_sell || '—'}</div>
            ) : (
              <textarea
                value={form.notes_sell}
                onChange={(e) => setForm((p) => ({ ...p, notes_sell: e.target.value }))}
                rows={4}
                style={{ width: '100%', borderRadius: 8, border: '1px solid #ddd', padding: 10 }}
                placeholder="売却理由（利確/損切り/リスク管理）"
                disabled={isOpen}
              />
            )}
          </div>

          <div style={{ height: 1, background: '#eee' }} />

          {/* 考察 */}
          <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: 10, alignItems: 'start', opacity: isEditing && isOpen ? 0.6 : 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#667085', paddingTop: 2 }}>考察</div>
            {!isEditing ? (
              <div style={{ whiteSpace: 'pre-wrap', color: '#111', lineHeight: 1.6 }}>{data.notes_review || '—'}</div>
            ) : (
              <textarea
                value={form.notes_review}
                onChange={(e) => setForm((p) => ({ ...p, notes_review: e.target.value }))}
                rows={6}
                style={{ width: '100%', borderRadius: 8, border: '1px solid #ddd', padding: 10 }}
                placeholder="考察（改善点・次のルール）"
                disabled={isOpen}
              />
            )}
          </div>

          {saveMsg ? <div style={{ marginTop: 2, fontSize: 12, color: '#475467' }}>{saveMsg}</div> : null}
        </div>
        </div>

        {!isOpen && !isEditing ? (
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            {isPendingReview ? (
              <button type="button" onClick={markReviewDone}>レビュー完了</button>
            ) : (
              <button type="button" onClick={markReviewPending}>未レビューに戻す</button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
