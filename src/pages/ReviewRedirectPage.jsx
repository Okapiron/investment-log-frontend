import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import {
  ENTRY_EVALUATION_OPTIONS,
  ENTRY_PATTERN_OPTIONS,
  EXIT_EVALUATION_OPTIONS,
  EXIT_REASON_OPTIONS,
  TIMEFRAME_OPTIONS,
} from '../components/TradeReviewPanel'
import { formatJPY, formatUSD } from '../lib/api'
import { listTrades } from '../lib/tradesApi'

const ENTRY_PATTERN_LABELS = Object.fromEntries(ENTRY_PATTERN_OPTIONS.map((item) => [item.value, item.label]))
const ENTRY_EVALUATION_LABELS = Object.fromEntries(ENTRY_EVALUATION_OPTIONS.map((item) => [item.value, item.label]))
const EXIT_EVALUATION_LABELS = Object.fromEntries(EXIT_EVALUATION_OPTIONS.map((item) => [item.value, item.label]))
const EXIT_REASON_LABELS = Object.fromEntries(EXIT_REASON_OPTIONS.map((item) => [item.value, item.label]))
const TIMEFRAME_LABELS = Object.fromEntries(TIMEFRAME_OPTIONS.map((item) => [item.value, item.label]))

function isOpenTrade(trade) {
  if (!trade) return false
  if (trade.is_open === true) return true
  if (!trade.closed_at) return true
  const hasSell = Array.isArray(trade.fills) ? trade.fills.some((fill) => fill?.side === 'sell') : true
  return !hasSell
}

function profitValue(trade) {
  if (!trade) return 0
  if (trade.profit_currency === 'USD') return Number(trade.profit_usd || 0)
  return Number(trade.profit_jpy || 0)
}

function formatProfit(tradeOrValue, currency = 'JPY') {
  const value = typeof tradeOrValue === 'object' ? profitValue(tradeOrValue) : Number(tradeOrValue || 0)
  const formatted = currency === 'USD' ? formatUSD(value) : formatJPY(value)
  return value > 0 ? `+${formatted}` : formatted
}

function pct(value) {
  if (!Number.isFinite(Number(value))) return '-'
  return `${Number(value).toFixed(0)}%`
}

function labelFor(labels, value, note) {
  if (!value) return ''
  if (value === 'other' && note) return `その他: ${note}`
  return labels[value] || value
}

function tradeTitle(trade) {
  const symbol = String(trade?.symbol || '').trim()
  const name = String(trade?.name || '').trim()
  if (symbol && name) return `${symbol} ${name}`
  return symbol || name || 'Trade'
}

function hasReviewSignal(trade) {
  return Boolean(
    trade?.review_done ||
      trade?.strategy_timeframe ||
      trade?.entry_pattern ||
      trade?.entry_evaluation ||
      trade?.exit_evaluation ||
      trade?.exit_reason ||
      trade?.notes_review ||
      trade?.next_action_note,
  )
}

function aggregate(trades, getter) {
  const groups = new Map()
  trades.forEach((trade) => {
    const key = getter(trade)
    if (!key) return
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        count: 0,
        wins: 0,
        losses: 0,
        totalProfit: 0,
        holdingTotal: 0,
        holdingCount: 0,
        examples: [],
      })
    }
    const group = groups.get(key)
    const profit = profitValue(trade)
    group.count += 1
    group.totalProfit += profit
    if (profit > 0) group.wins += 1
    if (profit < 0) group.losses += 1
    if (Number.isFinite(Number(trade.holding_days))) {
      group.holdingTotal += Number(trade.holding_days)
      group.holdingCount += 1
    }
    if (group.examples.length < 3) group.examples.push(trade)
  })
  return [...groups.values()]
    .map((group) => ({
      ...group,
      avgProfit: group.count ? group.totalProfit / group.count : 0,
      winRate: group.count ? (group.wins / group.count) * 100 : null,
      avgHoldingDays: group.holdingCount ? group.holdingTotal / group.holdingCount : null,
    }))
    .sort((a, b) => b.count - a.count || b.totalProfit - a.totalProfit)
}

function metricCardStyle(tone = 'default') {
  const tones = {
    default: { border: '#d0d5dd', bg: '#fff', color: '#101828' },
    good: { border: '#abefc6', bg: '#ecfdf3', color: '#067647' },
    bad: { border: '#fecaca', bg: '#fef3f2', color: '#b42318' },
    focus: { border: '#b2ddff', bg: '#eff8ff', color: '#175cd3' },
  }
  const t = tones[tone] || tones.default
  return {
    border: `1px solid ${t.border}`,
    background: t.bg,
    borderRadius: 8,
    padding: 12,
    display: 'grid',
    gap: 5,
    color: t.color,
  }
}

function sectionStyle() {
  return {
    border: '1px solid #d0d5dd',
    background: '#fff',
    borderRadius: 8,
    padding: 14,
    display: 'grid',
    gap: 12,
  }
}

