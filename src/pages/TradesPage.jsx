import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { api, formatJPY, formatUSD } from '../lib/api'
import { TAG_OPTIONS } from '../lib/tags'
import { listTrades } from '../lib/tradesApi'

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

function RatingStars({ value, size = 14 }) {
  const v = Number(value)
  if (!Number.isFinite(v) || v <= 0) return <span style={{ color: '#98a2b3' }}>—</span>

  const clamped = Math.max(0, Math.min(5, v))
  const pct = (clamped / 5) * 100

  return (
    <span
      style={{ position: 'relative', display: 'inline-block', lineHeight: 1, fontSize: size }}
      aria-label={`rating ${clamped.toFixed(1)}`}
      title={`平均評価 ${clamped.toFixed(1)}`}
    >
      <span style={{ color: '#d0d5dd' }}>{'★★★★★'}</span>
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${pct}%`,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          color: '#101828',
        }}
      >
        {'★★★★★'}
      </span>
    </span>
  )
}

function parseTags(tags) {
  if (!tags || typeof tags !== 'string') return []
  return tags
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}


function isValidDate10(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function clampDate10(value) {
  const v = String(value || '').slice(0, 10)
  return isValidDate10(v) ? v : ''
}

function clampMarket(value) {
  return value === 'JP' || value === 'US' ? value : 'all'
}

function clampRating(value) {
  if (value === '1' || value === '2' || value === '3' || value === '4' || value === '5') return value
  return 'all'
}

function clampPosition(value) {
  const v = String(value || '').trim()
  if (v === 'open' || v === 'closed' || v === 'all') return v
  return 'all'
}

function clampReview(value) {
  const v = String(value || '').trim()
  if (v === 'all' || v === 'pending' || v === 'done') return v
  return 'all'
}

function clampLimit(value) {
  const v = Number(value)
  if (v === 20 || v === 50 || v === 100) return v
  return 20
}

function clampPage(value) {
  const v = Number(value)
  if (!Number.isFinite(v) || v < 1) return 1
  return Math.floor(v)
}

function clampSort(value) {
  const v = String(value || '').trim()
  if (v === 'newest' || v === 'oldest') return 'sell_date'
  if (v === 'profit_desc' || v === 'profit_asc') return 'profit'
  if (v === 'roi_desc' || v === 'roi_asc') return 'roi'
  if (v === 'holding_desc' || v === 'holding_asc') return 'holding'
  if (v === 'rating_desc' || v === 'rating_asc') return 'rating'

  const allowed = new Set(SORT_OPTIONS.map((o) => o.value))
  return allowed.has(v) ? v : 'sell_date'
}

function clampSortDir(value) {
  return value === 'asc' || value === 'desc' ? value : 'desc'
}

function parseMultiParam(paramValue) {
  if (!paramValue) return []
  return String(paramValue)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function isOpenTrade(t) {
  if (!t) return false
  if (t.is_open === true) return true
  if (!t.closed_at) return true
  const hasSell = Array.isArray(t.fills) ? t.fills.some((f) => f?.side === 'sell') : true
  return !hasSell
}

function isPendingReviewTrade(t) {
  if (!t) return false
  return !Boolean(t.review_done)
}

function getProfitValue(t) {
  if (!t) return null
  if (t.profit_currency === 'USD') {
    return t.profit_usd == null ? null : Number(t.profit_usd)
  }
  return t.profit_jpy == null ? null : Number(t.profit_jpy)
}

function formatProfitByTrade(t) {
  const p = getProfitValue(t)
  if (p == null) return '—'

  const formatted = t?.profit_currency === 'USD' ? formatUSD(p) : formatJPY(p)
  return p > 0 ? `+${formatted}` : formatted
}

function getPrincipalValue(t) {
  if (!t || !Array.isArray(t.fills)) return null
  const buy = t.fills.find((f) => f?.side === 'buy')
  if (!buy) return null
  const price = Number(buy.price)
  const qty = Number(buy.qty)
  const fee = Number(buy.fee || 0)
  if (!Number.isFinite(price) || !Number.isFinite(qty) || !Number.isFinite(fee)) return null
  const principal = price * qty + fee
  if (!Number.isFinite(principal) || principal <= 0) return null
  return principal
}

function getRoiPct(t) {
  if (!t || isOpenTrade(t)) return null
  const profit = getProfitValue(t)
  const principal = getPrincipalValue(t)
  if (profit == null || principal == null) return null
  return (profit / principal) * 100
}

function formatRoiPct(t) {
  const roi = getRoiPct(t)
  if (roi == null) return '—'
  const s = `${roi.toFixed(1)}%`
  return roi > 0 ? `+${s}` : s
}

const SORT_OPTIONS = [
  { value: 'buy_date', label: '購入日' },
  { value: 'sell_date', label: '売却日' },
  { value: 'name', label: '表示名' },
  { value: 'profit', label: '損益額' },
  { value: 'roi', label: '損益率' },
  { value: 'holding', label: '保有期間' },
  { value: 'rating', label: '評価' },
]

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? '1px solid #2a9d8f' : '1px solid #ddd',
        background: active ? '#e8f7f4' : '#fff',
        color: '#333',
        borderRadius: 999,
        padding: '4px 10px',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}


export default function TradesPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const baseButtonStyle = {
    background: '#fff',
    color: '#111',
    border: '1px solid #d0d5dd',
    borderRadius: 10,
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 500,
  }
  const primaryButtonStyle = {
    background: '#344054',
    color: '#fff',
    border: '1px solid #344054',
    borderRadius: 10,
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 600,
  }
  const actionBtnStyle = { ...primaryButtonStyle, minWidth: 140, whiteSpace: 'nowrap' }

  // URL -> state 初期値（直アクセス/リロードで復元）
  const initial = useMemo(() => {
    const q = searchParams.get('q') || ''
    const marketRaw = parseMultiParam(searchParams.get('market'))
    const market = marketRaw
      .map((m) => clampMarket(m))
      .filter((m) => m !== 'all')
      .filter((v, i, a) => a.indexOf(v) === i)
    const ratingRaw = parseMultiParam(searchParams.get('rating'))
    const rating = ratingRaw
      .map((r) => clampRating(r))
      .filter((r) => r !== 'all')
      .filter((v, i, a) => a.indexOf(v) === i)
    const tag = parseMultiParam(searchParams.get('tag'))
    const sort = clampSort(searchParams.get('sort'))
    const sortDir = clampSortDir(searchParams.get('sort_dir'))
    const page = clampPage(searchParams.get('page') || 1)
    const limit = clampLimit(searchParams.get('limit') || 20)
    const winFrom = clampDate10(searchParams.get('win_from'))
    const winTo = clampDate10(searchParams.get('win_to'))
    const winOnly = searchParams.get('win_only') === '1'
    const lossOnly = searchParams.get('loss_only') === '1'
    const position = clampPosition(searchParams.get('pos'))
    const review = clampReview(searchParams.get('review'))
    return { q, market, rating, tag, position, review, sort, sortDir, page, limit, winFrom, winTo, winOnly, lossOnly }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [search, setSearch] = useState(() => initial.q)
  const [marketFilters, setMarketFilters] = useState(() => initial.market)
  const [ratingFilters, setRatingFilters] = useState(() => initial.rating)
  const [tagFilters, setTagFilters] = useState(() => initial.tag)
  const [sortKey, setSortKey] = useState(() => initial.sort)
  const [sortDir, setSortDir] = useState(() => initial.sortDir)
  const [page, setPage] = useState(() => initial.page)
  const [limit, setLimit] = useState(() => initial.limit)
  const [winFrom, setWinFrom] = useState(() => initial.winFrom)
  const [winTo, setWinTo] = useState(() => initial.winTo)
  const [winOnly, setWinOnly] = useState(() => initial.winOnly)
  const [lossOnly, setLossOnly] = useState(() => initial.lossOnly)
  const [position, setPosition] = useState(() => initial.position)
  const [reviewFilter, setReviewFilter] = useState(() => initial.review)

  // state -> URL 同期（戻る対応）
  // - search(q) は入力中に履歴が増えると邪魔なので replace で更新
  const searchDebounceRef = useRef(null)

  // Market/Rating/Tag/Sort は即時 URL 更新（履歴を残す）
  useEffect(() => {
    const next = new URLSearchParams(searchParams)

    if (marketFilters.length > 0) next.set('market', marketFilters.join(','))
    else next.delete('market')

    if (ratingFilters.length > 0) next.set('rating', ratingFilters.join(','))
    else next.delete('rating')

    if (tagFilters.length > 0) next.set('tag', tagFilters.join(','))
    else next.delete('tag')

    if (sortKey && sortKey !== 'sell_date') next.set('sort', sortKey)
    else next.delete('sort')

    if (sortDir && sortDir !== 'desc') next.set('sort_dir', sortDir)
    else next.delete('sort_dir')

    if (page > 1) next.set('page', String(page))
    else next.delete('page')

    if (limit !== 20) next.set('limit', String(limit))
    else next.delete('limit')

    if (winFrom) next.set('win_from', winFrom)
    else next.delete('win_from')

    if (winTo) next.set('win_to', winTo)
    else next.delete('win_to')

    if (winOnly) next.set('win_only', '1')
    else next.delete('win_only')
    if (lossOnly) next.set('loss_only', '1')
    else next.delete('loss_only')
    if (position && position !== 'all') next.set('pos', position)
    else next.delete('pos')
    if (reviewFilter && reviewFilter !== 'all') next.set('review', reviewFilter)
    else next.delete('review')

    // q は別effectで処理（デバウンス）
    // ただし、他フィルタ更新で q が消えないよう現在の q は保持する
    const q = searchParams.get('q')
    if (q) next.set('q', q)
    else next.delete('q')

    const cur = searchParams.toString()
    const merged = next.toString()
    if (cur === merged) return

    setSearchParams(next, { replace: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketFilters, ratingFilters, tagFilters, position, reviewFilter, sortKey, sortDir, page, limit, winFrom, winTo, winOnly, lossOnly])

  // q はデバウンスして URL 更新（replaceで履歴爆発を防ぐ）
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      const q = search.trim()
      if (q) next.set('q', q)
      else next.delete('q')
      if (searchParams.toString() === next.toString()) return
      setSearchParams(next, { replace: true })
    }, 350)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Ref for "現在の条件" section (scroll target)
  const activeConditionsRef = useRef(null)

  const pageResetRef = useRef(false)
  useEffect(() => {
    if (!pageResetRef.current) {
      pageResetRef.current = true
      return
    }
    setPage(1)
  }, [search, marketFilters, ratingFilters, tagFilters, position, reviewFilter, sortKey, sortDir, winFrom, winTo, winOnly, lossOnly, limit])

  const queryParams = useMemo(
    () => ({
      limit,
      offset: (page - 1) * limit,
      q: search.trim() || undefined,
      market: marketFilters.length > 0 ? marketFilters.join(',') : undefined,
      rating: ratingFilters.length > 0 ? ratingFilters.join(',') : undefined,
      tag: tagFilters.length > 0 ? tagFilters.join(',') : undefined,
      pos: position !== 'all' ? position : undefined,
      review: reviewFilter !== 'all' ? reviewFilter : undefined,
      win_only: winOnly ? '1' : undefined,
      loss_only: lossOnly ? '1' : undefined,
      win_from: winFrom || undefined,
      win_to: winTo || undefined,
      sort: sortKey,
      sort_dir: sortDir,
    }),
    [limit, page, search, marketFilters, ratingFilters, tagFilters, position, reviewFilter, winOnly, lossOnly, winFrom, winTo, sortKey, sortDir]
  )

  const { data, isLoading, error } = useQuery({
    queryKey: ['trades', queryParams],
    queryFn: () => listTrades(queryParams),
  })

  const items = Array.isArray(data?.items) ? data.items : []
  const total = Number(data?.total || 0)
  const totalPages = Math.max(1, Math.ceil(total / limit))
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const allTags = useMemo(() => {
    return TAG_OPTIONS
  }, [])

  const sortLabel = useMemo(() => SORT_OPTIONS.find((o) => o.value === sortKey)?.label || sortKey, [sortKey])

  const stats = useMemo(
    () => ({
      totalProfitJPY: Number(data?.stats?.total_profit_jpy || 0),
      totalProfitUSD: Number(data?.stats?.total_profit_usd || 0),
      winRate: data?.stats?.win_rate ?? null,
      avgHolding: data?.stats?.avg_holding_days ?? null,
      avgRoiPct: data?.stats?.avg_roi_pct ?? null,
      avgRating: data?.stats?.avg_rating ?? null,
      pendingReviewCount: Number(data?.stats?.pending_review_count || 0),
    }),
    [data]
  )

  const hasAnyFilter =
    search.trim() ||
    marketFilters.length > 0 ||
    ratingFilters.length > 0 ||
    tagFilters.length > 0 ||
    sortKey !== 'sell_date' ||
    sortDir !== 'desc' ||
    page !== 1 ||
    limit !== 20 ||
    winOnly ||
    lossOnly ||
    position !== 'all' ||
    reviewFilter !== 'all' ||
    winFrom ||
    winTo

  const activeLabel = useMemo(() => {
    const parts = []
    if (marketFilters.length > 0) parts.push(`Market:${marketFilters.join(',')}`)
    if (ratingFilters.length > 0) parts.push(`評価:${ratingFilters.join(',')}`)
    if (tagFilters.length > 0) parts.push(`Tag:${tagFilters.join(',')}`)
    if (search.trim()) parts.push(`Search:"${search.trim()}"`)
    if (winOnly) parts.push('利確のみ')
    if (lossOnly) parts.push('損切りのみ')
    if (position === 'open') parts.push('保有中')
    if (position === 'closed') parts.push('確定済')
    if (reviewFilter === 'pending') parts.push('未レビュー')
    if (reviewFilter === 'done') parts.push('レビュー済')
    if (winFrom || winTo) parts.push(`Period:${winFrom || '—'}〜${winTo || '—'}`)
    parts.push(`Sort:${sortLabel}(${sortDir === 'asc' ? '昇順' : '降順'})`)
    return parts.join(' / ')
  }, [marketFilters, ratingFilters, tagFilters, position, reviewFilter, search, sortLabel, sortDir, winOnly, lossOnly, winFrom, winTo])

  function resetAll() {
    setSearch('')
    setMarketFilters([])
    setRatingFilters([])
    setTagFilters([])
    setSortKey('sell_date')
    setSortDir('desc')
    setPage(1)
    setLimit(20)
    setWinOnly(false)
    setLossOnly(false)
    setPosition('all')
    setReviewFilter('all')
    setWinFrom('')
    setWinTo('')
  }

  function toggleArrayFilter(value, list, setter) {
    const v = String(value || '').trim()
    if (!v) return
    const has = list.includes(v)
    if (has) setter(list.filter((x) => x !== v))
    else setter([...list, v])
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 0, marginBottom: 0 }}>
        <h2 style={{ margin: 0 }}>投資記録</h2>
        <Link to="/trades/new">
          <button style={actionBtnStyle}>＋ 新規トレード</button>
        </Link>
      </div>


      {/* サマリー統計 */}
      <div
        style={{
          marginTop: 10,
          border: '1px solid #eee',
          borderRadius: 12,
          padding: '10px 12px',
          background: '#fafafa',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{ fontSize: 12, color: '#667085' }}>合計損益（JPY）</div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color:
                stats.totalProfitJPY > 0 ? '#067647' : stats.totalProfitJPY < 0 ? '#b42318' : '#344054',
            }}
          >
            {stats.totalProfitJPY > 0 ? `+${formatJPY(stats.totalProfitJPY)}` : formatJPY(stats.totalProfitJPY)}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{ fontSize: 12, color: '#667085' }}>合計損益（USD）</div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color:
                stats.totalProfitUSD > 0 ? '#067647' : stats.totalProfitUSD < 0 ? '#b42318' : '#344054',
            }}
          >
            {stats.totalProfitUSD > 0 ? `+${formatUSD(stats.totalProfitUSD)}` : formatUSD(stats.totalProfitUSD)}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{ fontSize: 12, color: '#667085' }}>平均損益率</div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: stats.avgRoiPct == null ? '#344054' : stats.avgRoiPct > 0 ? '#067647' : stats.avgRoiPct < 0 ? '#b42318' : '#344054',
            }}
          >
            {stats.avgRoiPct == null ? '—' : stats.avgRoiPct > 0 ? `+${stats.avgRoiPct.toFixed(1)}%` : `${stats.avgRoiPct.toFixed(1)}%`}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{ fontSize: 12, color: '#667085' }}>勝率</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#344054' }}>
              {stats.winRate == null ? '—' : `${Math.round(stats.winRate)}%`}
            </div>

            {stats.winRate == null ? null : (
              <div
                aria-label={`win rate ${Math.round(stats.winRate)}%`}
                title={`勝率 ${Math.round(stats.winRate)}%`}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: `conic-gradient(#2a9d8f ${stats.winRate}%, #eaecf0 0)`,
                  position: 'relative',
                  flex: '0 0 auto',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 4,
                    borderRadius: 999,
                    background: '#fafafa',
                    border: '1px solid #f2f4f7',
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{ fontSize: 12, color: '#667085' }}>平均保有日数</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#344054' }}>
            {stats.avgHolding == null ? '—' : `${Math.round(stats.avgHolding)} 日`}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{ fontSize: 12, color: '#667085' }}>平均評価</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#344054' }}>
              {stats.avgRating == null ? '—' : stats.avgRating.toFixed(1)}
            </div>
            {stats.avgRating == null ? null : <RatingStars value={stats.avgRating} size={14} />}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{ fontSize: 12, color: '#667085' }}>未レビュー件数</div>
          <button
            type="button"
            onClick={() => {
              if (stats.pendingReviewCount <= 0) return
              setReviewFilter('pending')
              // "現在の条件" の位置へスクロール（絞り込み結果をすぐ確認できる）
              window.setTimeout(() => {
                activeConditionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }, 0)
            }}
            disabled={stats.pendingReviewCount <= 0}
            title={stats.pendingReviewCount > 0 ? 'クリックで未レビューに絞り込み' : '未レビューはありません'}
            aria-label="未レビュー件数で絞り込み"
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: stats.pendingReviewCount > 0 ? '#b42318' : '#344054',
              background: 'transparent',
              border: 'none',
              padding: 0,
              textAlign: 'left',
              cursor: stats.pendingReviewCount > 0 ? 'pointer' : 'not-allowed',
              textDecoration: stats.pendingReviewCount > 0 ? 'underline' : 'none',
              opacity: stats.pendingReviewCount > 0 ? 1 : 0.7,
              width: 'fit-content',
            }}
          >
            {stats.pendingReviewCount}
          </button>
        </div>
      </div>

      {/* 期間 + Sort（横並び） */}
      <div
        style={{
          marginTop: 12,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 10,
          alignItems: 'start',
        }}
      >
        {/* Period */}
        <div
          style={{
            border: '1px solid #eee',
            borderRadius: 12,
            padding: '8px 10px',
            background: '#fafafa',
            display: 'grid',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 11, opacity: 0.8 }}>Period</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <input
              type="date"
              value={winFrom}
              onChange={(e) => setWinFrom(clampDate10(e.target.value))}
              max={winTo || undefined}
              style={{ height: 34, padding: '6px 8px', borderRadius: 10, border: '1px solid #ddd', background: '#fff' }}
            />
            <span style={{ opacity: 0.7, fontSize: 12 }}>〜</span>
            <input
              type="date"
              value={winTo}
              onChange={(e) => setWinTo(clampDate10(e.target.value))}
              min={winFrom || undefined}
              style={{ height: 34, padding: '6px 8px', borderRadius: 10, border: '1px solid #ddd', background: '#fff' }}
            />
          </div>
        </div>

        {/* Sort */}
        <div
          style={{
            border: '1px solid #eee',
            borderRadius: 12,
            padding: '8px 10px',
            background: '#fafafa',
            display: 'grid',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 11, opacity: 0.8 }}>Sort</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              style={{ height: 34, padding: '6px 8px', borderRadius: 10, border: '1px solid #ddd', background: '#fff' }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              title={sortDir === 'asc' ? '昇順 → 降順' : '降順 → 昇順'}
              aria-label={sortDir === 'asc' ? '昇順' : '降順'}
              style={{
                ...baseButtonStyle,
                padding: '6px 10px',
                fontWeight: 800,
                lineHeight: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 40,
              }}
            >
              {sortDir === 'asc' ? '▲' : '▼'}
            </button>

            <span style={{ fontSize: 11, color: '#667085' }}>{sortDir === 'asc' ? '昇順' : '降順'}</span>
          </div>
        </div>
      </div>

      {/* 統合フィルター */}
      <div style={{ marginTop: 10, border: '1px solid #eee', borderRadius: 12, padding: '10px 12px', background: '#fafafa', display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Search（Key word）</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="symbol/name/notes"
          />
        </label>

        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Review</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <FilterChip
              active={reviewFilter === 'all'}
              onClick={() => {
                if (reviewFilter === 'all') return
                setReviewFilter('all')
              }}
            >
              All
            </FilterChip>
            <FilterChip
              active={reviewFilter === 'pending'}
              onClick={() => setReviewFilter((prev) => (prev === 'pending' ? 'all' : 'pending'))}
            >
              未レビュー
            </FilterChip>
            <FilterChip
              active={reviewFilter === 'done'}
              onClick={() => setReviewFilter((prev) => (prev === 'done' ? 'all' : 'done'))}
            >
              レビュー済
            </FilterChip>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Market</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <FilterChip active={marketFilters.length === 0} onClick={() => setMarketFilters([])}>All</FilterChip>
            {['JP', 'US'].map((m) => (
              <FilterChip
                key={m}
                active={marketFilters.includes(m)}
                onClick={() => toggleArrayFilter(m, marketFilters, setMarketFilters)}
              >
                {m}
              </FilterChip>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Position</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <FilterChip
              active={position === 'all'}
              onClick={() => {
                if (position === 'all') return
                setPosition('all')
              }}
            >
              All
            </FilterChip>
            <FilterChip
              active={position === 'closed'}
              onClick={() => setPosition((prev) => (prev === 'closed' ? 'all' : 'closed'))}
            >
              確定済
            </FilterChip>
            <FilterChip
              active={position === 'open'}
              onClick={() => setPosition((prev) => (prev === 'open' ? 'all' : 'open'))}
            >
              保有中
            </FilterChip>
          </div>
        </div>


        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Result</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <FilterChip
              active={!winOnly && !lossOnly}
              onClick={() => {
                if (!winOnly && !lossOnly) return
                setWinOnly(false)
                setLossOnly(false)
              }}
            >
              All
            </FilterChip>
            <FilterChip
              active={winOnly}
              onClick={() => {
                if (winOnly) {
                  setWinOnly(false)
                  setLossOnly(false)
                  return
                }
                setWinOnly(true)
                setLossOnly(false)
              }}
            >
              利確
            </FilterChip>
            <FilterChip
              active={lossOnly}
              onClick={() => {
                if (lossOnly) {
                  setLossOnly(false)
                  setWinOnly(false)
                  return
                }
                setLossOnly(true)
                setWinOnly(false)
              }}
            >
              損切り
            </FilterChip>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Rating</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <FilterChip active={ratingFilters.length === 0} onClick={() => setRatingFilters([])}>All</FilterChip>
            {['1', '2', '3', '4', '5'].map((r) => (
              <FilterChip
                key={r}
                active={ratingFilters.includes(r)}
                onClick={() => toggleArrayFilter(r, ratingFilters, setRatingFilters)}
              >
                ★{r}
              </FilterChip>
            ))}
          </div>
        </div>

        {allTags.length > 0 && (
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Tag</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <FilterChip active={tagFilters.length === 0} onClick={() => setTagFilters([])}>All</FilterChip>
              {allTags.map((tag) => (
                <FilterChip
                  key={tag}
                  active={tagFilters.includes(tag)}
                  onClick={() => toggleArrayFilter(tag, tagFilters, setTagFilters)}
                >
                  {tag}
                </FilterChip>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 現在の条件 + リセット（フィルターの直下） */}
      <div
        ref={activeConditionsRef}
        style={{
          marginTop: 6,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.2 }}>
          <b>現在の条件</b>：{activeLabel}
          <span style={{ marginLeft: 8 }}>(件数 {total})</span>
        </div>

        <button
          type="button"
          disabled={!hasAnyFilter}
          onClick={() => {
            if (!hasAnyFilter) return
            resetAll()
          }}
          style={{
            ...baseButtonStyle,
            opacity: hasAnyFilter ? 1 : 0.45,
            cursor: hasAnyFilter ? 'pointer' : 'not-allowed',
          }}
        >
          全てクリア
        </button>
      </div>

      <div
        style={{
          marginTop: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>表示件数</span>
          {[20, 50, 100].map((n) => (
            <FilterChip key={n} active={limit === n} onClick={() => setLimit(n)}>
              {n}
            </FilterChip>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="前のページ"
            title="前のページ"
            style={{ ...baseButtonStyle, padding: '6px 10px', opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
          >
            ◀
          </button>
          <span style={{ fontSize: 12, opacity: 0.8 }}>
            {Math.min(page, totalPages)} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            aria-label="次のページ"
            title="次のページ"
            style={{ ...baseButtonStyle, padding: '6px 10px', opacity: page >= totalPages ? 0.5 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            ▶
          </button>
        </div>
      </div>

      {/* 一覧との区切り */}
      <div style={{ marginTop: 10, borderTop: '1px solid #eaecf0' }} />

      {isLoading && <p>読み込み中…</p>}
      {error && <p style={{ color: 'crimson' }}>エラー: {String(error.message || error)}</p>}

      {!isLoading && !error && items.length === 0 && (
        <p>まだ投資記録がありません。右上の「新規トレード」から作成できます。</p>
      )}

      <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
        {items.map((t) => (
          <Link key={t.id} to={`/trades/${t.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 10, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#667085' }}>{t.market}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#101828' }}>{t.symbol}</span>
                    {t.name ? <span style={{ fontSize: 13, color: '#475467' }}>({t.name})</span> : null}
                    {isPendingReviewTrade(t) ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: '#344054',
                          background: '#fdf2f2',
                          border: '1px solid #fecaca',
                          borderRadius: 999,
                          padding: '2px 8px',
                          lineHeight: 1.2,
                        }}
                      >
                        未レビュー
                      </span>
                    ) : null}
                  </div>
                  {(t.opened_at || t.closed_at) && (
                    <>
                      <div style={{ marginTop: 1, fontSize: 12, color: '#475467', fontWeight: 700 }}>
                        {t.opened_at && t.closed_at ? (
                          <>
                            {t.opened_at} → {t.closed_at}
                          </>
                        ) : t.opened_at ? (
                          <>
                            {t.opened_at} → —
                          </>
                        ) : (
                          <>{t.closed_at || t.opened_at}</>
                        )}
                        {isOpenTrade(t) ? <span style={{ marginLeft: 6, color: '#667085' }}>/ 保有中</span> : null}
                      </div>
                      <div style={{ marginTop: 1, fontSize: 12, color: '#475467', fontWeight: 700 }}>
                        保有 {t.holding_days ?? '—'} 日
                      </div>
                    </>
                  )}
                </div>
                <div style={{ textAlign: 'right', display: 'grid', gap: 4, justifyItems: 'end' }}>
                  {isOpenTrade(t) ? (
                    <>
                      <div style={{ fontWeight: 800, color: '#344054' }}>—</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#344054' }}>—</div>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          fontWeight: 800,
                          color:
                            Number(getProfitValue(t) || 0) > 0
                              ? '#067647'
                              : Number(getProfitValue(t) || 0) < 0
                                ? '#b42318'
                                : '#344054',
                        }}
                      >
                        {formatProfitByTrade(t)}
                      </div>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 13,
                          color:
                            Number(getRoiPct(t) || 0) > 0
                              ? '#067647'
                              : Number(getRoiPct(t) || 0) < 0
                                ? '#b42318'
                                : '#344054',
                        }}
                      >
                        {formatRoiPct(t)}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div
                style={{
                  marginTop: 6,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                {/* タグ（左下） */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minWidth: 0,
                    flexWrap: 'wrap',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                  }}
                >
                  {parseTags(t.tags).length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start' }}>
                      {parseTags(t.tags).map((tag) => {
                        const active = tagFilters.includes(tag)
                        return (
                          <button
                            key={`${t.id}-${tag}`}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              toggleArrayFilter(tag, tagFilters, setTagFilters)
                            }}
                            style={{
                              fontSize: 12,
                              color: '#344054',
                              background: active ? '#e8f7f4' : '#f2f4f7',
                              border: active ? '1px solid #2a9d8f' : '1px solid #eaecf0',
                              borderRadius: 999,
                              padding: '4px 10px',
                              lineHeight: 1.2,
                              cursor: 'pointer',
                            }}
                            title={active ? 'クリックで絞り込み解除' : 'クリックでタグ絞り込み'}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, opacity: 0.85 }}>—</span>
                  )}
                </div>

                {/* 評価（右下） */}
                <div style={{ fontSize: 13, whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <Rating value={t.rating} />
                </div>
              </div>

            </div>
          </Link>
        ))}
      </div>

      {/* 下部ページャー */}
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          aria-label="前のページ"
          title="前のページ"
          style={{ ...baseButtonStyle, padding: '6px 10px', opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
        >
          ◀
        </button>
        <span style={{ fontSize: 12, opacity: 0.8 }}>
          {Math.min(page, totalPages)} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          aria-label="次のページ"
          title="次のページ"
          style={{ ...baseButtonStyle, padding: '6px 10px', opacity: page >= totalPages ? 0.5 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
        >
          ▶
        </button>
      </div>
    </div>
  )

}
