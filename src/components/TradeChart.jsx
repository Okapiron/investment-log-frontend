import { useEffect, useMemo, useRef } from 'react'

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
  const resizeObserverRef = useRef(null)
  const lastRangeTokenRef = useRef(null)

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
        color: '#067647',
        shape: 'arrowUp',
        text: 'BUY',
      })
    }
    if (sellFill?.date) {
      m.push({
        time: sellFill.date,
        position: 'aboveBar',
        color: '#b42318',
        shape: 'arrowDown',
        text: 'SELL',
      })
    }
    return m
  }, [buyFill?.date, sellFill?.date])

  useEffect(() => {
    barsRef.current = bars
  }, [bars])

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
          rightPriceScale: { borderColor: '#eaecf0' },
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
            })
          : chart.addSeries(LWC.CandlestickSeries, {
              upColor: '#12b76a',
              downColor: '#f04438',
              borderVisible: false,
              wickUpColor: '#12b76a',
              wickDownColor: '#f04438',
              priceScaleId: 'right',
            })

        const volumeSeries = chart.addHistogramSeries
          ? chart.addHistogramSeries({
              priceFormat: { type: 'volume' },
              priceScaleId: '',
            })
          : chart.addSeries(LWC.HistogramSeries, {
              priceFormat: { type: 'volume' },
              priceScaleId: '',
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
  }, [bars, markers, onError])

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
