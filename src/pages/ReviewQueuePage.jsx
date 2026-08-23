import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'

import { formatJPY } from '../lib/api'
import { getReviewQueue } from '../lib/v2EpisodesApi'

const REASON_TONES = {
  '前回の続き': { color: '#175cd3', background: '#eff8ff', border: '#b2ddff' },
  '未レビュー': { color: '#b54708', background: '#fffaeb', border: '#fedf89' },
  '保有中の確認': { color: '#067647', background: '#ecfdf3', border: '#abefc6' },
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

function episodeTitle(episode) {
  const symbol = String(episode?.symbol || '').trim()
  const name = String(episode?.name || '').trim()
  return [symbol, name].filter(Boolean).join(' ') || 'Episode'
}

function profitText(episode) {
  if (episode?.status === 'open') return `保有 ${Number(episode.open_quantity || 0).toLocaleString('ja-JP')}株`
  const value = episode?.realized_profit_jpy
  if (value == null) return '損益 -'
  const formatted = formatJPY(value)
  return Number(value) > 0 ? `+${formatted}` : formatted
}

function QueueRow({ item, first }) {
  const episode = item.episode
  const tone = REASON_TONES[item.reason] || REASON_TONES['未レビュー']
  const profit = Number(episode.realized_profit_jpy || 0)

  return (
    <Link
      to={`/episodes/${episode.id}`}
      className="v2-queue-row"
      style={{ textDecoration: 'none' }}
    >
      <div className="v2-queue-row-main">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              border: `1px solid ${tone.border}`,
              background: tone.background,
              color: tone.color,
              borderRadius: 999,
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 900,
              whiteSpace: 'nowrap',
            }}
          >
            {item.reason}
          </span>
          {first ? <span style={{ fontSize: 11, color: '#667085', fontWeight: 800 }}>NEXT</span> : null}
        </div>
        <div style={{ fontSize: 17, fontWeight: 900, color: '#101828' }}>{episodeTitle(episode)}</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: '#667085', fontSize: 12 }}>
          <span>{formatDate(episode.started_at)} → {episode.ended_at ? formatDate(episode.ended_at) : '保有中'}</span>
          <span>{episode.decision_count}判断</span>
          {episode.holding_days == null ? null : <span>{episode.holding_days}日</span>}
        </div>
      </div>
      <div className="v2-queue-row-result">
        <div
          style={{
            fontSize: 15,
            fontWeight: 900,
            color: episode.status === 'open' ? '#067647' : profit >= 0 ? '#067647' : '#b42318',
            whiteSpace: 'nowrap',
          }}
        >
          {profitText(episode)}
        </div>
        <span aria-hidden="true" style={{ fontSize: 22, color: '#98a2b3' }}>›</span>
      </div>
    </Link>
  )
}

export default function ReviewQueuePage() {
  const location = useLocation()
  const query = useQuery({
    queryKey: ['v2-review-queue'],
    queryFn: () => getReviewQueue({ limit: 100 }),
    retry: 1,
  })
  const items = query.data?.items || []
  const importSummary = location.state?.importSummary
  const importFailures = location.state?.importFailures || []

  if (query.isLoading) return <div style={{ padding: 16 }}>レビューキューを読み込み中...</div>
  if (query.error) {
    return (
      <div style={{ padding: 16, color: '#b42318' }}>
        レビューキューを取得できませんでした: {String(query.error?.message || query.error)}
      </div>
    )
  }

  return (
    <main className="v2-review-queue">
      <header className="v2-review-queue-header">
        <div>
          <div style={{ fontSize: 12, color: '#2a8871', fontWeight: 900 }}>REVIEW QUEUE</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 26, color: '#101828' }}>次に振り返る取引</h1>
          <p style={{ margin: '7px 0 0', color: '#667085', fontSize: 13, lineHeight: 1.6 }}>
            入力作業ではなく、チャートを見て判断を言語化するところから始めます。
          </p>
        </div>
        <div className="v2-review-queue-count">
          <strong>{items.length}</strong>
          <span>件</span>
        </div>
      </header>

      {importSummary ? (
        <div className="v2-page-message is-success">
          {Number(importSummary.fileCount || 1)}ファイル取込完了: 新規 {Number(importSummary.createdCount || 0)}件 / 更新 {Number(importSummary.updatedCount || 0)}件 /
          変更なし {Number(importSummary.ignoredCount || 0)}件 / Episode再構築 {Number(importSummary.episodeCount || 0)}件
          {Number(importSummary.anomalyCount || 0) ? ` / 要確認 ${Number(importSummary.anomalyCount)}件` : ''}
        </div>
      ) : null}
      {importFailures.length ? (
        <div className="v2-page-message is-warning v2-preserve-lines">
          {`確認が必要なファイル:\n${importFailures.join('\n')}`}
        </div>
      ) : null}

      {items.length ? (
        <section className="v2-queue-list" aria-label="レビュー対象">
          {items.map((item, index) => <QueueRow key={item.episode.id} item={item} first={index === 0} />)}
        </section>
      ) : (
        <section className="v2-review-empty">
          <div style={{ fontSize: 18, fontWeight: 900, color: '#101828' }}>レビュー待ちはありません</div>
          <div style={{ color: '#667085', fontSize: 13 }}>新しい取引を取り込むと、ここにEpisodeが並びます。</div>
          <Link to="/import" style={{ color: '#175cd3', fontWeight: 900 }}>取込へ</Link>
        </section>
      )}
    </main>
  )
}
