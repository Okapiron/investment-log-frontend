import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { api, formatJPY, formatUSD } from '../lib/api'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TAG_OPTIONS } from '../lib/tags'
import TradeChart from '../components/TradeChart'
import { patchTrade, updateTradeReview } from '../lib/tradesApi'
import { assessPriceSanityAgainstDailyBars } from '../lib/priceSanity'
import { marketPriceInputMode, marketPriceValidationError, normalizePriceInputByMarket, parsePriceText } from '../lib/marketPrice'

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

function getSellCompletion(form) {
  const sellDate = String(form?.sell_date || '').trim()
  const sellPriceText = String(form?.sell_price || '').trim()
  const sellQtyText = String(form?.sell_qty || '').trim()
  const hasAnySell = Boolean(sellDate) || sellPriceText !== '' || sellQtyText !== ''
  const hasAllSell = Boolean(sellDate) && sellPriceText !== '' && sellQtyText !== ''
  return { hasAnySell, hasAllSell, sellDate }
}

function getReviewMissingItems(trade, isOpen) {
  if (!trade || isOpen) return []
  const missing = []
  const tags = parseTagsCSV(trade.tags)
  const rating = Number(trade.rating || 0)

  if (tags.length === 0) missing.push('タグ')
  if (!Number.isFinite(rating) || rating <= 0) missing.push('評価')
  if (!String(trade.notes_buy || '').trim()) missing.push('購入理由')
  if (!String(trade.notes_sell || '').trim()) missing.push('売却理由')
  if (!String(trade.notes_review || '').trim()) missing.push('考察')
  return missing
}

