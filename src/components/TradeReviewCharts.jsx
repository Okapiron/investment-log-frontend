import TradeChart from './TradeChart'

const TIMEFRAME_OPTIONS = [
  { value: 'daily', label: '日足' },
  { value: 'weekly', label: '週足' },
  { value: 'monthly', label: '月足' },
]

const INDICATOR_OPTIONS = [
  { value: 'none', label: 'なし' },
  { value: 'ma', label: 'MA' },
  { value: 'bb', label: 'BB' },
]

const INDICATOR_PRESETS = {
  daily: { label: '日足', maPeriods: [5, 25, 75], bbPeriod: 25, bbSigmas: [1, 2, 3] },
  weekly: { label: '週足', maPeriods: [13, 26, 52], bbPeriod: 26, bbSigmas: [1, 2, 3] },
  monthly: { label: '月足', maPeriods: [9, 24, 60], bbPeriod: 24, bbSigmas: [1, 2, 3] },
}

function buttonStyle(active) {
  return {
    border: active ? '1px solid #2f6fed' : '1px solid #d0d5dd',
    background: active ? '#eff4ff' : '#fff',
    color: active ? '#174ea6' : '#344054',
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  }
}

function getIndicatorConfig(timeframe, mode) {
  const preset = INDICATOR_PRESETS[timeframe]
  if (!preset || mode === 'none') return null
  if (mode === 'ma') return { maPeriods: preset.maPeriods }
  if (mode === 'bb') return { bbPeriod: preset.bbPeriod, bbSigmas: preset.bbSigmas }
  return null
}

function getSupportTimeframes(mainTimeframe) {
  return TIMEFRAME_OPTIONS.map((item) => item.value).filter((value) => value !== mainTimeframe)
}

function alignDateToBars(bars, dateValue) {
  const target = String(dateValue || '').slice(0, 10)
  if (!target || !Array.isArray(bars) || !bars.length) return ''
  let aligned = String(bars[0]?.time || '').slice(0, 10)
  for (const bar of bars) {
    const time = String(bar?.time || '').slice(0, 10)
    if (!time) continue
    if (time <= target) aligned = time
    if (time > target) break
  }
  return aligned
}

function decisionMarkersForBars(decisionPoints, bars) {
  if (!Array.isArray(decisionPoints)) return []
  return decisionPoints
    .map((point) => {
      const time = alignDateToBars(bars, point?.occurred_at)
      if (!time) return null
      const sideLabel = point.side === 'buy' ? 'B' : 'S'
      const price = Number(point.average_price)
      return {
        id: point.id,
        side: point.side,
        time,
        price,
        label: `${sideLabel}${Number(point.sequence)} ${Number.isFinite(price) ? price.toLocaleString('ja-JP') : ''}`.trim(),
      }
    })
    .filter(Boolean)
}

function episodeFocusSpec(decisionPoints, timeframe) {
  if (!Array.isArray(decisionPoints) || !decisionPoints.length) return null
  const firstBuy = decisionPoints.find((point) => point.side === 'buy')
  const sells = decisionPoints.filter((point) => point.side === 'sell')
  const lastSell = sells[sells.length - 1]
  const padding = timeframe === 'daily' ? 20 : timeframe === 'weekly' ? 10 : 6
  return {
    mode: 'range',
    preBars: padding,
    postBars: padding,
    buyDate: String(firstBuy?.occurred_at || decisionPoints[0]?.occurred_at || '').slice(0, 10),
    sellDate: String(lastSell?.occurred_at || '').slice(0, 10),
    isOpen: !lastSell,
  }
}

function getFill(trade, side) {
  const fills = Array.isArray(trade?.fills) ? trade.fills : []
  const fill = fills.find((item) => item?.side === side)
  if (!fill) return null
  return {
    date: fill.date,
    price: fill.price,
    qty: fill.qty,
  }
}

function getOpeningFill(trade) {
  return getFill(trade, trade?.position_side === 'short' ? 'sell' : 'buy')
}

function getClosingFill(trade) {
  return getFill(trade, trade?.position_side === 'short' ? 'buy' : 'sell')
}

