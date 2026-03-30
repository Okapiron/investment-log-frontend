import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'

import { getAnalysisSummary } from '../lib/analysisApi'

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

function DiagnosisCard({ item }) {
  const toneMap = {
    positive: { border: '#abefc6', bg: '#ecfdf3', title: '#067647' },
    warning: { border: '#f9dbaf', bg: '#fffaeb', title: '#b54708' },
    neutral: { border: '#d0d5dd', bg: '#f8fafc', title: '#344054' },
  }
  const tone = toneMap[item?.tone] || toneMap.neutral

  return (
    <section style={{ border: `1px solid ${tone.border}`, borderRadius: 16, padding: 16, background: tone.bg, display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 12, color: '#667085', fontWeight: 700 }}>{item?.title || '診断'}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: tone.title, lineHeight: 1.5 }}>{item?.hypothesis || '診断を生成できませんでした。'}</div>
        <div style={{ fontSize: 13, color: '#344054', lineHeight: 1.6 }}>{item?.summary || ''}</div>
      </div>
      {!!item?.evidence?.length && (
        <div style={{ display: 'grid', gap: 6 }}>
          {item.evidence.map((evidence) => (
            <div key={evidence} style={{ fontSize: 12, color: '#475467', lineHeight: 1.6 }}>
              {evidence}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function StatRow({ label, value, emphasize = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: '#344054' }}>
      <span>{label}</span>
      <b style={{ color: emphasize ? '#111' : '#475467' }}>{value}</b>
    </div>
  )
}

function formatPct(value) {
  return value == null ? '—' : `${Number(value).toFixed(1)}%`
}

function formatDays(value) {
  return value == null ? '—' : `${Number(value).toFixed(1)}日`
}

function formatAmount(value, currency = 'JPY') {
  if (value == null) return '—'
  const sign = Number(value) < 0 ? '-' : ''
  const abs = Math.abs(Number(value))
  if (currency === 'USD') return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 1 })}`
  return `${sign}${abs.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}円`
}

function bucketCaption(bucket, currency) {
  if (!bucket?.closed_trade_count) return '件数がまだ少ないです。'
  return `勝率 ${formatPct(bucket.win_rate_pct)} / 平均損益 ${formatAmount(bucket.avg_net_profit_amount, currency)}`
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

  const stats = data?.stats || {}
  const sufficiency = data?.data_sufficiency
  const importSummary = location.state?.importSummary || null
  const llmMessageTone = ['generated', 'rule_based'].includes(String(sufficiency?.llm_status || '')) ? '#175cd3' : '#667085'
  const amountCurrency = stats?.primary_profit_currency || 'JPY'

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 1120, margin: '0 auto' }}>
      {importSummary ? (
        <section style={{ border: '1px solid #b2ddff', borderRadius: 14, padding: 14, background: '#eff8ff', display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, color: '#175cd3', fontWeight: 700 }}>直近取込の要確認ポイント</div>
          <div style={{ fontSize: 14, color: '#1849a9', lineHeight: 1.6 }}>
            {importSummary.filename || 'rakuten.csv'} の取込で、作成 {importSummary.createdCount} 件 / スキップ {importSummary.skippedCount} 件 / エラー {importSummary.errorCount} 件でした。
            まずは下の診断カードで、収支構造と保有の癖、最近の変化を見てください。
          </div>
        </section>
      ) : null}

      <section style={{ border: '1px solid #d8e6e1', borderRadius: 16, padding: 16, background: 'linear-gradient(135deg, #f7fbfa 0%, #eef7f3 100%)', display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>振り返り分析</h2>
          <span style={{ fontSize: 12, color: '#175cd3', background: '#eff8ff', border: '1px solid #b2ddff', borderRadius: 999, padding: '4px 8px' }}>
            売買スタイル診断
          </span>
        </div>
        <div style={{ fontSize: 14, color: '#344054', lineHeight: 1.6 }}>
          決済済みトレードから、あなたの売買スタイルの歪みや変化を診断します。投資助言ではなく、決済後の振り返りを深めるための分析です。
        </div>
        <div style={{ fontSize: 12, color: llmMessageTone }}>
          {sufficiency?.message || '統計を表示しています。'}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {(data?.diagnoses || []).map((item) => (
          <DiagnosisCard key={item.key} item={item} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <SectionCard title="全履歴 vs 直近20件" subtitle={`${stats?.primary_market || '全市場'} / ${amountCurrency} ベースの金額比較`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div style={{ border: '1px solid #eaecf0', borderRadius: 12, padding: 12, display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 700 }}>全履歴</div>
              <StatRow label="対象件数" value={`${stats?.primary_closed_trade_count ?? 0}件`} />
              <StatRow label="勝率" value={formatPct(stats?.win_rate_pct)} />
              <StatRow label="平均利益額" value={formatAmount(stats?.avg_win_profit_amount, amountCurrency)} emphasize />
              <StatRow label="平均損失額" value={formatAmount(stats?.avg_loss_amount, amountCurrency)} emphasize />
              <StatRow label="平均保有日数" value={formatDays(stats?.avg_holding_days)} />
            </div>
            <div style={{ border: '1px solid #eaecf0', borderRadius: 12, padding: 12, display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 700 }}>直近20件</div>
              <StatRow label="対象件数" value={`${stats?.recent_closed_trade_count ?? 0}件`} />
              <StatRow label="勝率" value={formatPct(stats?.recent_win_rate_pct)} />
              <StatRow label="平均利益額" value={formatAmount(stats?.recent_avg_win_profit_amount, amountCurrency)} emphasize />
              <StatRow label="平均損失額" value={formatAmount(stats?.recent_avg_loss_amount, amountCurrency)} emphasize />
              <StatRow label="平均保有日数" value={formatDays(stats?.recent_avg_holding_days)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="勝ち群 vs 負け群" subtitle="金額差と保有日数差で、勝ち方と負け方の癖を見ます。">
          <div style={{ display: 'grid', gap: 8 }}>
            <StatRow label="平均利益額" value={formatAmount(stats?.avg_win_profit_amount, amountCurrency)} emphasize />
            <StatRow label="平均損失額" value={formatAmount(stats?.avg_loss_amount, amountCurrency)} emphasize />
            <StatRow label="利益額 / 損失額比" value={stats?.profit_loss_ratio == null ? '—' : `${Number(stats.profit_loss_ratio).toFixed(2)}x`} />
            <StatRow label="勝ち平均保有日数" value={formatDays(stats?.avg_win_holding_days)} />
            <StatRow label="負け平均保有日数" value={formatDays(stats?.avg_loss_holding_days)} />
            <StatRow label="最大連勝 / 最大連敗" value={`${stats?.longest_win_streak ?? 0} / ${stats?.longest_loss_streak ?? 0}`} />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="保有日数帯別の成績" subtitle="どの保有帯で利益が残りやすいか、損失が膨らみやすいかを見ます。">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {(stats?.holding_buckets || []).map((bucket) => (
            <div key={bucket.label} style={{ border: '1px solid #eaecf0', borderRadius: 12, padding: 12, display: 'grid', gap: 6, background: '#fff' }}>
              <div style={{ fontWeight: 700 }}>{bucket.label}</div>
              <div style={{ fontSize: 12, color: '#667085' }}>{bucketCaption(bucket, amountCurrency)}</div>
              <StatRow label="件数" value={`${bucket.closed_trade_count}件`} />
              <StatRow label="平均利益額" value={formatAmount(bucket.avg_win_profit_amount, amountCurrency)} />
              <StatRow label="平均損失額" value={formatAmount(bucket.avg_loss_amount, amountCurrency)} />
            </div>
          ))}
        </div>
      </SectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <SectionCard title="全体要約" subtitle={`生成時刻: ${data?.generated_at || '—'}`}>
          <div style={{ whiteSpace: 'pre-wrap', color: '#111', lineHeight: 1.7 }}>
            {data?.summary || 'スタイル診断を表示できませんでした。'}
          </div>
        </SectionCard>

        <SectionCard title="補助情報" subtitle="タグやメモは今後の深掘り材料です。今は主分析の補助として扱います。">
          <div style={{ display: 'grid', gap: 8 }}>
            {(data?.review_gaps || []).length ? (
              (data.review_gaps || []).map((gap) => (
                <StatRow key={gap.label} label={gap.label} value={`未入力 ${gap.missing_count}件`} />
              ))
            ) : (
              <div style={{ fontSize: 13, color: '#667085' }}>主要な補助情報の欠損は少なめです。</div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