export default function TradeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const CHART_INTERVAL_OPTIONS = [
    { value: '1d', label: '日足' },
    { value: '1w', label: '週足' },
    { value: '1m', label: '月足' },
  ]

  const [isEditing, setIsEditing] = useState(false)
  const [editIsOpen, setEditIsOpen] = useState(false)
  const [interval, setInterval] = useState('1d')
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
  const [editPriceCheckStatus, setEditPriceCheckStatus] = useState('idle')
  const [editPriceCheckError, setEditPriceCheckError] = useState('')
  const [editPriceCheckWarning, setEditPriceCheckWarning] = useState('')
  const [chartError, setChartError] = useState('')
  const [isTradeDataOpenMobile, setIsTradeDataOpenMobile] = useState(false)
  const [isSummaryOpenMobile, setIsSummaryOpenMobile] = useState(false)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(max-width: 767px)').matches
  })
  const editNavRootRef = useRef(null)
  const baseButtonStyle = {
    background: '#f2f4f7',
    color: '#111',
    border: '1px solid #d0d5dd',
    borderRadius: 10,
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 500,
  }
  const primaryButtonStyle = {
    background: '#2a8871',
    color: '#fff',
    border: '1px solid #2a8871',
    borderRadius: 10,
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 600,
  }
  const chartControlButtonStyle = {
    ...baseButtonStyle,
    padding: '4px 10px',
    minWidth: 56,
    height: 30,
    fontSize: 12,
    fontWeight: 600,
  }
  const detailDateInputStyle = {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    display: 'block',
    minHeight: 44,
    fontSize: 16,
    borderRadius: 10,
    border: '1px solid #cfd8d3',
    background: '#fff',
    padding: '10px 12px',
    lineHeight: 1.2,
  }
  const mobileDateInputWrapStyle = {
    position: 'relative',
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
  }
  const mobileDateDisplayStyle = {
    width: '100%',
    minHeight: 44,
    fontSize: 16,
    borderRadius: 10,
    border: '1px solid #cfd8d3',
    background: '#fff',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1.2,
    overflow: 'hidden',
    minWidth: 0,
    boxSizing: 'border-box',
  }
  const mobileDateTextStyle = {
    display: 'block',
    width: '100%',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  }
  const mobileHiddenDateInputStyle = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    minWidth: 0,
    maxWidth: '100%',
    opacity: 0,
    cursor: 'pointer',
    border: 'none',
    margin: 0,
    padding: 0,
    background: 'transparent',
    WebkitAppearance: 'none',
    appearance: 'none',
  }
  const dangerButtonStyle = {
    background: '#fef3f2',
    color: '#b42318',
    border: '1px solid #fecdca',
    borderRadius: 10,
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 600,
  }

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = (e) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    mq.addListener(onChange)
    return () => mq.removeListener(onChange)
  }, [])

  useEffect(() => {
    if (!isMobile) {
      setIsTradeDataOpenMobile(true)
      setIsSummaryOpenMobile(true)
    }
  }, [isMobile])

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
  const reviewMissingItems = useMemo(() => getReviewMissingItems(data, isOpen), [data, isOpen])
  const reviewDisabledReason = useMemo(() => {
    if (!isPendingReview) return ''
    if (reviewMissingItems.length === 0) return ''
    return `レビュー完了に必要: ${reviewMissingItems.join(' / ')}`
  }, [isPendingReview, reviewMissingItems])
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

  const clientSaveValidationError = useMemo(() => {
    if (!isEditing) return ''

    const buyDate = String(form.buy_date || '').trim()
    const buyPrice = parsePriceText(form.buy_price)
    const buyQty = Number(form.buy_qty)
    const sellPrice = parsePriceText(form.sell_price)
    const sellQty = Number(form.sell_qty)
    const { hasAnySell, hasAllSell, sellDate } = getSellCompletion(form)

    if (!isYmd(buyDate)) return 'BUY日付は YYYY-MM-DD 形式で入力してください'
    const buyPriceError = marketPriceValidationError(data?.market, form.buy_price, '買付価格')
    if (buyPriceError) return buyPriceError
    if (!Number.isFinite(buyQty) || buyQty <= 0) return '買付数量は 1 以上で入力してください'

    if (!editIsOpen && !hasAllSell) return '売却済トレードを保存するには 売却日付・売却価格・売却数量 が必要です'
    if (hasAnySell && !hasAllSell) return '売却日付・売却価格・売却数量は3つとも入力してください'
    if (hasAllSell) {
      if (!isYmd(sellDate)) return '売却日付は YYYY-MM-DD 形式で入力してください'
      const sellPriceError = marketPriceValidationError(data?.market, form.sell_price, '売却価格')
      if (sellPriceError) return sellPriceError
      if (!Number.isFinite(sellQty) || sellQty <= 0) return '売却数量は 1 以上で入力してください'
    }

    return ''
  }, [isEditing, form, editIsOpen])

  const editPriceCheckParams = useMemo(() => {
    if (!isEditing) return null
    if (clientSaveValidationError) return null
    if (!data?.market || !data?.symbol) return null

    const { hasAllSell, sellDate } = getSellCompletion(form)
    return {
      market: data.market,
      symbol: data.symbol,
      buyDate: String(form.buy_date || '').trim(),
      buyPrice: parsePriceText(form.buy_price),
      sellDate: !editIsOpen && hasAllSell ? sellDate : null,
      sellPrice: !editIsOpen && hasAllSell ? parsePriceText(form.sell_price) : null,
    }
  }, [isEditing, clientSaveValidationError, data?.market, data?.symbol, form, editIsOpen])

  useEffect(() => {
    if (!isEditing || !editPriceCheckParams) {
      setEditPriceCheckStatus('idle')
      setEditPriceCheckError('')
      setEditPriceCheckWarning('')
      return
    }

    let cancelled = false
    setEditPriceCheckStatus('checking')
    setEditPriceCheckError('')
    setEditPriceCheckWarning('')

    const timerId = window.setTimeout(async () => {
      const result = await assessPriceSanityAgainstDailyBars(editPriceCheckParams)
      if (cancelled) return
      setEditPriceCheckStatus('ok')
      setEditPriceCheckError('')
      setEditPriceCheckWarning(result?.warnings?.[0] || result?.blockingMessage || '')
    }, 150)

    return () => {
      cancelled = true
      window.clearTimeout(timerId)
    }
  }, [isEditing, editPriceCheckParams, editIsOpen])

  const saveDisabledReason = useMemo(() => {
    if (!isEditing) return ''
    if (clientSaveValidationError) return clientSaveValidationError
    if (editIsOpen) return ''
    if (!editPriceCheckParams) return '価格チェック待ちです'
    if (editPriceCheckStatus === 'checking') return '価格を確認中です'
    if (editPriceCheckStatus !== 'ok') return '価格チェック待ちです'
    return ''
  }, [isEditing, clientSaveValidationError, editIsOpen, editPriceCheckParams, editPriceCheckStatus, editPriceCheckError])
  const chartContainerHeight = isMobile ? 360 : 420
  const showTradeDataContent = !isMobile || isEditing || isTradeDataOpenMobile
  const showSummaryContent = isEditing || !isMobile || isSummaryOpenMobile
  const isFullYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))

  const renderEditDateInput = ({ value, onChange, disabled = false }) => {
    if (!isMobile) {
      return (
        <input
          type="date"
          value={value}
          onChange={onChange}
          disabled={disabled}
          style={{ ...detailDateInputStyle, opacity: disabled ? 0.6 : 1 }}
        />
      )
    }

    return (
      <div style={{ ...mobileDateInputWrapStyle, opacity: disabled ? 0.6 : 1 }}>
        <div style={mobileDateDisplayStyle}>
          <span style={{ ...mobileDateTextStyle, color: isFullYmd(value) ? '#111' : '#667085' }}>
            {isFullYmd(value) ? value : 'タップして日付を選択する'}
          </span>
        </div>
        <input
          type="date"
          value={value}
          onChange={onChange}
          disabled={disabled}
          style={mobileHiddenDateInputStyle}
          aria-label="日付"
        />
      </div>
    )
  }

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
      rating: isOpen ? 0 : Number(data.rating ?? 0),
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
    setEditIsOpen(isOpen)
  }, [data, isEditing, isOpen, buy?.date, buy?.price, buy?.qty, sell?.date, sell?.price, sell?.qty])

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

  function handleEditKeyNav(e) {
    if (!isEditing) return
    const target = e.target
    if (!target || !target.tagName) return
    const tag = String(target.tagName || '').toUpperCase()
    if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return

    // Japanese IMEなどの変換確定中はEnterでフォーカス移動しない
    if (e.isComposing || e.keyCode === 229) return

    function getNavElements() {
      const root = editNavRootRef.current
      if (!root) return []
      return Array.from(root.querySelectorAll('input, select, textarea')).filter((el) => {
        if (el.disabled) return false
        if (el.type === 'submit') return false
        if (el.tabIndex < 0) return false
        if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false
        return true
      })
    }

    function focusNext() {
      const elements = getNavElements()
      const index = elements.indexOf(target)
      if (index > -1 && index + 1 < elements.length) {
        elements[index + 1].focus()
      }
    }

    function focusPrev() {
      const elements = getNavElements()
      const index = elements.indexOf(target)
      if (index > 0) {
        elements[index - 1].focus()
      }
    }

    if (e.key === 'Enter') {
      // Checkbox: Shift+Enter toggles ON/OFF, Enter moves next
      if (target.type === 'checkbox') {
        e.preventDefault()
        if (e.shiftKey) target.click()
        else focusNext()
        return
      }

      // Textarea: Shift+Enter = newline (default), Enter moves next
      if (tag === 'TEXTAREA') {
        if (e.shiftKey) return
        e.preventDefault()
        focusNext()
        return
      }

      // Other fields: Enter moves next, Shift+Enter does nothing (do not submit)
      if (e.shiftKey) {
        e.preventDefault()
        return
      }

      e.preventDefault()
      focusNext()
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      focusPrev()
    }
  }

  async function saveAll() {
    try {
      if (saveDisabledReason) return
      setSaveMsg('')
      const buyDate = String(form.buy_date || '').trim()
      const buyPrice = parsePriceText(form.buy_price)
      const buyQty = Number(form.buy_qty)
      const sellPrice = parsePriceText(form.sell_price)
      const sellQty = Number(form.sell_qty)
      const { hasAllSell, sellDate } = getSellCompletion(form)

      const payload = {
        rating: editIsOpen ? null : (Number(form.rating || 0) || null),
        tags: (form.tags || '').trim() || null,
        notes_buy: (form.notes_buy || '').trim() || null,
        notes_sell: editIsOpen ? (data.notes_sell || null) : (form.notes_sell || '').trim() || null,
        notes_review: editIsOpen ? (data.notes_review || null) : (form.notes_review || '').trim() || null,
        buy_date: buyDate,
        buy_price: buyPrice,
        buy_qty: buyQty,
        sell_date: !editIsOpen && hasAllSell ? sellDate : null,
        sell_price: !editIsOpen && hasAllSell ? sellPrice : null,
        sell_qty: !editIsOpen && hasAllSell ? sellQty : null,
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
    if (reviewMissingItems.length > 0) {
      setSaveMsg(`レビュー更新に失敗: ${reviewDisabledReason}`)
      return
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
    <div ref={editNavRootRef} onKeyDownCapture={handleEditKeyNav} style={{ padding: isMobile ? 10 : 12, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'grid', gap: 8 }}>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', alignItems: 'start', gap: 12 }}>
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
                    fontSize: 12,
                    color: '#067647',
                    background: '#ecfdf3',
                    border: '1px solid #abefc6',
                    borderRadius: 999,
                    padding: '4px 10px',
                    lineHeight: 1.2,
                  }}
                >
                  保有中
                </span>
              ) : isPendingReview ? (
                <span
                  style={{
                    fontSize: 12,
                    color: '#b42318',
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
              )}
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
            ) : null}
          </div>

          <div style={{ display: 'grid', justifyItems: isMobile ? 'stretch' : 'end', gap: 4 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'flex-end', flexWrap: 'wrap' }}>
            {!isEditing ? (
              <>
                {tvExternalUrl ? (
                  <a href={tvExternalUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', width: isMobile ? '100%' : 'auto' }}>
                    <button type="button" style={{ ...baseButtonStyle, minHeight: isMobile ? 40 : undefined, width: isMobile ? '100%' : undefined }}>TradingViewで開く</button>
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: '#b42318' }}>外部リンクなし</span>
                )}

                <Link to="/trades" style={{ textDecoration: 'none', width: isMobile ? '100%' : 'auto' }}>
                  <button style={{ ...baseButtonStyle, minHeight: isMobile ? 40 : undefined, width: isMobile ? '100%' : undefined }}>← 一覧へ</button>
                </Link>

                <button onClick={startEdit} style={{ ...baseButtonStyle, minHeight: isMobile ? 40 : undefined, width: isMobile ? '100%' : undefined }}>編集</button>

                <button
                  onClick={deleteTrade}
                  style={{ ...dangerButtonStyle, minHeight: isMobile ? 40 : undefined, width: isMobile ? '100%' : undefined }}
                  title="削除"
                >
                  削除
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={saveAll}
                  disabled={Boolean(saveDisabledReason)}
                  title={saveDisabledReason || ''}
                  style={{ ...primaryButtonStyle, opacity: saveDisabledReason ? 0.55 : 1, cursor: saveDisabledReason ? 'not-allowed' : 'pointer', minHeight: isMobile ? 40 : undefined, width: isMobile ? '100%' : undefined }}
                >
                  保存
                </button>
                <button onClick={cancelEdit} style={{ ...baseButtonStyle, minHeight: isMobile ? 40 : undefined, width: isMobile ? '100%' : undefined }}>キャンセル</button>
                <button onClick={deleteTrade} style={{ ...dangerButtonStyle, minHeight: isMobile ? 40 : undefined, width: isMobile ? '100%' : undefined }}>削除</button>
              </>
            )}
            </div>
            {isEditing && saveDisabledReason ? (
              <div style={{ marginTop: 2, fontSize: 12, color: '#b42318' }}>{saveDisabledReason}</div>
            ) : null}
            {isEditing && !saveDisabledReason && editPriceCheckWarning ? (
              <div style={{ marginTop: 2, fontSize: 12, color: '#667085' }}>注意: {editPriceCheckWarning}</div>
            ) : null}
            {saveMsg ? (
              <div style={{ marginTop: 2, fontSize: 12, color: saveMsg.includes('失敗') ? '#b42318' : '#475467' }}>{saveMsg}</div>
            ) : null}
          </div>
        </div>

      </div>

      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, alignItems: 'stretch' }}>
      {/* 売買データ */}
      <div style={{ marginTop: 0, border: '1px solid #ddd', borderRadius: 12, padding: 10, height: '100%', background: '#fff', fontSize: 15, color: '#111' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
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
          {isMobile && !isEditing ? (
            <button
              type="button"
              onClick={() => setIsTradeDataOpenMobile((v) => !v)}
              style={{ ...baseButtonStyle, minHeight: 34, padding: '6px 10px', fontSize: 12 }}
            >
              {isTradeDataOpenMobile ? '閉じる' : '開く'}
            </button>
          ) : null}
        </div>
        {showTradeDataContent ? <div style={{ height: 1, background: '#eee', marginBottom: 10 }} /> : null}

          {showTradeDataContent && !isEditing ? (
            <div style={{ display: 'grid', gap: 8, fontSize: 15, color: '#111', paddingLeft: isMobile ? 0 : 10 }}>
              <div style={{ display: 'grid', gap: 6, border: '1px solid #eaecf0', borderRadius: 10, padding: isMobile ? 10 : '8px 10px', background: '#fcfdfd' }}>
                <b style={{ fontSize: 14 }}>買付</b>
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '64px 1fr' : '56px 1fr', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#667085', fontWeight: 700 }}>日付</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{buy?.date || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '64px 1fr' : '56px 1fr', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#667085', fontWeight: 700 }}>価格</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{fmtMoney(buy?.price)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '64px 1fr' : '56px 1fr', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#667085', fontWeight: 700 }}>数量</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{buy?.qty ?? '—'}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 6, border: '1px solid #eaecf0', borderRadius: 10, padding: isMobile ? 10 : '8px 10px', background: '#fcfdfd' }}>
                <b style={{ fontSize: 14 }}>売却</b>
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '64px 1fr' : '56px 1fr', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#667085', fontWeight: 700 }}>日付</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{isOpen ? '—' : (sell?.date || '—')}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '64px 1fr' : '56px 1fr', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#667085', fontWeight: 700 }}>価格</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{isOpen ? '—' : fmtMoney(sell?.price)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '64px 1fr' : '56px 1fr', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#667085', fontWeight: 700 }}>数量</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{isOpen ? '—' : (sell?.qty ?? '—')}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : showTradeDataContent ? (
            <div style={{ display: 'grid', gap: 12, paddingLeft: isMobile ? 0 : 10 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <b>買付</b>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 8 }}>
                  {renderEditDateInput({
                    value: form.buy_date,
                    onChange: (e) => setForm((p) => ({ ...p, buy_date: e.target.value })),
                  })}
                  <input
                    type="text"
                    min="1"
                    inputMode={marketPriceInputMode(data?.market)}
                    value={form.buy_price}
                    onChange={(e) => setForm((p) => ({ ...p, buy_price: normalizePriceInputByMarket(data?.market, e.target.value) }))}
                    placeholder="買付価格"
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
                        sell_qty: editIsOpen ? p.sell_qty : e.target.value,
                      }))
                    }
                    placeholder="買付数量"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <b>売却</b>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#344054' }}>
                  <input
                    type="checkbox"
                    checked={editIsOpen}
                    onChange={(e) => {
                      const nextOpen = e.target.checked
                      setEditIsOpen(nextOpen)
                      if (nextOpen) {
                        setForm((p) => ({ ...p, sell_date: '', sell_price: '', sell_qty: '', rating: 0 }))
                      } else {
                        setForm((p) => ({ ...p, sell_qty: String(p.buy_qty || '') }))
                      }
                    }}
                  />
                  保有中
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 8 }}>
                  {renderEditDateInput({
                    value: form.sell_date,
                    onChange: (e) => setForm((p) => ({ ...p, sell_date: e.target.value })),
                    disabled: editIsOpen,
                  })}
                  <input
                    type="text"
                    min="1"
                    inputMode={marketPriceInputMode(data?.market)}
                    value={form.sell_price}
                    onChange={(e) => setForm((p) => ({ ...p, sell_price: normalizePriceInputByMarket(data?.market, e.target.value) }))}
                    placeholder="売却価格"
                    disabled={editIsOpen}
                    style={{ opacity: editIsOpen ? 0.6 : 1 }}
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
                        buy_qty: editIsOpen ? p.buy_qty : e.target.value,
                      }))
                    }
                    placeholder="売却数量"
                    disabled={editIsOpen}
                    style={{ opacity: editIsOpen ? 0.6 : 1 }}
                  />
                </div>
                {editIsOpen ? (
                  <div style={{ fontSize: 12, color: '#667085' }}>
                    保有中で保存するため売却は入力不可です。売却済に戻すには保有中をOFFにして 売却日付・売却価格・売却数量 を入力してください。
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
      </div>
      {/* サマリー */}
      {!isEditing ? (
        <div style={{ marginTop: 0, border: '1px solid #ddd', borderRadius: 12, padding: 10, height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', fontSize: 15, color: '#111' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
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
            {isMobile ? (
              <button
                type="button"
                onClick={() => setIsSummaryOpenMobile((v) => !v)}
                style={{ ...baseButtonStyle, minHeight: 34, padding: '6px 10px', fontSize: 12 }}
              >
                {isSummaryOpenMobile ? '閉じる' : '開く'}
              </button>
            ) : null}
          </div>
          {showSummaryContent ? <div style={{ height: 1, background: '#eee', marginBottom: 10 }} /> : null}

          {showSummaryContent ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: isMobile ? 12 : 10, alignItems: 'start', paddingLeft: isMobile ? 0 : 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, opacity: 0.75 }}>損益</div>
                <div style={{ fontSize: isMobile ? 18 : 16, fontWeight: 700, color: profitColor, lineHeight: 1.25 }}>{profitLabel}</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, opacity: 0.75 }}>損益率</div>
                <div style={{ fontSize: isMobile ? 18 : 16, fontWeight: 700, color: profitRateColor, lineHeight: 1.25 }}>{profitRateLabel}</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, opacity: 0.75 }}>保有日数</div>
                <div style={{ fontSize: isMobile ? 18 : 16, fontWeight: 700, lineHeight: 1.25 }}>{isOpen ? '—' : `${data.holding_days ?? '—'} 日`}</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, opacity: 0.75 }}>評価</div>
                <div style={{ fontSize: isMobile ? 16 : 14, lineHeight: 1.25 }}>
                  <Rating value={data.rating} />
                </div>
              </div>
            </div>
          ) : null}

          {/* (Review badge and buttons moved to header and thought log sections) */}
        </div>
      ) : (
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
            タグ・評価
          </h3>
          <div style={{ height: 1, background: '#eee', marginBottom: 10 }} />

          <div style={{ display: 'grid', gap: 10, paddingLeft: 10 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#475467' }}>タグ</div>
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
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#475467' }}>評価</span>
                <select
                  value={form.rating}
                  onChange={(e) => setForm((p) => ({ ...p, rating: Number(e.target.value) }))}
                  disabled={editIsOpen}
                  style={{ opacity: editIsOpen ? 0.6 : 1 }}
                >
                  <option value={0}>—</option>
                  <option value={1}>★1</option>
                  <option value={2}>★2</option>
                  <option value={3}>★3</option>
                  <option value={4}>★4</option>
                  <option value={5}>★5</option>
                </select>
              </div>
              {editIsOpen ? <div style={{ fontSize: 12, color: '#667085' }}>保有中で保存すると評価は未選択に戻ります</div> : null}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* チャート */}
      <div style={{ marginTop: 10, border: '1px solid #ddd', borderRadius: 12, padding: 10, background: '#fff', fontSize: 15, color: '#111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: 8, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
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
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {CHART_INTERVAL_OPTIONS.map((opt) => {
                const active = interval === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (interval === opt.value) return
                      setInterval(opt.value)
                      setChartMode('entry')
                      setChartViewKey((k) => k + 1)
                    }}
                    style={{
                      ...chartControlButtonStyle,
                      minHeight: isMobile ? 34 : chartControlButtonStyle.height,
                      background: active ? '#344054' : chartControlButtonStyle.background,
                      color: active ? '#fff' : chartControlButtonStyle.color,
                      border: active ? '1px solid #344054' : chartControlButtonStyle.border,
                      boxShadow: active ? 'inset 0 0 0 1px rgba(255,255,255,0.08)' : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                setChartMode('entry')
                setChartViewKey((k) => k + 1)
              }}
              style={{
                ...chartControlButtonStyle,
                minHeight: isMobile ? 34 : chartControlButtonStyle.height,
                marginLeft: 4,
              }}
            >
              リセット
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
          <div style={{ position: 'relative', width: '100%', height: chartContainerHeight, overflow: 'hidden', borderRadius: 8 }}>
            <TradeChart
              bars={allBars}
              buyFill={buy}
              sellFill={isOpen ? null : sell}
              focusSpec={focusSpec}
              height={chartContainerHeight}
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

        <div style={{ display: 'grid', gap: 10, paddingLeft: isMobile ? 0 : 10 }}>
          {/* 購入理由 */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '84px 1fr', gap: isMobile ? 6 : 10, alignItems: 'start' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '84px 1fr', gap: isMobile ? 6 : 10, alignItems: 'start', opacity: isEditing && editIsOpen ? 0.6 : 1 }}>
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
                disabled={editIsOpen}
              />
            )}
          </div>

          <div style={{ height: 1, background: '#eee' }} />

          {/* 考察 */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '84px 1fr', gap: isMobile ? 6 : 10, alignItems: 'start', opacity: isEditing && editIsOpen ? 0.6 : 1 }}>
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
                disabled={editIsOpen}
              />
            )}
          </div>

        </div>
        </div>

        {!isOpen && !isEditing ? (
          <div style={{ marginTop: 8, display: 'grid', justifyItems: 'end', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              {isPendingReview ? (
                <button
                  type="button"
                  onClick={markReviewDone}
                  style={{ ...primaryButtonStyle, opacity: reviewDisabledReason ? 0.55 : 1, cursor: reviewDisabledReason ? 'not-allowed' : 'pointer' }}
                  disabled={Boolean(reviewDisabledReason)}
                  title={reviewDisabledReason || ''}
                >
                  レビュー完了
                </button>
              ) : (
                <button type="button" onClick={markReviewPending} style={baseButtonStyle}>未レビューに戻す</button>
              )}
            </div>
            {isPendingReview && reviewDisabledReason ? (
              <div style={{ fontSize: 12, color: '#b42318' }}>{reviewDisabledReason}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
