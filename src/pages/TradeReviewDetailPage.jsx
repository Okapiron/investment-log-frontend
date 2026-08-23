import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import TradeReviewCharts from '../components/TradeReviewCharts'
import TradeReviewPanel from '../components/TradeReviewPanel'
import { formatJPY, formatUSD } from '../lib/api'
import { getTrade } from '../lib/tradesApi'
import { getTradeReviewCharts } from '../lib/chartsApi'
import { completeTradeReview, patchTradeReview } from '../lib/reviewApi'

function formatProfit(trade) {
  const currency = trade?.profit_currency || 'JPY'
  const value = currency === 'USD' ? trade?.profit_usd : trade?.profit_jpy
  if (value == null) return '損益 -'
  const formatted = currency === 'USD' ? formatUSD(value) : formatJPY(value)
  return Number(value) > 0 ? `+${formatted}` : formatted
}

function reviewFromTrade(trade) {
  if (!trade) return {}
  return {
    strategy_timeframe: trade.strategy_timeframe || 'daily',
    entry_pattern: trade.entry_pattern || '',
    entry_pattern_other: trade.entry_pattern_note || '',
    entry_evaluation: trade.entry_evaluation || '',
    exit_evaluation: trade.exit_evaluation || '',
    exit_reason:
      trade.exit_reason === 'trend_end'
        ? 'trend_ended'
        : trade.exit_reason === 'unexpected_drop'
          ? 'unexpected_sharp_drop'
          : trade.exit_reason || '',
    exit_reason_other: trade.exit_reason_note || '',
    learning_note: trade.notes_review || '',
    next_action_note: trade.next_action_note || '',
  }
}

function missingReviewItems(review) {
  const missing = []
  if (!String(review?.strategy_timeframe || '').trim()) missing.push('主戦略足')
  if (!String(review?.entry_pattern || '').trim()) missing.push('エントリーパターン')
  if (review?.entry_pattern === 'other' && !String(review?.entry_pattern_other || '').trim()) missing.push('その他パターン')
  if (!String(review?.entry_evaluation || '').trim()) missing.push('エントリー評価')
  if (!String(review?.exit_evaluation || '').trim()) missing.push('決済評価')
  if (!String(review?.exit_reason || '').trim()) missing.push('決済理由')
  if (review?.exit_reason === 'other' && !String(review?.exit_reason_other || '').trim()) missing.push('その他決済理由')
  if (!String(review?.learning_note || '').trim()) missing.push('学び')
  if (!String(review?.next_action_note || '').trim()) missing.push('次回どうするか')
  return missing
}

function getTradeTitle(trade) {
  const symbol = String(trade?.symbol || '').trim()
  const name = String(trade?.name || '').trim()
  if (symbol && name) return `${symbol} ${name}`
  return symbol || name || 'Trade'
}

export default function TradeReviewDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mainTimeframe, setMainTimeframe] = useState('daily')
  const [indicatorMode, setIndicatorMode] = useState('none')
  const [review, setReview] = useState({})
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [nextReviewTradeId, setNextReviewTradeId] = useState(null)

  const tradeQuery = useQuery({
    queryKey: ['trade', id],
    queryFn: () => getTrade(id),
    enabled: Boolean(id),
  })

  const trade = tradeQuery.data
  const chartsQuery = useQuery({
    queryKey: ['trade-review-charts', trade?.market, trade?.symbol],
    queryFn: () => getTradeReviewCharts({ market: trade?.market || 'JP', symbol: trade?.symbol }),
    enabled: Boolean(trade?.symbol),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  useEffect(() => {
    if (!trade) return
    setReview(reviewFromTrade(trade))
    setDirty(false)
    setSaveStatus('idle')
    setMessage('')
    setError('')
  }, [trade])

  const completionMissingItems = useMemo(() => missingReviewItems(review), [review])

  function handleReviewChange(next) {
    setReview(next)
    setDirty(true)
    setSaveStatus('idle')
  }

  async function saveReview() {
    try {
      setError('')
      setMessage('')
      setSaveStatus('saving')
      await patchTradeReview(id, review)
      await queryClient.invalidateQueries({ queryKey: ['trade', id] })
      setDirty(false)
      setSaveStatus('saved')
      setMessage('レビューを保存しました。')
    } catch (e) {
      setSaveStatus('idle')
      setError(String(e?.message || e || 'レビュー保存に失敗しました。'))
      throw e
    }
  }

  async function handleComplete() {
    try {
      setError('')
      setMessage('')
      if (dirty) {
        await saveReview()
      }
      const result = await completeTradeReview(id)
      await queryClient.invalidateQueries({ queryKey: ['trade', id] })
      setNextReviewTradeId(result?.next_review_trade_id || null)
      setSaveStatus('saved')
      setMessage('レビューを完了しました。')
    } catch (e) {
      setError(String(e?.message || e || 'レビュー完了に失敗しました。'))
    }
  }

  if (tradeQuery.isLoading) {
    return <div style={{ padding: 16 }}>読み込み中...</div>
  }

  if (tradeQuery.error) {
    return <div style={{ padding: 16, color: '#b42318' }}>Tradeの取得に失敗しました: {String(tradeQuery.error?.message || tradeQuery.error)}</div>
  }

  if (!trade) {
    return <div style={{ padding: 16 }}>Tradeがありません。</div>
  }

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 1440, margin: '0 auto' }}>
      <section
        style={{
          border: '1px solid #d0d5dd',
          borderRadius: 8,
          background: '#fff',
          padding: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#101828' }}>{getTradeTitle(trade)}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: '#475467' }}>
            <span>買付 {trade.opened_at || '-'}</span>
            <span>売却 {trade.closed_at || '-'}</span>
            <span>{trade.holding_days == null ? '保有日数 -' : `${trade.holding_days}日保有`}</span>
            <span>{formatProfit(trade)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {dirty ? <span style={{ fontSize: 12, color: '#b54708' }}>未保存の変更あり</span> : null}
          {nextReviewTradeId ? (
            <button
              type="button"
              onClick={() => navigate(`/trades/${nextReviewTradeId}`)}
              style={{
                border: '1px solid #2f6fed',
                background: '#2f6fed',
                color: '#fff',
                borderRadius: 8,
                padding: '9px 11px',
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              次の未レビューへ
            </button>
          ) : null}
          <Link to="/trades" style={{ fontSize: 13 }}>一覧へ</Link>
        </div>
      </section>

      {message ? <div style={{ border: '1px solid #abefc6', background: '#ecfdf3', color: '#067647', borderRadius: 8, padding: 10, fontSize: 13 }}>{message}</div> : null}
      {error ? <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#b42318', borderRadius: 8, padding: 10, fontSize: 13 }}>{error}</div> : null}
      {chartsQuery.error ? (
        <div style={{ border: '1px solid #fedf89', background: '#fffaeb', color: '#92400e', borderRadius: 8, padding: 10, fontSize: 13 }}>
          チャート取得に失敗しました: {String(chartsQuery.error?.message || chartsQuery.error)}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 12, alignItems: 'start' }}>
        <TradeReviewCharts
          trade={trade}
          seriesByTimeframe={chartsQuery.data || {}}
          mainTimeframe={mainTimeframe}
          indicatorMode={indicatorMode}
          onMainTimeframeChange={setMainTimeframe}
          onIndicatorModeChange={setIndicatorMode}
        />
        <TradeReviewPanel
          review={review}
          onChange={handleReviewChange}
          onSave={saveReview}
          onComplete={handleComplete}
          saveStatus={saveStatus}
          completionMissingItems={completionMissingItems}
        />
      </div>
    </div>
  )
}