function ChartPanel({
  title,
  timeframe,
  bars,
  trade,
  decisionPoints,
  selectedDecisionPointId,
  onDecisionPointSelect,
  main = false,
  indicatorMode,
}) {
  const selectedPoint = decisionPoints?.find((item) => String(item.id) === String(selectedDecisionPointId))
  const selectedFill = selectedPoint
    ? { date: String(selectedPoint.occurred_at || '').slice(0, 10), price: selectedPoint.average_price, qty: selectedPoint.quantity }
    : null
  const buyFill = selectedPoint ? (selectedPoint.side === 'buy' ? selectedFill : null) : getOpeningFill(trade)
  const sellFill = selectedPoint ? (selectedPoint.side === 'sell' ? selectedFill : null) : getClosingFill(trade)
  const hasBars = Array.isArray(bars) && bars.length > 0
  const decisionMarkers = decisionMarkersForBars(decisionPoints, bars)

  return (
    <section
      style={{
        border: '1px solid #1f2937',
        background: '#0b1220',
        borderRadius: 8,
        overflow: 'hidden',
        minHeight: main ? 480 : 300,
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '9px 11px',
          borderBottom: '1px solid #1f2937',
          color: '#e5e7eb',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 900 }}>{title}</div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          {indicatorMode === 'ma' ? 'MA' : indicatorMode === 'bb' ? 'BB' : 'Indicator off'}
        </div>
      </div>
      {hasBars ? (
        <TradeChart
          key={`${timeframe}-${indicatorMode}`}
          bars={bars}
          buyFill={buyFill}
          sellFill={sellFill}
          decisionMarkers={decisionMarkers}
          selectedDecisionPointId={selectedDecisionPointId}
          onDecisionPointSelect={onDecisionPointSelect}
          focusSpec={episodeFocusSpec(decisionPoints, timeframe)}
          height={main ? 440 : 260}
          dark
          indicatorConfig={getIndicatorConfig(timeframe, indicatorMode)}
        />
      ) : (
        <div style={{ color: '#9ca3af', display: 'grid', placeItems: 'center', minHeight: main ? 440 : 260, fontSize: 13 }}>
          チャートデータがありません
        </div>
      )}
    </section>
  )
}

export default function TradeReviewCharts({
  trade,
  decisionPoints = [],
  selectedDecisionPointId = null,
  onDecisionPointSelect,
  seriesByTimeframe,
  mainTimeframe = 'daily',
  indicatorMode = 'none',
  onMainTimeframeChange,
  onIndicatorModeChange,
}) {
  const safeMain = TIMEFRAME_OPTIONS.some((item) => item.value === mainTimeframe) ? mainTimeframe : 'daily'
  const supportTimeframes = getSupportTimeframes(safeMain)

  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TIMEFRAME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              style={buttonStyle(option.value === safeMain)}
              onClick={() => onMainTimeframeChange?.(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {INDICATOR_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              style={buttonStyle(option.value === indicatorMode)}
              onClick={() => onIndicatorModeChange?.(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <ChartPanel
        title={`${TIMEFRAME_OPTIONS.find((item) => item.value === safeMain)?.label || '日足'}メイン`}
        timeframe={safeMain}
        bars={seriesByTimeframe?.[safeMain] || []}
        trade={trade}
        decisionPoints={decisionPoints}
        selectedDecisionPointId={selectedDecisionPointId}
        onDecisionPointSelect={onDecisionPointSelect}
        indicatorMode={indicatorMode}
        main
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
        {supportTimeframes.map((timeframe) => (
          <ChartPanel
            key={timeframe}
            title={TIMEFRAME_OPTIONS.find((item) => item.value === timeframe)?.label || timeframe}
            timeframe={timeframe}
            bars={seriesByTimeframe?.[timeframe] || []}
            trade={trade}
            decisionPoints={decisionPoints}
            selectedDecisionPointId={selectedDecisionPointId}
            onDecisionPointSelect={onDecisionPointSelect}
            indicatorMode={indicatorMode}
          />
        ))}
      </div>
    </section>
  )
}

export { INDICATOR_PRESETS, TIMEFRAME_OPTIONS }
