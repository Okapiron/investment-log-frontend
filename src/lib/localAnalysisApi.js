import { getAllLocal } from './localDb'
import { enrichTrade, principalValue } from './localTradeMath'

const MIN_CLOSED = 5

function pct(value) {
  return value == null ? null : Math.round(value * 10) / 10
}

function avg(values) {
  const clean = values.filter((v) => Number.isFinite(v))
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null
}

function roiPct(trade) {
  const principal = principalValue(trade)
  const profit = Number(trade.profit_jpy)
  if (!principal || !Number.isFinite(profit)) return null
  return (profit / principal) * 100
}

function bucket(label, trades) {
  const wins = trades.filter((trade) => Number(trade.profit_jpy || 0) > 0)
  const losses = trades.filter((trade) => Number(trade.profit_jpy || 0) < 0)
  return {
    label,
    closed_trade_count: trades.length,
    win_rate_pct: trades.length ? pct((wins.length / trades.length) * 100) : null,
    avg_net_profit_amount: avg(trades.map((trade) => Number(trade.profit_jpy || 0))),
    avg_win_profit_amount: avg(wins.map((trade) => Number(trade.profit_jpy || 0))),
    avg_loss_amount: avg(losses.map((trade) => Number(trade.profit_jpy || 0))),
  }
}

function holdingBuckets(closed) {
  return [
    bucket('0-2日', closed.filter((trade) => Number(trade.holding_days) <= 2)),
    bucket('3-7日', closed.filter((trade) => Number(trade.holding_days) >= 3 && Number(trade.holding_days) <= 7)),
    bucket('8-30日', closed.filter((trade) => Number(trade.holding_days) >= 8 && Number(trade.holding_days) <= 30)),
    bucket('31日以上', closed.filter((trade) => Number(trade.holding_days) >= 31)),
  ]
}

function streaks(closed) {
  let win = 0
  let loss = 0
  let bestWin = 0
  let bestLoss = 0
  closed.forEach((trade) => {
    const p = Number(trade.profit_jpy || 0)
    if (p > 0) {
      win += 1
      loss = 0
    } else if (p < 0) {
      loss += 1
      win = 0
    } else {
      win = 0
      loss = 0
    }
    bestWin = Math.max(bestWin, win)
    bestLoss = Math.max(bestLoss, loss)
  })
  return { bestWin, bestLoss }
}

function statsFor(trades) {
  const closed = trades.filter((trade) => !trade.is_open && trade.closed_at)
  const open = trades.filter((trade) => trade.is_open || !trade.closed_at)
  const wins = closed.filter((trade) => Number(trade.profit_jpy || 0) > 0)
  const losses = closed.filter((trade) => Number(trade.profit_jpy || 0) < 0)
  const breakeven = closed.filter((trade) => Number(trade.profit_jpy || 0) === 0)
  const recent = closed.slice(-20)
  const recentWins = recent.filter((trade) => Number(trade.profit_jpy || 0) > 0)
  const recentLosses = recent.filter((trade) => Number(trade.profit_jpy || 0) < 0)
  const streak = streaks(closed)
  return {
    closed_trade_count: closed.length,
    open_trade_count: open.length,
    win_trade_count: wins.length,
    loss_trade_count: losses.length,
    breakeven_trade_count: breakeven.length,
    win_rate_pct: closed.length ? pct((wins.length / closed.length) * 100) : null,
    avg_roi_pct: pct(avg(closed.map(roiPct))),
    avg_holding_days: pct(avg(closed.map((trade) => Number(trade.holding_days)))),
    avg_rating: pct(avg(trades.map((trade) => Number(trade.rating)).filter((v) => v > 0))),
    review_completion_rate_pct: closed.length ? pct((closed.filter((trade) => trade.review_done).length / closed.length) * 100) : null,
    primary_market: 'JP',
    primary_profit_currency: 'JPY',
    primary_closed_trade_count: closed.length,
    realized_only_trade_count: 0,
    holding_analysis_trade_count: closed.length,
    avg_win_profit_amount: avg(wins.map((trade) => Number(trade.profit_jpy || 0))),
    avg_loss_amount: avg(losses.map((trade) => Number(trade.profit_jpy || 0))),
    profit_loss_ratio: wins.length && losses.length ? Math.abs(avg(wins.map((trade) => Number(trade.profit_jpy || 0))) / avg(losses.map((trade) => Number(trade.profit_jpy || 0)))) : null,
    avg_win_holding_days: avg(wins.map((trade) => Number(trade.holding_days))),
    avg_loss_holding_days: avg(losses.map((trade) => Number(trade.holding_days))),
    recent_closed_trade_count: recent.length,
    recent_win_rate_pct: recent.length ? pct((recentWins.length / recent.length) * 100) : null,
    recent_avg_win_profit_amount: avg(recentWins.map((trade) => Number(trade.profit_jpy || 0))),
    recent_avg_loss_amount: avg(recentLosses.map((trade) => Number(trade.profit_jpy || 0))),
    recent_avg_holding_days: avg(recent.map((trade) => Number(trade.holding_days))),
    recent_avg_roi_pct: pct(avg(recent.map(roiPct))),
    longest_win_streak: streak.bestWin,
    longest_loss_streak: streak.bestLoss,
    top_tags: [],
    market_breakdown: [{
      market: 'JP',
      closed_trade_count: closed.length,
      win_trade_count: wins.length,
      loss_trade_count: losses.length,
      breakeven_trade_count: breakeven.length,
      win_rate_pct: closed.length ? pct((wins.length / closed.length) * 100) : null,
    }],
    holding_buckets: holdingBuckets(closed),
  }
}

