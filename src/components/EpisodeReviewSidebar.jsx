import {
  ENTRY_EVALUATION_OPTIONS,
  ENTRY_PATTERN_OPTIONS,
  EXIT_EVALUATION_OPTIONS,
  EXIT_REASON_OPTIONS,
  TIMEFRAME_OPTIONS,
} from './TradeReviewPanel'

const ROLE_LABELS = {
  initial_entry: '初回エントリー',
  scale_in: '買い増し',
  partial_exit: '一部決済',
  full_exit: '全決済',
  buyback: '買い戻し',
}

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

function ChipGroup({ title, options, value, onChange, helper }) {
  return (
    <section className="v2-sidebar-section">
      <div>
        <div className="v2-sidebar-label">{title}</div>
        {helper ? <div className="v2-sidebar-helper">{helper}</div> : null}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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

function formatDecision(point) {
  const date = String(point?.occurred_at || '').slice(0, 10).replaceAll('-', '/')
  const side = point?.side === 'buy' ? '買' : '売'
  const price = Number(point?.average_price)
  const quantity = Number(point?.quantity)
  return `${date}  ${side} ${quantity.toLocaleString('ja-JP')}株  ${price.toLocaleString('ja-JP')}円`
}

export default function EpisodeReviewSidebar({
  episode,
  review,
  decisionReviews,
  selectedDecisionPointId,
  onSelectDecisionPoint,
  onEpisodeReviewChange,
  onDecisionReviewChange,
  onComplete,
  saveStatus,
  completionMissingItems,
}) {
  const selectedPoint = episode?.decision_points?.find(
    (item) => String(item.id) === String(selectedDecisionPointId),
  ) || episode?.decision_points?.[0]
  const selectedReview = selectedPoint ? (decisionReviews?.[selectedPoint.id] || selectedPoint.review || {}) : {}
  const isClosed = episode?.status === 'closed'

  return (
    <aside className="v2-episode-sidebar">
      <div className="v2-sidebar-heading">
        <div>
          <h2 style={{ margin: 0, fontSize: 17, color: '#101828' }}>レビュー</h2>
          <div className={`v2-save-status v2-save-status-${saveStatus}`}>
            {saveStatus === 'saving' ? '保存中...' : saveStatus === 'error' ? '保存エラー' : saveStatus === 'saved' ? '保存済み' : '自動保存'}
          </div>
        </div>
        <button type="button" className="v2-complete-button" onClick={onComplete}>レビュー完了</button>
      </div>

      {completionMissingItems.length ? (
        <div className="v2-missing-items">未入力: {completionMissingItems.join('、')}</div>
      ) : null}

      <ChipGroup
        title="主戦略足"
        options={TIMEFRAME_OPTIONS}
        value={review?.strategy_timeframe || ''}
        onChange={(value) => onEpisodeReviewChange('strategy_timeframe', value)}
      />

      <ChipGroup
        title="エントリーパターン"
        options={ENTRY_PATTERN_OPTIONS}
        value={review?.entry_pattern || ''}
        onChange={(value) => onEpisodeReviewChange('entry_pattern', value)}
      />
      {review?.entry_pattern === 'other' ? (
        <input
          className="v2-inline-input"
          value={review?.entry_pattern_other || ''}
          onChange={(event) => onEpisodeReviewChange('entry_pattern_other', event.target.value)}
          placeholder="その他のエントリーパターン"
        />
      ) : null}

      {isClosed ? (
        <>
          <ChipGroup
            title="決済理由"
            options={EXIT_REASON_OPTIONS}
            value={review?.exit_reason || ''}
            onChange={(value) => onEpisodeReviewChange('exit_reason', value)}
            helper="事前利確/損切りは、事前に決めた価格・条件で決済した場合のみ"
          />
          {review?.exit_reason === 'other' ? (
            <input
              className="v2-inline-input"
              value={review?.exit_reason_other || ''}
              onChange={(event) => onEpisodeReviewChange('exit_reason_other', event.target.value)}
              placeholder="その他の決済理由"
            />
          ) : null}
        </>
      ) : null}

      <section className="v2-sidebar-section">
        <div>
          <div className="v2-sidebar-label">売買判断</div>
          <div className="v2-sidebar-helper">チャートのB/Sマーカーと連動します</div>
        </div>
        <div className="v2-decision-list">
          {(episode?.decision_points || []).map((point) => {
            const active = String(point.id) === String(selectedPoint?.id)
            const pointReview = decisionReviews?.[point.id] || point.review || {}
            const evaluated = point.side === 'buy' ? pointReview.entry_evaluation : pointReview.exit_evaluation
            return (
              <button
                type="button"
                key={point.id}
                className={`v2-decision-row ${active ? 'is-active' : ''}`}
                onClick={() => onSelectDecisionPoint(point.id)}
              >
                <span className={`v2-decision-sequence is-${point.side}`}>
                  {point.side === 'buy' ? 'B' : 'S'}{Number(point.sequence)}
                </span>
                <span style={{ minWidth: 0, display: 'grid', gap: 2, textAlign: 'left' }}>
                  <strong>{ROLE_LABELS[point.role] || point.role}</strong>
                  <small>{formatDecision(point)}</small>
                </span>
                <span className={`v2-decision-check ${evaluated ? 'is-done' : ''}`}>{evaluated ? '✓' : '·'}</span>
              </button>
            )
          })}
        </div>
      </section>

      {selectedPoint ? (
        <section className="v2-selected-decision">
          <div className="v2-selected-decision-title">
            <span className={`v2-decision-sequence is-${selectedPoint.side}`}>
              {selectedPoint.side === 'buy' ? 'B' : 'S'}{Number(selectedPoint.sequence)}
            </span>
            <span>{ROLE_LABELS[selectedPoint.role] || selectedPoint.role}の評価</span>
          </div>
          <ChipGroup
            title={selectedPoint.side === 'buy' ? 'エントリー評価' : '決済評価'}
            options={selectedPoint.side === 'buy' ? ENTRY_EVALUATION_OPTIONS : EXIT_EVALUATION_OPTIONS}
            value={selectedPoint.side === 'buy' ? selectedReview.entry_evaluation : selectedReview.exit_evaluation}
            onChange={(value) => onDecisionReviewChange(
              selectedPoint.id,
              selectedPoint.side === 'buy' ? 'entry_evaluation' : 'exit_evaluation',
              value,
            )}
          />
          <textarea
            className="v2-decision-note"
            value={selectedReview.note || ''}
            onChange={(event) => onDecisionReviewChange(selectedPoint.id, 'note', event.target.value)}
            placeholder="この売買判断について一言"
            rows={2}
          />
        </section>
      ) : null}
    </aside>
  )
}
