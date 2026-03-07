import { useEffect, useMemo, useRef, useState } from 'react'

let lwcPromise = null
function loadLWC() {
  if (lwcPromise) return lwcPromise
  lwcPromise = import(/* @vite-ignore */ 'https://esm.sh/lightweight-charts@4.2.2')
  return lwcPromise
}

function normalizeLWC(mod) {
  // esm.sh may return { default: {...exports} }
  if (mod?.createChart) return mod
  if (mod?.default?.createChart) return mod.default
  return mod
}

export default function TradeChart({ bars, buyFill, sellFill, focusSpec, resetKey = 0, onError, height = 420 }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const candleSeriesRef = useRef(null)
  const volumeSeriesRef = useRef(null)
  const buyPriceLineRef = useRef(null)
  const sellPriceLineRef = useRef(null)
  const resizeObserverRef = useRef(null)
  const lastRangeTokenRef = useRef(null)
  const buyPriceRef = useRef(Number(buyFill?.price))
  const sellPriceRef = useRef(Number(sellFill?.price))

  const [showBuyLine, setShowBuyLine] = useState(true)
  const [showSellLine, setShowSellLine] = useState(true)

  const barsRef = useRef(bars)
  const markersRef = useRef([])

  const hasBars = Array.isArray(bars) && bars.length > 0

  const effectiveFocusSpec = useMemo(() => {
    // If parent doesn't pass focusSpec, default to entry-centered view
    // using buy date (and sell date if available).
    if (focusSpec) return focusSpec
    return {
      mode: 'entry',
      preBars: 20,
      postBars: 20,
      buyDate: buyFill?.date,
      sellDate: sellFill?.date,
      isOpen: !sellFill?.date,
    }
  }, [focusSpec, buyFill?.date, sellFill?.date])

  const markers = useMemo(() => {
    const m = []
    if (buyFill?.date) {
      m.push({
        time: buyFill.date,
        position: 'belowBar',
        color: showBuyLine ? '#067647' : 'rgba(6, 118, 71, 0)',
        shape: 'arrowUp',
        size: 1.2,
        text: Number.isFinite(Number(buyFill?.price)) ? `BUY\n${Number(buyFill.price)}` : 'BUY',
      })
    }
    if (sellFill?.date) {
      m.push({
        time: sellFill.date,
        position: 'aboveBar',
        color: showSellLine ? '#b42318' : 'rgba(180, 35, 24, 0)',
        shape: 'arrowDown',
        size: 1.2,
        text: Number.isFinite(Number(sellFill?.price)) ? `SELL\n${Number(sellFill.price)}` : 'SELL',
      })
    }
    return m
  }, [buyFill?.date, sellFill?.date, buyFill?.price, sellFill?.price, showBuyLine, showSellLine])

  useEffect(() => {
    barsRef.current = bars
  }, [bars])

  useEffect(() => {
    buyPriceRef.current = Number(buyFill?.price)
    sellPriceRef.current = Number(sellFill?.price)
  }, [buyFill?.price, sellFill?.price])

  useEffect(() => {
    markersRef.current = markers
  }, [markers])

  function applyLatestData() {
    const b = barsRef.current
    if (!Array.isArray(b) || b.length === 0) return
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !chartRef.current) return

    const candleData = b.map((x) => ({
      time: x.time,
      open: Number(x.open),
      high: Number(x.high),
      low: Number(x.low),
      close: Number(x.close),
    }))
    candleSeriesRef.current.setData(candleData)

    const volumeData = b.map((x) => ({
      time: x.time,
      value: Number(x.volume || 0),
      color: Number(x.close) >= Number(x.open) ? 'rgba(18,183,106,0.35)' : 'rgba(240,68,56,0.35)',
    }))
    volumeSeriesRef.current.setData(volumeData)

    const m = markersRef.current || []
    if (typeof candleSeriesRef.current.setMarkers === 'function') {
      candleSeriesRef.current.setMarkers(Array.isArray(m) ? m : [])
    }

    if (buyPriceLineRef.current) {
      candleSeriesRef.current.removePriceLine(buyPriceLineRef.current)
      buyPriceLineRef.current = null
    }
    if (sellPriceLineRef.current) {
      candleSeriesRef.current.removePriceLine(sellPriceLineRef.current)
      sellPriceLineRef.current = null
    }

    const buyPrice = Number(buyFill?.price)
    if (Number.isFinite(buyPrice) && buyPrice > 0) {
      buyPriceLineRef.current = candleSeriesRef.current.createPriceLine({
        price: buyPrice,
        color: showBuyLine ? 'rgba(6, 118, 71, 0.55)' : 'rgba(6, 118, 71, 0)',
        lineWidth: 1.5,
        lineStyle: 3,
        axisLabelVisible: false,
        title: '',
      })
    }

    const sellPrice = Number(sellFill?.price)
    if (Number.isFinite(sellPrice) && sellPrice > 0) {
      sellPriceLineRef.current = candleSeriesRef.current.createPriceLine({
        price: sellPrice,
        color: showSellLine ? 'rgba(180, 35, 24, 0.55)' : 'rgba(180, 35, 24, 0)',
        lineWidth: 1.5,
        lineStyle: 3,
        axisLabelVisible: false,
        title: '',
      })
    }
  }

  function findIndexByDateOrPrev(dateStr) {
    const b = barsRef.current
    if (!Array.isArray(b) || b.length === 0 || !dateStr) return -1
    const exact = b.findIndex((x) => x.time === dateStr)
    if (exact >= 0) return exact
    let idx = -1
    for (let i = 0; i < b.length; i += 1) {
      if (b[i].time <= dateStr) idx = i
      if (b[i].time > dateStr) break
    }
    if (idx >= 0) return idx
    return 0
  }

  function applyVisibleRangeFromFocus(focusSpec, resetKey) {
    const b = barsRef.current
    if (!Array.isArray(b) || b.length === 0 || !chartRef.current) return

    const mode = focusSpec?.mode || 'entry'
    const pre = Math.max(0, Number(focusSpec?.preBars) || 20)
    const post = Math.max(0, Number(focusSpec?.postBars) || 20)
    const isOpen = Boolean(focusSpec?.isOpen)

    const buyIdx =
      Number.isFinite(Number(focusSpec?.buyIndex)) && Number(focusSpec?.buyIndex) >= 0
        ? Number(focusSpec?.buyIndex)
        : findIndexByDateOrPrev(focusSpec?.buyDate)
    const sellIdx =
      Number.isFinite(Number(focusSpec?.sellIndex)) && Number(focusSpec?.sellIndex) >= 0
        ? Number(focusSpec?.sellIndex)
        : findIndexByDateOrPrev(focusSpec?.sellDate)

    let from = 0
    let to = b.length - 1

    if (mode === 'entry' && buyIdx >= 0) {
      from = buyIdx - pre
      to = buyIdx + post
    } else if (mode === 'exit' && !isOpen && sellIdx >= 0) {
      from = sellIdx - pre
      to = sellIdx + post
    } else if (mode === 'range' && buyIdx >= 0) {
      from = buyIdx - pre
      if (isOpen) {
        to = b.length - 1
      } else if (sellIdx >= 0) {
        to = sellIdx + post
      }
    }

    from = Math.max(0, from)
    to = Math.min(b.length - 1, to)
    if (from > to) {
      from = 0
      to = b.length - 1
    }

    chartRef.current.timeScale().setVisibleLogicalRange({ from, to })
    lastRangeTokenRef.current = `${resetKey}:${mode}:${pre}:${post}:${b.length}:${focusSpec?.buyDate || ''}:${focusSpec?.sellDate || ''}`
  }

  // 1) init chart once
  useEffect(() => {
    let cancelled = false

    async function init() {
      const container = containerRef.current
      if (!container) return

      // If we already created the chart, do nothing
      if (chartRef.current) return

      let LWC
      try {
        const mod = await loadLWC()
        LWC = normalizeLWC(mod)
      } catch (e) {
        if (!cancelled && onError) onError('チャートを表示できませんでした')
        return
      }

      if (!LWC || typeof LWC.createChart !== 'function') {
        throw new Error('lightweight-charts createChart not found')
      }

      if (cancelled) return

      // Ensure container is clean (prevents stacked canvases)
      container.innerHTML = ''

      try {
        const chart = LWC.createChart(container, {
          width: container.clientWidth || 800,
          height,
          layout: { background: { color: '#ffffff' }, textColor: '#475467' },
          grid: {
            vertLines: { color: '#f2f4f7' },
            horzLines: { color: '#f2f4f7' },
          },
          rightPriceScale: { borderColor: '#eaecf0', lastValueVisible: false, lastValueLabelVisible: false },
          timeScale: { borderColor: '#eaecf0' },
          localization: { locale: 'ja-JP' },
        })

        const candleSeries = chart.addCandlestickSeries
          ? chart.addCandlestickSeries({
              upColor: '#12b76a',
              downColor: '#f04438',
              borderVisible: false,
              wickUpColor: '#12b76a',
              wickDownColor: '#f04438',
              priceScaleId: 'right',
              lastValueVisible: false,
              priceLineVisible: false,
              autoscaleInfoProvider: (original) => {
                const base = typeof original === 'function' ? original() : null
                if (!base?.priceRange) return base
                let minValue = base.priceRange.minValue
                let maxValue = base.priceRange.maxValue
                const buy = Number(buyPriceRef.current)
                const sell = Number(sellPriceRef.current)
                if (Number.isFinite(buy) && buy > 0) {
                  minValue = Math.min(minValue, buy)
                  maxValue = Math.max(maxValue, buy)
                }
                if (Number.isFinite(sell) && sell > 0) {
                  minValue = Math.min(minValue, sell)
                  maxValue = Math.max(maxValue, sell)
                }
                return {
                  ...base,
                  priceRange: { minValue, maxValue },
                }
              },
            })
          : chart.addSeries(LWC.CandlestickSeries, {
              upColor: '#12b76a',
              downColor: '#f04438',
              borderVisible: false,
              wickUpColor: '#12b76a',
              wickDownColor: '#f04438',
              priceScaleId: 'right',
              lastValueVisible: false,
              priceLineVisible: false,
              autoscaleInfoProvider: (original) => {
                const base = typeof original === 'function' ? original() : null
                if (!base?.priceRange) return base
                let minValue = base.priceRange.minValue
                let maxValue = base.priceRange.maxValue
                const buy = Number(buyPriceRef.current)
                const sell = Number(sellPriceRef.current)
                if (Number.isFinite(buy) && buy > 0) {
                  minValue = Math.min(minValue, buy)
                  maxValue = Math.max(maxValue, buy)
                }
                if (Number.isFinite(sell) && sell > 0) {
                  minValue = Math.min(minValue, sell)
                  maxValue = Math.max(maxValue, sell)
                }
                return {
                  ...base,
                  priceRange: { minValue, maxValue },
                }
              },
            })

        const volumeSeries = chart.addHistogramSeries
          ? chart.addHistogramSeries({
              priceFormat: { type: 'volume' },
              priceScaleId: '',
              lastValueVisible: false,
              priceLineVisible: false,
            })
          : chart.addSeries(LWC.HistogramSeries, {
              priceFormat: { type: 'volume' },
              priceScaleId: '',
              lastValueVisible: false,
              priceLineVisible: false,
            })

        chart.priceScale('right').applyOptions({
          scaleMargins: { top: 0.08, bottom: 0.3 },
        })
        chart.priceScale('').applyOptions({
          scaleMargins: { top: 0.75, bottom: 0 },
        })

        chartRef.current = chart
        candleSeriesRef.current = candleSeries
        volumeSeriesRef.current = volumeSeries

        // If bars were already fetched before init finished, apply them now
        applyLatestData()
        applyVisibleRangeFromFocus(effectiveFocusSpec, resetKey)

        const ro = new ResizeObserver((entries) => {
          const entry = entries[0]
          if (!entry || !chartRef.current) return
          const w = Math.floor(entry.contentRect.width)
          chartRef.current.applyOptions({ width: w, height })
        })
        ro.observe(container)
        resizeObserverRef.current = ro
      } catch (e) {
        if (!cancelled && onError) onError('チャートを表示できませんでした')
      }
    }

    init()

    return () => {
      cancelled = true
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
      if (candleSeriesRef.current && buyPriceLineRef.current) {
        candleSeriesRef.current.removePriceLine(buyPriceLineRef.current)
        buyPriceLineRef.current = null
      }
      if (candleSeriesRef.current && sellPriceLineRef.current) {
        candleSeriesRef.current.removePriceLine(sellPriceLineRef.current)
        sellPriceLineRef.current = null
      }
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [onError, height])

  // 2) update data when bars change
  useEffect(() => {
    try {
      applyLatestData()
    } catch (e) {
      if (onError) onError('チャートを表示できませんでした')
    }
  }, [bars, markers, buyFill?.price, sellFill?.price, showBuyLine, showSellLine, onError])

  useEffect(() => {
    try {
      if (!chartRef.current || !Array.isArray(bars) || bars.length === 0) return
      const mode = effectiveFocusSpec?.mode || 'entry'
      const pre = Math.max(0, Number(effectiveFocusSpec?.preBars) || 20)
      const post = Math.max(0, Number(effectiveFocusSpec?.postBars) || 20)
      const token = `${resetKey}:${mode}:${pre}:${post}:${bars.length}:${effectiveFocusSpec?.buyDate || ''}:${effectiveFocusSpec?.sellDate || ''}`
      if (lastRangeTokenRef.current === token) return
      applyVisibleRangeFromFocus(effectiveFocusSpec, resetKey)
    } catch (e) {
      if (onError) onError('チャートを表示できませんでした')
    }
  }, [bars, effectiveFocusSpec, resetKey, onError])

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {(buyFill?.date || sellFill?.date) ? (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          {buyFill?.date ? (
            <button
              type="button"
              onClick={() => setShowBuyLine((v) => !v)}
              style={{
                alignSelf: 'flex-start',
                padding: '4px 8px',
                borderRadius: 999,
                background: showBuyLine ? 'rgba(6, 118, 71, 0.10)' : 'rgba(6, 118, 71, 0.04)',
                border: `1px solid ${showBuyLine ? 'rgba(6, 118, 71, 0.25)' : 'rgba(6, 118, 71, 0.14)'}`,
                color: showBuyLine ? '#067647' : 'rgba(6, 118, 71, 0.45)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                pointerEvents: 'auto',
                opacity: showBuyLine ? 1 : 0.6,
              }}
              aria-pressed={showBuyLine}
              title={showBuyLine ? 'BUYラインを非表示' : 'BUYラインを表示'}
            >
              BUY
            </button>
          ) : null}
          {sellFill?.date ? (
            <button
              type="button"
              onClick={() => setShowSellLine((v) => !v)}
              style={{
                alignSelf: 'flex-start',
                padding: '4px 8px',
                borderRadius: 999,
                background: showSellLine ? 'rgba(180, 35, 24, 0.10)' : 'rgba(180, 35, 24, 0.04)',
                border: `1px solid ${showSellLine ? 'rgba(180, 35, 24, 0.25)' : 'rgba(180, 35, 24, 0.14)'}`,
                color: showSellLine ? '#b42318' : 'rgba(180, 35, 24, 0.45)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                pointerEvents: 'auto',
                opacity: showSellLine ? 1 : 0.6,
              }}
              aria-pressed={showSellLine}
              title={showSellLine ? 'SELLラインを非表示' : 'SELLラインを表示'}
            >
              SELL
            </button>
          ) : null}
        </div>
      ) : null}
      {!hasBars ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: '#667085',
          }}
        >
          チャートデータがありません
        </div>
      ) : null}
    </div>
  )
}
