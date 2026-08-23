const TIMEFRAME_OPTIONS = [
  { value: 'daily', label: '日足' },
  { value: 'weekly', label: '週足' },
  { value: 'monthly', label: '月足' },
]

const ENTRY_PATTERN_OPTIONS = [
  { value: 'cwh', label: 'CwH' },
  { value: 'high_breakout', label: '高値ブレイク' },
  { value: 'range_breakout', label: 'レンジ上抜け' },
  { value: 'band_walk', label: 'バンドウォーク' },
  { value: 'news_spike', label: '材料後の急騰' },
  { value: 'pullback_bounce', label: '押し目反発' },
  { value: 'other', label: 'その他' },
]

const ENTRY_EVALUATION_OPTIONS = [
  { value: 'good', label: '良い' },
  { value: 'early', label: '早い' },
  { value: 'late', label: '遅い' },
  { value: 'weak_basis', label: '根拠不足' },
]

const EXIT_EVALUATION_OPTIONS = [
  { value: 'good', label: '良い' },
  { value: 'early', label: '早い' },
  { value: 'late', label: '遅い' },
  { value: 'rule_violation', label: 'ルール違反' },
]

const EXIT_REASON_OPTIONS = [
  { value: 'planned_profit_take', label: '事前に決めた利確' },
  { value: 'planned_loss_cut', label: '事前に決めた損切り' },
  { value: 'stop_order', label: '逆指値' },
  { value: 'trend_ended', label: 'トレンド終了' },
  { value: 'unexpected_sharp_drop', label: '予想外の急落' },
  { value: 'large_bearish_candle', label: '大陰線' },
  { value: 'bubble_warning', label: 'バブル予見' },
  { value: 'other', label: 'その他' },
]

function chipStyle(active) {
  return {
    border: active ? '1px solid #2f6fed' : '1px solid #d0d5dd',
    background: active ? '#eff4ff' : '#fff',
    color: active ? '#174ea6' : '#344054',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  }
}

function sectionStyle() {
  return {
    display: 'grid',
    gap: 7,
    paddingBottom: 10,
    borderBottom: '1px solid #eaecf0',
  }
}

function ChipGroup({ title, options, value, onChange, helper = null }) {
  return (
    <section style={sectionStyle()}>
      <div style={{ display: 'grid', gap: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#101828' }}>{title}</div>
        {helper ? <div style={{ fontSize: 11, color: '#667085', lineHeight: 1.5 }}>{helper}</div> : null}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            style={chipStyle(value === option.value)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function TextArea({ title, value, onChange, placeholder, rows = 3 }) {
  return (
    <section style={sectionStyle()}>
      <div style={{ fontSize: 13, fontWeight: 900, color: '#101828' }}>{title}</div>
      <textarea
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          resize: 'vertical',
          border: '1px solid #d0d5dd',
          borderRadius: 8,
          padding: 10,
          fontSize: 13,
          lineHeight: 1.6,
          color: '#101828',
        }}
      />
    </section>
  )
}

export default function TradeReviewPanel({
  review,
  onChange,
  onSave,
  onComplete,
  saveStatus = 'idle',
  completionMissingItems = [],
}) {
  function update(key, value) {
    onChange?.({ ...(review || {}), [key]: value })
  }

  return (
    <aside
      style={{
        border: '1px solid #d0d5dd',
        borderRadius: 8,
        background: '#fff',
        padding: 14,
        display: 'grid',
        gap: 10,
        alignSelf: 'start',
        position: 'sticky',
        top: 12,
        maxHeight: 'calc(100vh - 24px)',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16 }}>レビュー</h2>
          <div style={{ fontSize: 12, color: '#667085', marginTop: 3 }}>{saveStatus === 'saving' ? '保存中' : saveStatus === 'saved' ? '保存済み' : '未保存'}</div>
        </div>
        <button
          type="button"
          onClick={onComplete}
          style={{
            border: '1px solid #101828',
            background: '#101828',
            color: '#fff',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          レビュー完了
        </button>
      </div>

      {completionMissingItems.length ? (
        <div style={{ border: '1px solid #fedf89', background: '#fffaeb', borderRadius: 8, padding: 9, fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
          未入力: {completionMissingItems.join('、')}
        </div>
      ) : null}

      <TextArea
        title="学び"
        value={review?.learning_note || ''}
        onChange={(value) => update('learning_note', value)}
        placeholder="チャート上で実際に起きたこと、買い/売り判断の良かった点・悪かった点を書く"
        rows={3}
      />

      <TextArea
        title="次回どうするか"
        value={review?.next_action_note || ''}
        onChange={(value) => update('next_action_note', value)}
        placeholder="次に同じ形が来たときの判断ルールを書く"
        rows={3}
      />

      <button
        type="button"
        onClick={onSave}
        style={{
          border: '1px solid #2f6fed',
          background: '#2f6fed',
          color: '#fff',
          borderRadius: 8,
          padding: '9px 12px',
          fontSize: 13,
          fontWeight: 900,
          cursor: 'pointer',
        }}
      >
        保存
      </button>

      <ChipGroup
        title="主戦略足"
        options={TIMEFRAME_OPTIONS}
        value={review?.strategy_timeframe || ''}
        onChange={(value) => update('strategy_timeframe', value)}
      />

      <ChipGroup
        title="エントリーパターン"
        options={ENTRY_PATTERN_OPTIONS}
        value={review?.entry_pattern || ''}
        onChange={(value) => update('entry_pattern', value)}
      />
      {review?.entry_pattern === 'other' ? (
        <input
          value={review?.entry_pattern_other || ''}
          onChange={(event) => update('entry_pattern_other', event.target.value)}
          placeholder="その他のパターン"
          style={{ border: '1px solid #d0d5dd', borderRadius: 8, padding: 9, fontSize: 13 }}
        />
      ) : null}

      <ChipGroup
        title="エントリー評価"
        options={ENTRY_EVALUATION_OPTIONS}
        value={review?.entry_evaluation || ''}
        onChange={(value) => update('entry_evaluation', value)}
      />

      <ChipGroup
        title="決済評価"
        options={EXIT_EVALUATION_OPTIONS}
        value={review?.exit_evaluation || ''}
        onChange={(value) => update('exit_evaluation', value)}
      />

      <ChipGroup
        title="決済理由"
        options={EXIT_REASON_OPTIONS}
        value={review?.exit_reason || ''}
        onChange={(value) => update('exit_reason', value)}
        helper="事前に決めた利確/損切りは、事前に決めた価格・条件で決済した場合のみ"
      />
      {review?.exit_reason === 'other' ? (
        <input
          value={review?.exit_reason_other || ''}
          onChange={(event) => update('exit_reason_other', event.target.value)}
          placeholder="その他の決済理由"
          style={{ border: '1px solid #d0d5dd', borderRadius: 8, padding: 9, fontSize: 13 }}
        />
      ) : null}
    </aside>
  )
}

export {
  ENTRY_EVALUATION_OPTIONS,
  ENTRY_PATTERN_OPTIONS,
  EXIT_EVALUATION_OPTIONS,
  EXIT_REASON_OPTIONS,
  TIMEFRAME_OPTIONS,
}
