import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'

import { getAnalysisSummary } from '../lib/analysisApi'

function StatCard({ label, value, tone = '#111' }) {
  return (
    <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', display: 'grid', gap: 4 }}>
      <div style={{ fontSize: 12, color: '#667085' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: tone }}>{value}</div>
    </div>
  )
}

function SectionCard({ title, children, subtitle = '' }) {
  return (
    <section style={{ border: '1px solid #e4e7ec', borderRadius: 14, padding: 14, background: '#fff', display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        {subtitle ? <div style={{ fontSize: 12, color: '#667085' }}>{subtitle}</div> : null}
      </div>
      {children}
    </section>
  )
}

function PatternList({ items, emptyLabel }) {
  if (!items?.length) {
    return <div style={{ fontSize: 13, color: '#667085' }}>{emptyLabel}</div>
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
      {items.map((item) => (
        <li key={item} style={{ color: '#111', lineHeight: 1.6 }}>
          {item}
        </li>
      ))}
    </ul>
  )
}

function formatPct(value) {
  return value == null ? '—' : `${Number(value).toFixed(1)}%`
}

function formatDays(value) {
  return value == null ? '—' : `${Number(value).toFixed(1)}日`
}

export default function AnalysisPage() {
  const location = useLocation()
  const { data, isLoading, error } = useQuery({
    queryKey: ['analysis', 'summary'],
    queryFn: getAnalysisSummary,
    staleTime: 60_000,
  })

  if (isLoading) {
    return <div style={{ padding: 16 }}>読み込み中…</div>
  }

  if (error) {
    return <div style={{ padding: 16, color: '#b42318' }}>分析の取得に失敗しました: {String(error?.message || error)}</div>
  }

  const stats = data?.stats
  const sufficiency = data?.data_sufficiency
  const importSummary = location.state?.importSummary || null
  const llmMessageTone = ['generated', 'rule_based'].includes(String(sufficiency?.llm_status || '')) ? '#175cd3' : '#667085'

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 1080, margin: '0 auto' }}>
      {importSummary ? (
        <section style={{ border: '1px solid #b2ddff', borderRadius: 14, padding: 14, background: '#eff8ff', display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, color: '#175cd3', fontWeight: 700 }}>直近取込の要確認ポイント</div>
          <div style={{ fontSize: 14, color: '#1849a9', lineHeight: 1.6 }}>
            {importSummary.filename || 'rakuten.csv'} の取込で、作成 {importSummary.createdCount} 件 / スキップ {importSummary.skippedCount} 件 / エラー {importSummary.errorCount} 件でした。
            まずは勝ち負けの傾向と、レビュー未入力の項目を確認してください。
          </div>
        </section>
      ) : null}

      <section style={{ border: '1px solid #d8e6e1', borderRadius: 16, padding: 16, background: 'linear-gradient(135deg, #f7fbfa 0%, #eef7f3 100%)', display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>振り返り分析</h2>
          <span style={{ fontSize: 12, color: '#175cd3', background: '#eff8ff', border: '1px solid #b2ddff', borderRadius: 999, padding: '4px 8px' }}>
            自己分析支援
          </span>
        </div>
        <div style={{ fontSize: 14, color: '#344054', lineHeight: 1.6 }}>
          決済済みトレードの統計と、そこから見える振り返りポイントをまとめます。投資助言ではなく、記録の見直しを助けるための分析です。
        </div>
        <div style={{ fontSize: 12, color: llmMessageTone }}>
          {sufficiency?.message || '統計を表示しています。'}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        <StatCard label="決済済み" value={stats?.closed_trade_count ?? '—'} />
        <StatCard label="保有中" value={stats?.open_trade_count ?? '—'} />
        <StatCard label="勝率" value={formatPct(stats?.win_rate_pct)} tone="#067647" />
        <StatCard label="平均損益率" value={formatPct(stats?.avg_roi_pct)} />
        <StatCard label="平均保有日数" value={formatDays(stats?.avg_holding_days)} />
        <StatCard label="レビュー完了率" value={formatPct(stats?.review_completion_rate_pct)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <SectionCard title="全体要約" subtitle={`生成時刻: ${data?.generated_at || '—'}`}>
          <div style={{ whiteSpace: 'pre-wrap', color: '#111', lineHeight: 1.7 }}>
            {data?.summary || 'AI要約はまだ表示されていません。統計と記録を先に確認できます。'}
          </div>
        </SectionCard>

        <SectionCard title="勝ちパターン">
          <PatternList items={data?.win_patterns} emptyLabel="十分なAI要約がまだないため、統計から確認してください。" />
        </SectionCard>

        <SectionCard title="負けパターン">
          <PatternList items={data?.loss_patterns} emptyLabel="十分なAI要約がまだないため、統計から確認してください。" />
        </SectionCard>

        <SectionCard title="改善アクション">
          <PatternList items={data?.actions} emptyLabel="AI要約が未生成でも、詳細記録の見直しから始められます。" />
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <SectionCard title="市場別内訳">
          <div style={{ display: 'grid', gap: 10 }}>
            {(stats?.market_breakdown || []).map((item) => (
              <div key={item.market} style={{ border: '1px solid #eaecf0', borderRadius: 12, padding: 10, display: 'grid', gap: 6 }}>
                <div style={{ fontWeight: 700 }}>{item.market}</div>
                <div style={{ fontSize: 13, color: '#475467' }}>
                  決済済み {item.closed_trade_count}件 / 勝ち {item.win_trade_count}件 / 負け {item.loss_trade_count}件 / 引き分け {item.breakeven_trade_count}件
                </div>
                <div style={{ fontSize: 13, color: '#475467' }}>勝率 {formatPct(item.win_rate_pct)}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="よく使うタグ">
          {stats?.top_tags?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {stats.top_tags.map((tag) => (
                <span
                  key={tag.tag}
                  style={{
                    fontSize: 13,
                    color: '#344054',
                    background: '#f2f4f7',
                    border: '1px solid #eaecf0',
                    borderRadius: 999,
                    padding: '6px 10px',
                  }}
                >
                  {tag.tag} ({tag.count})
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#667085' }}>タグ付きの決済済みトレードがまだありません。</div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