function topImprovement(stats) {
  if (stats.closed_trade_count === 0) {
    return {
      key: 'recent_change',
      title: 'まずはCSVを取り込みましょう',
      message: '楽天証券CSVを取り込むと、売買の傾向をブラウザ内で分析できます。',
      rationale: ['登録なしで試せます。データはこのブラウザ内だけに保存されます。'],
    }
  }
  if (stats.avg_loss_amount != null && stats.avg_win_profit_amount != null && Math.abs(stats.avg_loss_amount) > stats.avg_win_profit_amount) {
    return {
      key: 'pnl_structure',
      title: '損失幅を先に確認',
      message: '平均損失が平均利益を上回っています。大きな損失トレードから振り返るのがおすすめです。',
      rationale: [`平均利益 ${Math.round(stats.avg_win_profit_amount).toLocaleString('ja-JP')}円 / 平均損失 ${Math.round(stats.avg_loss_amount).toLocaleString('ja-JP')}円`],
    }
  }
  return {
    key: 'holding_execution',
    title: '保有日数ごとの癖を見る',
    message: 'どの保有期間で利益が残りやすいかを確認し、次の振り返り軸にしましょう。',
    rationale: ['保有日数帯別の成績を見ると、短期/中期の得意不得意が見えます。'],
  }
}

export async function getLocalAnalysisSummary() {
  const trades = (await getAllLocal('trades')).map(enrichTrade).sort((a, b) => String(a.closed_at || a.opened_at || '').localeCompare(String(b.closed_at || b.opened_at || '')))
  const stats = statsFor(trades)
  const improvement = topImprovement(stats)
  const latestSession = (await getAllLocal('importSessions')).sort((a, b) => String(b.imported_at || '').localeCompare(String(a.imported_at || '')))[0] || null
  const enoughData = stats.closed_trade_count >= MIN_CLOSED
  const diagnoses = [
    {
      key: 'pnl_structure',
      title: '損益構造',
      hypothesis: stats.win_rate_pct == null ? '取引データがまだ少ないです。' : `勝率は ${stats.win_rate_pct.toFixed(1)}% です。`,
      summary: '勝ち負けの件数と平均損益から、損益の残り方を確認します。',
      evidence: [
        `決済済み ${stats.closed_trade_count} 件 / 勝ち ${stats.win_trade_count} 件 / 負け ${stats.loss_trade_count} 件`,
      ],
      tone: stats.win_rate_pct != null && stats.win_rate_pct >= 50 ? 'positive' : 'neutral',
    },
    {
      key: 'holding_execution',
      title: '保有期間',
      hypothesis: stats.avg_holding_days == null ? '保有日数を計算できる取引がまだありません。' : `平均保有日数は ${stats.avg_holding_days.toFixed(1)} 日です。`,
      summary: '保有日数ごとの成績から、売買タイミングの癖を見ます。',
      evidence: stats.holding_buckets.filter((item) => item.closed_trade_count > 0).slice(0, 3).map((item) => `${item.label}: ${item.closed_trade_count}件 / 勝率 ${item.win_rate_pct ?? '—'}%`),
      tone: 'neutral',
    },
  ]
  return {
    headline_summary: stats.closed_trade_count ? `決済済み ${stats.closed_trade_count} 件から、売買の傾向を簡易分析しています。` : '楽天証券CSVを取り込むと、売買の癖をブラウザ内で分析できます。',
    top_improvement: improvement,
    summary: '登録なしの試用モードでは、CSVから作成した取引データをもとに簡易分析を表示しています。投資助言ではなく、過去取引の振り返り支援です。',
    diagnoses,
    win_patterns: stats.win_trade_count ? [`勝ち取引は ${stats.win_trade_count} 件あります。利益が大きい取引から理由を確認しましょう。`] : [],
    loss_patterns: stats.loss_trade_count ? [`負け取引は ${stats.loss_trade_count} 件あります。損失額が大きい順に振り返るのがおすすめです。`] : [],
    actions: [improvement.message],
    stats,
    review_gaps: [{ label: 'レビュー未入力', missing_count: trades.filter((trade) => !trade.is_open && !trade.review_done).length }],
    latest_import: latestSession ? {
      broker: latestSession.broker,
      source_name: latestSession.source_name,
      imported_at: latestSession.imported_at,
      created_count: latestSession.created_count,
      updated_count: latestSession.updated_count,
      skipped_count: latestSession.skipped_count,
      error_count: latestSession.error_count,
      audit_gap_jpy: latestSession.audit_gap_jpy,
    } : null,
    import_review_focus: latestSession ? [`直近取込で作成 ${latestSession.created_count} 件 / 更新 ${latestSession.updated_count} 件でした。`] : [],
    data_sufficiency: {
      enough_data: enoughData,
      minimum_closed_trade_count: MIN_CLOSED,
      closed_trade_count: stats.closed_trade_count,
      llm_status: 'rule_based',
      message: enoughData ? 'ブラウザ内のルールベース分析を表示しています。' : `決済済みトレードが ${MIN_CLOSED} 件未満のため、簡易分析を表示しています。`,
    },
    generated_at: new Date().toISOString(),
  }
}