function PatternTable({ title, description, rows, emptyText = 'まだ集計できるレビューがありません。' }) {
  return (
    <section style={sectionStyle()}>
      <div style={{ display: 'grid', gap: 3 }}>
        <h2 style={{ margin: 0, fontSize: 17, color: '#101828' }}>{title}</h2>
        {description ? <div style={{ color: '#667085', fontSize: 13, lineHeight: 1.5 }}>{description}</div> : null}
      </div>
      {rows.length ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr style={{ color: '#667085', fontSize: 12, textAlign: 'left' }}>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid #eaecf0' }}>パターン</th>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid #eaecf0' }}>件数</th>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid #eaecf0' }}>勝率</th>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid #eaecf0' }}>平均損益</th>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid #eaecf0' }}>合計損益</th>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid #eaecf0' }}>平均保有</th>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid #eaecf0' }}>例</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const avgNegative = row.avgProfit < 0
                return (
                  <tr key={row.key} style={{ fontSize: 13, color: '#101828' }}>
                    <td style={{ padding: '9px 6px', borderBottom: '1px solid #f2f4f7', fontWeight: 800 }}>{row.key}</td>
                    <td style={{ padding: '9px 6px', borderBottom: '1px solid #f2f4f7' }}>{row.count}</td>
                    <td style={{ padding: '9px 6px', borderBottom: '1px solid #f2f4f7' }}>{pct(row.winRate)}</td>
                    <td style={{ padding: '9px 6px', borderBottom: '1px solid #f2f4f7', color: avgNegative ? '#b42318' : '#067647', fontWeight: 800 }}>
                      {formatProfit(row.avgProfit)}
                    </td>
                    <td style={{ padding: '9px 6px', borderBottom: '1px solid #f2f4f7', color: row.totalProfit < 0 ? '#b42318' : '#067647', fontWeight: 800 }}>
                      {formatProfit(row.totalProfit)}
                    </td>
                    <td style={{ padding: '9px 6px', borderBottom: '1px solid #f2f4f7' }}>
                      {row.avgHoldingDays == null ? '-' : `${row.avgHoldingDays.toFixed(1)}日`}
                    </td>
                    <td style={{ padding: '9px 6px', borderBottom: '1px solid #f2f4f7' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {row.examples.map((trade) => (
                          <Link key={trade.id} to={`/trades/${trade.id}`} style={{ color: '#175cd3', fontWeight: 700 }}>
                            {trade.symbol}
                          </Link>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ color: '#667085', fontSize: 13 }}>{emptyText}</div>
      )}
    </section>
  )
}

function SignalCard({ title, value, description, tone, trades = [] }) {
  return (
    <div style={metricCardStyle(tone)}>
      <div style={{ fontSize: 12, fontWeight: 900 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 950 }}>{value}</div>
      <div style={{ fontSize: 12, lineHeight: 1.5, color: '#475467' }}>{description}</div>
      {trades.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
          {trades.slice(0, 5).map((trade) => (
            <Link key={trade.id} to={`/trades/${trade.id}`} style={{ fontSize: 12, color: '#175cd3', fontWeight: 800 }}>
              {trade.symbol}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function ReviewRedirectPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['review-insights-trades'],
    queryFn: () => listTrades({ limit: 500, sort: 'sell_date', sort_dir: 'desc' }),
    retry: 1,
  })

  const trades = data?.items || []
  const insights = useMemo(() => {
    const closed = trades.filter((trade) => !isOpenTrade(trade))
    const reviewed = closed.filter(hasReviewSignal)
    const pending = closed.filter((trade) => !trade.review_done)
    const wins = reviewed.filter((trade) => profitValue(trade) > 0)
    const losses = reviewed.filter((trade) => profitValue(trade) < 0)
    const entryLate = reviewed.filter((trade) => trade.entry_evaluation === 'late')
    const entryEarly = reviewed.filter((trade) => trade.entry_evaluation === 'early')
    const exitEarly = reviewed.filter((trade) => trade.exit_evaluation === 'early')
    const exitRuleViolation = reviewed.filter((trade) => trade.exit_evaluation === 'rule_violation')
    const patternTagged = reviewed.filter((trade) => trade.entry_pattern)
    const totalProfit = reviewed.reduce((sum, trade) => sum + profitValue(trade), 0)
    const nextPending = pending[0] || null

    const byEntryPattern = aggregate(reviewed, (trade) =>
      labelFor(ENTRY_PATTERN_LABELS, trade.entry_pattern, trade.entry_pattern_note),
    )
    const byEntryEval = aggregate(reviewed, (trade) => labelFor(ENTRY_EVALUATION_LABELS, trade.entry_evaluation))
    const byExitEval = aggregate(reviewed, (trade) => labelFor(EXIT_EVALUATION_LABELS, trade.exit_evaluation))
    const byExitReason = aggregate(reviewed, (trade) =>
      labelFor(EXIT_REASON_LABELS, trade.exit_reason, trade.exit_reason_note),
    )
    const byTimeframe = aggregate(reviewed, (trade) => labelFor(TIMEFRAME_LABELS, trade.strategy_timeframe))
    const winners = byEntryPattern.filter((row) => row.avgProfit > 0).sort((a, b) => b.avgProfit - a.avgProfit).slice(0, 5)
    const losers = byEntryPattern.filter((row) => row.avgProfit < 0).sort((a, b) => a.avgProfit - b.avgProfit).slice(0, 5)

    return {
      closed,
      reviewed,
      pending,
      wins,
      losses,
      entryLate,
      entryEarly,
      exitEarly,
      exitRuleViolation,
      patternTagged,
      totalProfit,
      nextPending,
      byEntryPattern,
      byEntryEval,
      byExitEval,
      byExitReason,
      byTimeframe,
      winners,
      losers,
    }
  }, [trades])

  if (isLoading) return <div style={{ padding: 16 }}>レビュー分析を読み込み中...</div>
  if (error) return <div style={{ padding: 16, color: '#b42318' }}>レビュー分析を取得できませんでした: {String(error?.message || error)}</div>

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gap: 14 }}>
      <section style={{ ...sectionStyle(), gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
        <div style={{ display: 'grid', gap: 5 }}>
          <h1 style={{ margin: 0, fontSize: 24, color: '#101828' }}>レビュー分析</h1>
          <div style={{ color: '#475467', fontSize: 13, lineHeight: 1.6 }}>
            レビュー済み取引から、勝ち筋・負け筋・買い/売り判断の癖を集計します。
          </div>
        </div>
        {insights.nextPending ? (
          <Link
            to={`/trades/${insights.nextPending.id}`}
            style={{
              border: '1px solid #101828',
              background: '#101828',
              color: '#fff',
              borderRadius: 8,
              padding: '10px 12px',
              fontWeight: 900,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            次の未レビューへ
          </Link>
        ) : (
          <Link to="/trades" style={{ color: '#175cd3', fontWeight: 900 }}>取引一覧へ</Link>
        )}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <SignalCard title="レビュー済み" value={`${insights.reviewed.length}件`} description={`未レビュー ${insights.pending.length}件 / 決済済み ${insights.closed.length}件`} tone="focus" />
        <SignalCard title="型入力済み" value={`${insights.patternTagged.length}件`} description="エントリーパターンまで入力されたレビュー" tone={insights.patternTagged.length ? 'focus' : 'default'} />
        <SignalCard title="勝率" value={pct(insights.reviewed.length ? (insights.wins.length / insights.reviewed.length) * 100 : null)} description={`勝ち ${insights.wins.length}件 / 負け ${insights.losses.length}件`} tone="good" />
        <SignalCard title="レビュー済み損益" value={formatProfit(insights.totalProfit)} description="レビュー入力済み取引の合計損益" tone={insights.totalProfit >= 0 ? 'good' : 'bad'} />
        <SignalCard title="買い遅れ" value={`${insights.entryLate.length}件`} description="エントリー評価が「遅い」の取引" tone={insights.entryLate.length ? 'bad' : 'default'} trades={insights.entryLate} />
        <SignalCard title="売りが早い" value={`${insights.exitEarly.length}件`} description="決済評価が「早い」の取引" tone={insights.exitEarly.length ? 'bad' : 'default'} trades={insights.exitEarly} />
        <SignalCard title="ルール違反" value={`${insights.exitRuleViolation.length}件`} description="決済評価が「ルール違反」の取引" tone={insights.exitRuleViolation.length ? 'bad' : 'default'} trades={insights.exitRuleViolation} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
        <PatternTable
          title="勝ち筋候補"
          description="平均損益がプラスのエントリーパターン。まずここを再現対象にします。"
          rows={insights.winners}
          emptyText="勝ち筋候補はまだ出ていません。レビュー数を増やしてください。"
        />
        <PatternTable
          title="負け筋候補"
          description="平均損益がマイナスのエントリーパターン。次回エントリー前の警戒対象です。"
          rows={insights.losers}
          emptyText="負け筋候補はまだ出ていません。"
        />
      </div>

      <PatternTable
        title="エントリーパターン別"
        description="CwH、高値ブレイク、レンジ上抜けなど、買いの型ごとに結果を比較します。"
        rows={insights.byEntryPattern}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
        <PatternTable title="エントリー評価別" description="買いが早い/遅い/根拠不足だった取引の結果を確認します。" rows={insights.byEntryEval} />
        <PatternTable title="決済評価別" description="売りが早い/遅い/ルール違反だった取引の結果を確認します。" rows={insights.byExitEval} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
        <PatternTable title="決済理由別" description="事前利確/損切り、トレンド終了、急落など、売却理由ごとの結果です。" rows={insights.byExitReason} />
        <PatternTable title="主戦略足別" description="日足/週足/月足のどの目線で入った取引が機能しているかを確認します。" rows={insights.byTimeframe} />
      </div>
    </div>
  )
}
