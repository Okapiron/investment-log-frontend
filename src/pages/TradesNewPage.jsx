import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { TAG_OPTIONS } from '../lib/tags'
import { assessPriceSanityAgainstDailyBars } from '../lib/priceSanity'

const US_STOCK_CANDIDATES = [
  { market: 'US', symbol: 'AAPL', name: 'Apple Inc', aliases: ['AAPL', 'Apple', 'Apple Inc', 'アップル'] },
  { market: 'US', symbol: 'MSFT', name: 'Microsoft Corp', aliases: ['MSFT', 'Microsoft', 'Microsoft Corp', 'マイクロソフト'] },
  { market: 'US', symbol: 'NVDA', name: 'NVIDIA Corp', aliases: ['NVDA', 'NVIDIA', 'Nvidia', 'エヌビディア', 'ヌビディア'] },
  { market: 'US', symbol: 'AMZN', name: 'Amazon.com Inc', aliases: ['AMZN', 'Amazon', 'Amazon.com', 'アマゾン'] },
  { market: 'US', symbol: 'GOOGL', name: 'Alphabet Inc', aliases: ['GOOGL', 'Alphabet', 'Google', 'アルファベット', 'グーグル'] },
  { market: 'US', symbol: 'META', name: 'Meta Platforms Inc', aliases: ['META', 'Meta', 'Facebook', 'メタ', 'フェイスブック'] },
  { market: 'US', symbol: 'TSLA', name: 'Tesla Inc', aliases: ['TSLA', 'Tesla', 'テスラ'] },
  { market: 'US', symbol: 'AVGO', name: 'Broadcom Inc', aliases: ['AVGO', 'Broadcom', 'ブロードコム'] },
  { market: 'US', symbol: 'COST', name: 'Costco Wholesale Corp', aliases: ['COST', 'Costco', 'コストコ'] },
  { market: 'US', symbol: 'NFLX', name: 'Netflix Inc', aliases: ['NFLX', 'Netflix', 'ネットフリックス'] },
  { market: 'US', symbol: 'AMD', name: 'Advanced Micro Devices', aliases: ['AMD', 'Advanced Micro Devices', 'エーエムディー'] },
  { market: 'US', symbol: 'INTC', name: 'Intel Corp', aliases: ['INTC', 'Intel', 'インテル'] },
  { market: 'US', symbol: 'QCOM', name: 'Qualcomm Inc', aliases: ['QCOM', 'Qualcomm', 'クアルコム'] },
  { market: 'US', symbol: 'ADBE', name: 'Adobe Inc', aliases: ['ADBE', 'Adobe', 'アドビ'] },
  { market: 'US', symbol: 'CRM', name: 'Salesforce Inc', aliases: ['CRM', 'Salesforce', 'Salesforce Inc', 'セールスフォース'] },
  { market: 'US', symbol: 'ORCL', name: 'Oracle Corp', aliases: ['ORCL', 'Oracle', 'オラクル'] },
  { market: 'US', symbol: 'CSCO', name: 'Cisco Systems Inc', aliases: ['CSCO', 'Cisco', 'Cisco Systems Inc', 'シスコ'] },
  { market: 'US', symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', aliases: ['SPY', 'SPDR', 'S&P500', 'S&P 500', 'SP500', 'エスアンドピー500', 'エスピー500'] },
  { market: 'US', symbol: 'VOO', name: 'Vanguard S&P 500 ETF', aliases: ['VOO', 'Vanguard', 'S&P500', 'S&P 500', 'バンガード', 'ブイオーオー'] },
  { market: 'US', symbol: 'IVV', name: 'iShares Core S&P 500 ETF', aliases: ['IVV', 'iShares', 'S&P500', 'S&P 500', 'アイシェアーズ', 'アイヴィヴィ'] },
  { market: 'US', symbol: 'QQQ', name: 'Invesco QQQ Trust', aliases: ['QQQ', 'Nasdaq100', 'NASDAQ100', 'NASDAQ 100', 'ナスダック100', 'キューキューキュー'] },
  { market: 'US', symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', aliases: ['VTI', 'Total Stock Market', 'バンガード', 'ブイティーアイ'] },
  { market: 'US', symbol: 'VT', name: 'Vanguard Total World Stock ETF', aliases: ['VT', 'Total World', 'バンガード', 'ブイティー'] },
  { market: 'US', symbol: 'SCHD', name: 'Schwab U.S. Dividend Equity ETF', aliases: ['SCHD', 'Schwab', 'Dividend', 'ディビデンド', 'エスシーエイチディー'] },
  { market: 'US', symbol: 'IWM', name: 'iShares Russell 2000 ETF', aliases: ['IWM', 'Russell2000', 'ラッセル2000', 'アイダブリューエム'] },
  { market: 'US', symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF', aliases: ['DIA', 'Dow', 'ダウ', 'ダウ30', 'ディーアイエー'] },
  { market: 'US', symbol: 'XLK', name: 'Technology Select Sector SPDR Fund', aliases: ['XLK', 'Technology', 'テクノロジー', 'エックスエルケー'] },
  { market: 'US', symbol: 'SMH', name: 'VanEck Semiconductor ETF', aliases: ['SMH', 'Semiconductor', '半導体', 'エスエムエイチ'] },
  { market: 'US', symbol: 'SOXX', name: 'iShares Semiconductor ETF', aliases: ['SOXX', 'Semiconductor', '半導体', 'ソックス'] },

  { market: 'US', symbol: 'BRK.B', name: 'Berkshire Hathaway Inc Class B', aliases: ['BRK.B', 'BRKB', 'Berkshire', 'バークシャー', 'バークシャーハサウェイ'] },
  { market: 'US', symbol: 'JPM', name: 'JPMorgan Chase & Co', aliases: ['JPM', 'JPMorgan', 'JP Morgan', 'ジェイピー・モルガン', 'ジェイピー モルガン'] },
  { market: 'US', symbol: 'V', name: 'Visa Inc', aliases: ['V', 'Visa', 'ビザ'] },
  { market: 'US', symbol: 'MA', name: 'Mastercard Inc', aliases: ['MA', 'Mastercard', 'マスターカード'] },
  { market: 'US', symbol: 'JNJ', name: 'Johnson & Johnson', aliases: ['JNJ', 'Johnson & Johnson', 'ジョンソンアンドジョンソン', 'J&J'] },
  { market: 'US', symbol: 'PG', name: 'Procter & Gamble Co', aliases: ['PG', 'Procter & Gamble', 'P&G', 'プロクターアンドギャンブル'] },
  { market: 'US', symbol: 'KO', name: 'Coca-Cola Co', aliases: ['KO', 'Coca-Cola', 'Coke', 'コカコーラ'] },
  { market: 'US', symbol: 'PEP', name: 'PepsiCo Inc', aliases: ['PEP', 'PepsiCo', 'Pepsi', 'ペプシ'] },
  { market: 'US', symbol: 'WMT', name: 'Walmart Inc', aliases: ['WMT', 'Walmart', 'ウォルマート'] },
  { market: 'US', symbol: 'HD', name: 'Home Depot Inc', aliases: ['HD', 'Home Depot', 'ホームデポ'] },
  { market: 'US', symbol: 'MCD', name: "McDonald's Corp", aliases: ['MCD', "McDonald's", 'マクドナルド'] },
  { market: 'US', symbol: 'NKE', name: 'Nike Inc', aliases: ['NKE', 'Nike', 'ナイキ'] },

  { market: 'US', symbol: 'LLY', name: 'Eli Lilly and Co', aliases: ['LLY', 'Eli Lilly', 'イーライリリー'] },
  { market: 'US', symbol: 'UNH', name: 'UnitedHealth Group Inc', aliases: ['UNH', 'UnitedHealth', 'ユナイテッドヘルス'] },
  { market: 'US', symbol: 'XOM', name: 'Exxon Mobil Corp', aliases: ['XOM', 'Exxon', 'Exxon Mobil', 'エクソンモービル'] },
  { market: 'US', symbol: 'CVX', name: 'Chevron Corp', aliases: ['CVX', 'Chevron', 'シェブロン'] },

  { market: 'US', symbol: 'PLTR', name: 'Palantir Technologies Inc', aliases: ['PLTR', 'Palantir', 'パランティア'] },
  { market: 'US', symbol: 'SNOW', name: 'Snowflake Inc', aliases: ['SNOW', 'Snowflake', 'スノーフレイク'] },
  { market: 'US', symbol: 'SHOP', name: 'Shopify Inc', aliases: ['SHOP', 'Shopify', 'ショッピファイ'] },
  { market: 'US', symbol: 'UBER', name: 'Uber Technologies Inc', aliases: ['UBER', 'Uber', 'ウーバー'] },
  { market: 'US', symbol: 'COIN', name: 'Coinbase Global Inc', aliases: ['COIN', 'Coinbase', 'コインベース'] },
  { market: 'US', symbol: 'MSTR', name: 'MicroStrategy Inc', aliases: ['MSTR', 'MicroStrategy', 'マイクロストラテジー'] },
  { market: 'US', symbol: 'TSM', name: 'Taiwan Semiconductor Manufacturing Co', aliases: ['TSM', 'TSMC', 'Taiwan Semiconductor', 'ティーエスエムシー'] },
]

function normalizeSymbol(_market, raw) {
  const s = String(raw || '').trim()
  if (!s) return ''

  // 全角英数字 → 半角英数字
  const half = s.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (ch) => {
    return String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  })

  // 半角英数字のみに絞る + 大文字化 + 5文字制限
  return half
    .replace(/[^0-9A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, 5)
}

function normalizeYmd(value) {
  const raw = String(value || '')
  // 全角数字 → 半角数字
  const half = raw.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
  const digits = half.replace(/[^0-9]/g, '').slice(0, 8)
  const y = digits.slice(0, 4)
  const m = digits.slice(4, 6)
  const d = digits.slice(6, 8)
  if (digits.length <= 4) return y
  if (digits.length <= 6) return `${y}-${m}`
  return `${y}-${m}-${d}`
}

function isFullYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

function toKatakana(input) {
  const s = String(input || '')
  return s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60))
}

function toHiragana(input) {
  const s = String(input || '')
  return s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}


function toHalfWidthDigits(raw) {
  return String(raw || '').replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
}

function normalizeDecimalInput(raw) {
  // 全角数字・全角ドット・カンマ等を吸収して "1234.56" 形式へ
  const half = toHalfWidthDigits(raw)
    .replace(/[．。]/g, '.')
    .replace(/[，,、\s]/g, '')

  const cleaned = half.replace(/[^0-9.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  // keep only the first dot
  const head = cleaned.slice(0, firstDot + 1)
  const tail = cleaned.slice(firstDot + 1).replace(/\./g, '')
  return head + tail
}

function normalizeIntInput(raw) {
  const half = toHalfWidthDigits(raw).replace(/[，,、\s]/g, '')
  return half.replace(/[^0-9]/g, '')
}

function parseNumberOrNull(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return n
}

function addTagCSV(csv, tag) {
  if (tag === '未設定') return ''
  const parts = (csv || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

  if (!parts.includes(tag)) parts.push(tag)
  return parts.join(',')
}

function removeTagCSV(csv, tag) {
  const target = String(tag || '').trim()
  if (!target) return (csv || '').trim()
  if (target === '未設定') return ''

  return (csv || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x !== target)
    .join(',')
}

function hasTagCSV(csv, tag) {
  const target = String(tag || '').trim()
  if (!target) return false
  if (target === '未設定') return (csv || '').trim() === ''

  return (csv || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .some((x) => x === target)
}

function toggleTagCSV(csv, tag) {
  return hasTagCSV(csv, tag) ? removeTagCSV(csv, tag) : addTagCSV(csv, tag)
}

export default function TradesNewPage() {
  const navigate = useNavigate()

  const MARKET_STORAGE_KEY = 'trades_new_market'
  const INSTRUMENT_CACHE_KEY = 'trades_instrument_cache_v1'
  const JP_MASTER_CACHE_KEY = 'trades_jp_master_cache_v1'
  const JP_MASTER_META_CACHE_KEY = 'trades_jp_master_meta_v1'
  const US_MASTER_CACHE_KEY = 'trades_us_master_cache_v1'
  const US_MASTER_META_CACHE_KEY = 'trades_us_master_meta_v1'

  const [market, setMarket] = useState('JP')
  const marketInitializedRef = useRef(false)
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [buyDate, setBuyDate] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [qty, setQty] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [sellDate, setSellDate] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [notesBuy, setNotesBuy] = useState('')
  const [notesSell, setNotesSell] = useState('')
  const [notesReview, setNotesReview] = useState('')
  const [rating, setRating] = useState(0)
  const [tags, setTags] = useState('')
  const [error, setError] = useState(null)
  const [priceCheckStatus, setPriceCheckStatus] = useState('idle')
  const [priceCheckError, setPriceCheckError] = useState('')
  const [priceCheckWarning, setPriceCheckWarning] = useState('')
  const [instrumentQuery, setInstrumentQuery] = useState('')
  const [instrumentConfirmed, setInstrumentConfirmed] = useState(false)
  const [instrumentOpen, setInstrumentOpen] = useState(false)
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0)

  const [toast, setToast] = useState('')
  const toastTimerRef = useRef(null)
  const buyDatePickerRef = useRef(null)
  const sellDatePickerRef = useRef(null)
  const instrumentWrapRef = useRef(null)
  const instrumentInputRef = useRef(null)

  // 最近使った銘柄のサジェスト
  const [recentInstruments, setRecentInstruments] = useState([])
  const [cachedInstruments, setCachedInstruments] = useState([])
  const [jpInstruments, setJpInstruments] = useState([])
  const [jpLoadState, setJpLoadState] = useState('idle')
  const jpLoadStartedRef = useRef(false)
  const [usInstruments, setUsInstruments] = useState([])
  const [usLoadState, setUsLoadState] = useState('idle')
  const usLoadStartedRef = useRef(false)
  const baseButtonStyle = {
    background: '#f2f4f7',
    color: '#111',
    border: '1px solid #d0d5dd',
    borderRadius: 10,
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 500,
  }
  const primaryButtonStyle = {
    background: '#2a8871',
    color: '#fff',
    border: '1px solid #2a8871',
    borderRadius: 10,
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 600,
  }
  // Load instrument cache (履歴ゼロでも入力を回すため)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(INSTRUMENT_CACHE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) {
        setCachedInstruments(parsed)
      }
    } catch {
      // ignore
    }
  }, [])

  async function loadJpInstrumentsIfNeeded() {
    if (jpLoadStartedRef.current || jpLoadState !== 'idle') return
    jpLoadStartedRef.current = true
    setJpLoadState('loading')

    const safeParse = (raw) => {
      try {
        return raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
    }

    const loadFromCache = () => {
      const cached = safeParse(localStorage.getItem(JP_MASTER_CACHE_KEY))
      if (Array.isArray(cached) && cached.length > 0) {
        setJpInstruments(cached)
        setJpLoadState('loaded')
        return true
      }
      return false
    }

    try {
      // 1) Try fetch meta (cache busting)
      let remoteMeta = null
      try {
        const metaResp = await fetch('/jp_instruments.meta.json', { cache: 'no-store' })
        if (metaResp.ok) remoteMeta = await metaResp.json()
      } catch {
        remoteMeta = null
      }

      const localMeta = safeParse(localStorage.getItem(JP_MASTER_META_CACHE_KEY))

      const metaMatches =
        remoteMeta &&
        localMeta &&
        remoteMeta.count === localMeta.count &&
        remoteMeta.source === localMeta.source &&
        remoteMeta.generated_at === localMeta.generated_at

      // 2) If meta matches, prefer cached instruments
      if (metaMatches) {
        if (loadFromCache()) return
      }

      // 3) Fetch fresh instruments and update cache
      const resp = await fetch('/jp_instruments.json', { cache: 'no-store' })
      if (!resp.ok) throw new Error(`jp master fetch failed: ${resp.status}`)
      const json = await resp.json()
      if (!Array.isArray(json)) throw new Error('jp master json is not an array')

      setJpInstruments(json)
      setJpLoadState('loaded')

      try {
        localStorage.setItem(JP_MASTER_CACHE_KEY, JSON.stringify(json))
        const metaToStore = remoteMeta || { generated_at: '', count: json.length, source: 'unknown' }
        localStorage.setItem(JP_MASTER_META_CACHE_KEY, JSON.stringify(metaToStore))
      } catch {
        // ignore cache write errors
      }
    } catch {
      // 4) Fallback: use cache if available, else error
      if (loadFromCache()) return
      setJpLoadState('error')
    }
  }

  async function loadUsInstrumentsIfNeeded() {
    if (usLoadStartedRef.current || usLoadState !== 'idle') return
    usLoadStartedRef.current = true
    setUsLoadState('loading')

    const safeParse = (raw) => {
      try {
        return raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
    }

    const loadFromCache = () => {
      const cached = safeParse(localStorage.getItem(US_MASTER_CACHE_KEY))
      if (Array.isArray(cached) && cached.length > 0) {
        setUsInstruments(cached)
        setUsLoadState('loaded')
        return true
      }
      return false
    }

    try {
      let remoteMeta = null
      try {
        const metaResp = await fetch('/us_instruments.meta.json', { cache: 'no-store' })
        if (metaResp.ok) remoteMeta = await metaResp.json()
      } catch {
        remoteMeta = null
      }

      const localMeta = safeParse(localStorage.getItem(US_MASTER_META_CACHE_KEY))
      const metaMatches =
        remoteMeta &&
        localMeta &&
        remoteMeta.count === localMeta.count &&
        remoteMeta.source === localMeta.source &&
        remoteMeta.generated_at === localMeta.generated_at

      if (metaMatches) {
        if (loadFromCache()) return
      }

      const resp = await fetch('/us_instruments.json', { cache: 'no-store' })
      if (!resp.ok) throw new Error(`us master fetch failed: ${resp.status}`)
      const json = await resp.json()
      if (!Array.isArray(json)) throw new Error('us master json is not an array')

      setUsInstruments(json)
      setUsLoadState('loaded')

      try {
        localStorage.setItem(US_MASTER_CACHE_KEY, JSON.stringify(json))
        const metaToStore = remoteMeta || { generated_at: '', count: json.length, source: 'unknown' }
        localStorage.setItem(US_MASTER_META_CACHE_KEY, JSON.stringify(metaToStore))
      } catch {
        // ignore
      }
    } catch {
      // Fallback: use cache if available; otherwise keep going with built-in candidates
      if (loadFromCache()) return
      setUsLoadState('error')
    }
  }
  const symbolNameMapRef = useRef(new Map())

  function showToast(message) {
    setToast(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setToast('')
      toastTimerRef.current = null
    }, 1800)
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  // Restore last market selection (PCで連続入力するときの手数削減)
  useEffect(() => {
    if (marketInitializedRef.current) return
    marketInitializedRef.current = true
    try {
      const saved = localStorage.getItem(MARKET_STORAGE_KEY)
      if (saved === 'JP' || saved === 'US') {
        setMarket(saved)
      }
    } catch {
      // ignore
    }
  }, [])

  // Persist market selection
  useEffect(() => {
    try {
      localStorage.setItem(MARKET_STORAGE_KEY, market)
    } catch {
      // ignore
    }
  }, [market])

  // 最近使った銘柄のサジェスト（入力のスピード改善）
  useEffect(() => {
    let cancelled = false

    async function loadRecent() {
      try {
        // 直近のトレードから候補を作る（limitは軽めに）
        const res = await api.get('/api/v1/trades?limit=200&offset=0')
        const items = Array.isArray(res?.data?.items) ? res.data.items : []

        const map = new Map()
        const instMap = new Map()

        for (const t of items) {
          const m = t?.market
          const s = String(t?.symbol || '').trim().toUpperCase()
          if (!m || !s) continue
          const key = `${m}:${s}`
          const nm = String(t?.name || '').trim()
          if (nm) {
            map.set(key, nm)
          }

           if (!instMap.has(key)) {
            instMap.set(key, {
              market: m,
              symbol: s,
              name: nm || null,
              aliases: [s, nm || ''].filter(Boolean),
              recent: true,
            })
          }
        }

        if (cancelled) return
        symbolNameMapRef.current = map
        setRecentInstruments(Array.from(instMap.values()))
      } catch {
        // ネットワークエラー等は無視（入力は継続できる）
        if (!cancelled) {
          setRecentInstruments([])
        }
      }
    }

    loadRecent()
    return () => {
      cancelled = true
    }
  }, [market])

  const instrumentCandidates = useMemo(() => {
    const merged = new Map()
    const addCandidate = (c, isRecent = false) => {
      const symbolNorm = normalizeSymbol(c.market, c.symbol)
      if (!symbolNorm) return
      const key = `${c.market}:${symbolNorm}`
      const prev = merged.get(key)
      const aliases = Array.from(
        new Set(
          [symbolNorm, c.name || '', ...(Array.isArray(c.aliases) ? c.aliases : [])]
            .map((x) => String(x || '').trim())
            .filter(Boolean)
        )
      )
      if (!prev) {
        merged.set(key, {
          market: c.market,
          symbol: symbolNorm,
          name: c.name || null,
          aliases,
          recent: isRecent || Boolean(c.recent),
        })
      } else {
        merged.set(key, {
          ...prev,
          name: prev.name || c.name || null,
          aliases: Array.from(new Set([...prev.aliases, ...aliases])),
          recent: prev.recent || isRecent || Boolean(c.recent),
        })
      }
    }

    US_STOCK_CANDIDATES.forEach((c) => addCandidate(c, false))
    usInstruments.forEach((c) => addCandidate(c, false))
    recentInstruments.forEach((c) => addCandidate(c, true))
    cachedInstruments.forEach((c) => addCandidate(c, true))
    jpInstruments.forEach((c) => addCandidate(c, false))

    const rawQuery = String(instrumentQuery || '').trim()
    const query = rawQuery.toLowerCase()
    const queryKata = toKatakana(rawQuery).toLowerCase()
    const queryHira = toHiragana(rawQuery).toLowerCase()

    // If query looks like a JP stock code (4-5 digits), offer a JP candidate even when there is no history yet.
    const rawQ = String(instrumentQuery || '').trim()
    const qDigits = rawQ.replace(/[^0-9]/g, '').slice(0, 5)
    if (qDigits.length >= 4 && qDigits.length <= 5) {
      addCandidate({ market: 'JP', symbol: qDigits, name: null, aliases: [qDigits] }, false)
    }

    const list = Array.from(merged.values())
      .map((c) => {
        const base = [c.symbol, c.name || '', ...(c.aliases || [])]
          .map((a) => String(a || '').trim())
          .filter(Boolean)

        const symbols = base
          .flatMap((x) => {
            const low = x.toLowerCase()
            const kata = toKatakana(x).toLowerCase()
            const hira = toHiragana(x).toLowerCase()
            return [low, kata, hira]
          })

        let score = 999
        if (!query) {
          score = 50
        } else if (
          symbols.some((x) => x.startsWith(query)) ||
          symbols.some((x) => x.startsWith(queryKata)) ||
          symbols.some((x) => x.startsWith(queryHira))
        ) {
          score = 0
        } else if (
          symbols.some((x) => x.includes(query)) ||
          symbols.some((x) => x.includes(queryKata)) ||
          symbols.some((x) => x.includes(queryHira))
        ) {
          score = 10
        }
        return { ...c, score }
      })
      .filter((c) => !query || c.score < 999)
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score
        if (a.recent !== b.recent) return a.recent ? -1 : 1
        if (a.market !== b.market) {
          if (a.market === market) return -1
          if (b.market === market) return 1
        }
        return a.symbol.localeCompare(b.symbol)
      })

    return list.slice(0, 12)
  }, [instrumentQuery, recentInstruments, cachedInstruments, jpInstruments, usInstruments, market])

  useEffect(() => {
    setActiveCandidateIndex(0)
  }, [instrumentCandidates.length, instrumentQuery])

  useEffect(() => {
    function onDocMouseDown(e) {
      if (!instrumentWrapRef.current) return
      if (!instrumentWrapRef.current.contains(e.target)) {
        setInstrumentOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  // 銘柄コードから表示名を自動補完（既存データがある場合のみ）
  useEffect(() => {
    const sym = normalizeSymbol(market, symbol)
    if (!sym) return
    if (String(name || '').trim()) return

    const key = `${market}:${sym}`
    const known = symbolNameMapRef.current.get(key)
    if (known) setName(known)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, symbol])

  function handleKeyNav(e) {
    const key = e.key

    // Japanese IMEなどの変換確定中はEnterでフォーカス移動しない
    if (e.isComposing || e.keyCode === 229) return

    function getNavElements(form) {
      if (!form) return []
      return Array.from(form.elements).filter((el) => {
        const tag = el.tagName
        if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return false
        // navigation: skip disabled / hidden / submit buttons
        if (el.disabled) return false
        if (el.type === 'submit') return false

        // hidden picker inputs should not be part of Enter navigation
        if (el.tabIndex < 0) return false
        if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false

        return true
      })
    }

    function focusNext() {
      const form = e.target.form
      const elements = getNavElements(form)
      const index = elements.indexOf(e.target)
      if (index > -1 && index + 1 < elements.length) {
        elements[index + 1].focus()
      }
    }

    function focusPrev() {
      const form = e.target.form
      const elements = getNavElements(form)
      const index = elements.indexOf(e.target)
      if (index > 0) {
        elements[index - 1].focus()
      }
    }

    if (key === 'Enter') {
      // Checkbox: Shift+Enter toggles ON/OFF, Enter moves next
      if (e.target.type === 'checkbox') {
        e.preventDefault()
        if (e.shiftKey) {
          e.target.click()
        } else {
          focusNext()
        }
        return
      }

      // Textarea: Shift+Enter = newline (default), Enter moves next
      if (e.target.tagName === 'TEXTAREA') {
        if (e.shiftKey) return
        e.preventDefault()
        focusNext()
        return
      }

      // Other fields: Enter moves next, Shift+Enter does nothing (do not submit)
      if (e.shiftKey) {
        e.preventDefault()
        return
      }

      e.preventDefault()
      if (e.target.name === 'symbol') {
        setSymbol((prev) => normalizeSymbol(market, prev))
      }
      focusNext()
      return
    }

    if (key === 'Escape') {
      e.preventDefault()
      focusPrev()
    }
  }

  function openDatePicker(ref) {
    const el = ref?.current
    if (!el) return
    // Chrome / modern browsers
    if (typeof el.showPicker === 'function') {
      el.showPicker()
      return
    }
    // Fallback
    el.focus()
    el.click()
  }

  // symbolの整形（market変更時も）
  useEffect(() => {
    setSymbol((prev) => normalizeSymbol(market, prev))
  }, [market])

  function confirmInstrument(candidate) {
    const pickedMarket = candidate.market
    const pickedSymbol = normalizeSymbol(pickedMarket, candidate.symbol)
    const pickedName = String(candidate.name || '').trim()

    setMarket(pickedMarket)
    setSymbol(pickedSymbol)
    setName(pickedName)
    setInstrumentConfirmed(true)
    setInstrumentOpen(false)
    setInstrumentQuery(`${pickedSymbol} / ${pickedName || '—'}（${pickedMarket}）`)

    // Persist to local cache so it appears as a candidate next time (even with zero backend history)
    try {
      const raw = localStorage.getItem(INSTRUMENT_CACHE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      const arr = Array.isArray(parsed) ? parsed : []
      const key = `${pickedMarket}:${pickedSymbol}`
      const next = [
        { market: pickedMarket, symbol: pickedSymbol, name: pickedName || null, aliases: [pickedSymbol, pickedName].filter(Boolean) },
        ...arr.filter((x) => `${x?.market}:${normalizeSymbol(x?.market, x?.symbol)}` !== key),
      ].slice(0, 200)
      localStorage.setItem(INSTRUMENT_CACHE_KEY, JSON.stringify(next))
      setCachedInstruments(next)
    } catch {
      // ignore
    }
  }

  function clearConfirmedInstrument() {
    setInstrumentConfirmed(false)
    setInstrumentOpen(false)
    setInstrumentQuery('')
    setSymbol('')
    setName('')
    setTimeout(() => instrumentInputRef.current?.focus(), 0)
  }

  function handleInstrumentKeyDown(e) {
    if (e.isComposing || e.keyCode === 229) return
    // When instrument is confirmed (input is readOnly), allow Backspace/Delete to clear it
    if (instrumentConfirmed && (e.key === 'Backspace' || e.key === 'Delete')) {
      e.preventDefault()
      clearConfirmedInstrument()
      return
    }
    if (!instrumentOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setInstrumentOpen(true)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveCandidateIndex((i) => Math.min(i + 1, Math.max(0, instrumentCandidates.length - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveCandidateIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setInstrumentOpen(false)
      return
    }
    if (e.key === 'Enter') {
      if (instrumentOpen && instrumentCandidates.length > 0) {
        e.preventDefault()
        confirmInstrument(instrumentCandidates[activeCandidateIndex] || instrumentCandidates[0])
        return
      }

      e.preventDefault()

      // If the instrument is already confirmed, move to the next input field
      if (instrumentConfirmed) {
        const form = e.target.form
        if (form) {
          const elements = Array.from(form.elements).filter((el) => {
            const tag = el.tagName
            if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return false
            if (el.disabled) return false
            if (el.type === 'submit') return false
            if (el.tabIndex < 0) return false
            if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false
            return true
          })
          const index = elements.indexOf(e.target)
          if (index > -1 && index + 1 < elements.length) {
            elements[index + 1].focus()
          }
        }
      }
    }
  }

  const clientValidationError = useMemo(() => {
    if (!instrumentConfirmed) return '銘柄を候補から選択して確定してください'

    const sym = normalizeSymbol(market, symbol)
    if (!sym) return '銘柄（symbol）を入力してください'
    if (!/^[0-9A-Z]{1,5}$/.test(sym)) return '銘柄（symbol）は半角英数字5文字以内で入力してください'

    const bp = parseNumberOrNull(buyPrice)
    const sp = parseNumberOrNull(sellPrice)
    const q = parseNumberOrNull(qty)

    if (!buyDate) return '買い日付を入力してください'
    if (!isFullYmd(buyDate)) return '買い日付は YYYYMMDD（例: 20260206）で入力してください'
    if (!isOpen) {
      if (!sellDate) return '売り日付を入力してください'
      if (!isFullYmd(sellDate)) return '売り日付は YYYYMMDD（例: 20260206）で入力してください'
      if (sellDate && buyDate && sellDate < buyDate) return '売り日付は買い日付以降にしてください'
    }

    if (bp === null || bp <= 0) return '買値は 0 より大きい数で入力してください'
    if (!isOpen && (sp === null || sp <= 0)) return '売値は 0 より大きい数で入力してください'
    if (q === null || q <= 0) return '数量は 0 より大きい数で入力してください'

    return null
  }, [instrumentConfirmed, market, symbol, buyDate, sellDate, buyPrice, sellPrice, qty, isOpen])

  const priceCheckParams = useMemo(() => {
    if (clientValidationError) return null
    const sym = normalizeSymbol(market, symbol)
    if (!sym) return null
    return {
      market,
      symbol: sym,
      buyDate,
      buyPrice: Number(buyPrice),
      sellDate: isOpen ? null : sellDate,
      sellPrice: isOpen ? null : Number(sellPrice),
    }
  }, [clientValidationError, market, symbol, buyDate, buyPrice, sellDate, sellPrice, isOpen])

  useEffect(() => {
    if (!priceCheckParams) {
      setPriceCheckStatus('idle')
      setPriceCheckError('')
      setPriceCheckWarning('')
      return
    }

    let cancelled = false
    setPriceCheckStatus('checking')
    setPriceCheckError('')
    setPriceCheckWarning('')

    const timerId = window.setTimeout(async () => {
      const result = await assessPriceSanityAgainstDailyBars(priceCheckParams)
      if (cancelled) return
      if (result?.blockingMessage) {
        setPriceCheckStatus('error')
        setPriceCheckError(result.blockingMessage)
        setPriceCheckWarning('')
        return
      }
      setPriceCheckStatus('ok')
      setPriceCheckError('')
      setPriceCheckWarning(result?.warnings?.[0] || '')
    }, 150)

    return () => {
      cancelled = true
      window.clearTimeout(timerId)
    }
  }, [priceCheckParams])

  const saveDisabledReason = useMemo(() => {
    if (clientValidationError) return clientValidationError
    if (!priceCheckParams) return '価格チェック待ちです'
    if (priceCheckStatus === 'checking') return '価格を確認中です'
    if (priceCheckStatus === 'error') return priceCheckError || '価格を確認してください'
    if (priceCheckStatus !== 'ok') return '価格チェック待ちです'
    return ''
  }, [clientValidationError, priceCheckParams, priceCheckStatus, priceCheckError])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (saveDisabledReason) return

    const sym = normalizeSymbol(market, symbol)
    const bp = Number(buyPrice)
    const sp = Number(sellPrice)
    const q = Number(qty)

    try {
      await api.post('/api/v1/trades', {
        market,
        symbol: sym,
        name: name?.trim() || null,

        notes_buy: notesBuy?.trim() || null,
        notes_sell: notesSell?.trim() || null,
        notes_review: notesReview?.trim() || null,

        rating: rating ? Number(rating) : null,
        tags: tags?.trim() || null,

        chart_image_url: null,

        fills: isOpen
          ? [{ side: 'buy', date: buyDate, price: bp, qty: q, fee: 0 }]
          : [
              { side: 'buy', date: buyDate, price: bp, qty: q, fee: 0 },
              { side: 'sell', date: sellDate, price: sp, qty: q, fee: 0 },
            ],
      })

      showToast('保存しました')
      setTimeout(() => navigate('/trades'), 400)
      return
    } catch (err) {
      setError(err.message || 'エラーが発生しました')
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0 }}>新規トレード作成</h2>
        <Link to="/trades" style={{ textDecoration: 'none' }}>
          <button style={baseButtonStyle}>← 一覧へ</button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <div ref={instrumentWrapRef} style={{ display: 'grid', gap: 8, position: 'relative', marginBottom: 12 }}>
          <label style={{ fontWeight: 700 }}>銘柄</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={instrumentInputRef}
              placeholder="銘柄名 or 銘柄コード"
              value={instrumentQuery}
              readOnly={instrumentConfirmed}
              onFocus={() => {
                loadJpInstrumentsIfNeeded()
                loadUsInstrumentsIfNeeded()
                if (!instrumentConfirmed) setInstrumentOpen(true)
              }}
              onChange={(e) => {
                setInstrumentQuery(e.target.value)
                setInstrumentConfirmed(false)
                setInstrumentOpen(true)
              }}
              onKeyDown={handleInstrumentKeyDown}
              style={{ flex: 1 }}
            />
            {instrumentConfirmed ? (
              <button type="button" onClick={clearConfirmedInstrument} title="銘柄確定を解除" style={baseButtonStyle}>
                ×
              </button>
            ) : null}
          </div>
          {!instrumentConfirmed && instrumentOpen && (instrumentCandidates.length > 0 || jpLoadState === 'loading' || usLoadState === 'loading') ? (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                border: '1px solid #ddd',
                borderRadius: 8,
                background: '#fff',
                zIndex: 20,
                maxHeight: 260,
                overflowY: 'auto',
              }}
            >
              {jpLoadState === 'loading' ? (
                <div style={{ padding: '8px 10px', fontSize: 12, color: '#475467', borderBottom: instrumentCandidates.length ? '1px solid #f2f4f7' : 'none' }}>
                  JP銘柄マスター読込中...
                </div>
              ) : null}
              {jpLoadState !== 'loading' && usLoadState === 'loading' ? (
                <div style={{ padding: '8px 10px', fontSize: 12, color: '#475467', borderBottom: instrumentCandidates.length ? '1px solid #f2f4f7' : 'none' }}>
                  US銘柄マスター読込中...
                </div>
              ) : null}
              {instrumentCandidates.map((c, idx) => (
                <button
                  key={`${c.market}:${c.symbol}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => confirmInstrument(c)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    borderBottom: idx === instrumentCandidates.length - 1 ? 'none' : '1px solid #f2f4f7',
                    background: idx === activeCandidateIndex ? '#f5fbfa' : '#fff',
                    padding: '8px 10px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{c.symbol} / {c.name || '—'}（{c.market}）</div>
                </button>
              ))}
            </div>
          ) : null}
        </div>



        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 700 }}>BUY</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="YYYYMMDD（例: 20260206）"
              value={buyDate}
              onChange={(e) => setBuyDate(normalizeYmd(e.target.value))}
              onBlur={() => setBuyDate((v) => normalizeYmd(v))}
              required
              onKeyDown={handleKeyNav}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() => openDatePicker(buyDatePickerRef)}
              style={{ ...baseButtonStyle, padding: '8px 10px' }}
              title="カレンダーから選択"
            >
              📅
            </button>
            <input
              ref={buyDatePickerRef}
              type="date"
              value={isFullYmd(buyDate) ? buyDate : ''}
              onChange={(e) => setBuyDate(e.target.value)}
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                fontWeight: 700,
                opacity: 1,
                color: '#111',
                pointerEvents: 'none',
              }}
            >
              {market === 'JP' ? '¥' : '$'}
            </div>
            <input
              type="text"
              inputMode="decimal"
              placeholder="買値"
              value={buyPrice}
              onChange={(e) => setBuyPrice(normalizeDecimalInput(e.target.value))}
              required
              onKeyDown={handleKeyNav}
              style={{ width: '100%', paddingLeft: 36 }}
            />
          </div>
          <input
            type="text"
            inputMode="numeric"
            placeholder="数量（SELLにも自動コピー）"
            value={qty}
            onChange={(e) => setQty(normalizeIntInput(e.target.value))}
            required
            onKeyDown={handleKeyNav}
          />
        </div>


        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontWeight: 700 }}>SELL</div>
            <div style={{ opacity: 0.45, fontWeight: 700 }}>/</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <input
                id="is-open-checkbox"
                type="checkbox"
                checked={isOpen}
                onChange={(e) => setIsOpen(e.target.checked)}
                onKeyDown={handleKeyNav}
                style={{ margin: 0, width: 16, height: 16, flex: '0 0 auto' }}
              />
              <label htmlFor="is-open-checkbox" style={{ fontWeight: 700, fontSize: 13, lineHeight: '16px', cursor: 'pointer' }}>
                保有中（未売却）
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="YYYYMMDD（例: 20260206）"
              value={sellDate}
              onChange={(e) => setSellDate(normalizeYmd(e.target.value))}
              onBlur={() => setSellDate((v) => normalizeYmd(v))}
              required={!isOpen}
              disabled={isOpen}
              onKeyDown={handleKeyNav}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() => openDatePicker(sellDatePickerRef)}
              disabled={isOpen}
              style={{
                ...baseButtonStyle,
                padding: '8px 10px',
                cursor: isOpen ? 'not-allowed' : 'pointer',
                opacity: isOpen ? 0.5 : 1,
              }}
              title={isOpen ? '未売却のため選択できません' : 'カレンダーから選択'}
            >
              📅
            </button>
            <input
              ref={sellDatePickerRef}
              type="date"
              value={isFullYmd(sellDate) ? sellDate : ''}
              onChange={(e) => setSellDate(e.target.value)}
              disabled={isOpen}
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                fontWeight: 700,
                opacity: 1,
                color: '#111',
                pointerEvents: 'none',
              }}
            >
              {market === 'JP' ? '¥' : '$'}
            </div>
            <input
              type="text"
              inputMode="decimal"
              placeholder="売値"
              value={sellPrice}
              onChange={(e) => setSellPrice(normalizeDecimalInput(e.target.value))}
              required={!isOpen}
              disabled={isOpen}
              onKeyDown={handleKeyNav}
              style={{ width: '100%', paddingLeft: 36 }}
            />
          </div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {isOpen ? (
              <>未売却のため SELL は入力しません</>
            ) : (
              <>数量: <b>{qty || '—'}</b>（BUYと同じ数量で保存します）</>
            )}
          </div>
        </div>

        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 700 }}>思考ログ</div>
          {isOpen ? (
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              保有中のため、売却理由・考察・自己評価は入力しません
            </div>
          ) : null}

          <textarea
            placeholder="購入理由"
            value={notesBuy}
            onChange={(e) => setNotesBuy(e.target.value)}
            rows={3}
            onKeyDown={handleKeyNav}
          />

          <textarea
            placeholder="売却理由"
            value={notesSell}
            onChange={(e) => setNotesSell(e.target.value)}
            rows={3}
            disabled={isOpen}
            onKeyDown={handleKeyNav}
          />

          <textarea
            placeholder="考察"
            value={notesReview}
            onChange={(e) => setNotesReview(e.target.value)}
            rows={3}
            disabled={isOpen}
            onKeyDown={handleKeyNav}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontWeight: 700 }}>自己評価</label>
          {isOpen ? <span style={{ fontSize: 12, opacity: 0.75 }}>保有中は入力しません</span> : null}
          <select value={rating} onChange={(e) => setRating(e.target.value)} onKeyDown={handleKeyNav} disabled={isOpen}>
            <option value={0}>—</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
        </div>

        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 700 }}>タグ</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TAG_OPTIONS.map((t) => {
              const active = hasTagCSV(tags, t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTags((prev) => toggleTagCSV(prev, t))}
                  style={{
                    border: active ? '1px solid #2a9d8f' : '1px solid #ddd',
                    borderRadius: 999,
                    padding: '6px 10px',
                    background: active ? '#e8f7f4' : '#fff',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: '#111',
                    fontWeight: 600,
                    lineHeight: 1.2,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  title={active ? 'クリックでタグを外す' : t === '未設定' ? 'クリックで未設定にする' : 'クリックでタグに追加'}
                >
                  {active ? '✓' : '+'} {t}
                </button>
              )
            })}
          </div>

          <div style={{ fontSize: 12, opacity: 0.75 }}>
            現在: <b>{(tags || '').trim() || '—'}</b>
          </div>
        </div>

        <button
          type="submit"
          disabled={Boolean(saveDisabledReason)}
          title={saveDisabledReason || ''}
          style={{ ...primaryButtonStyle, opacity: saveDisabledReason ? 0.55 : 1, cursor: saveDisabledReason ? 'not-allowed' : 'pointer' }}
        >
          保存
        </button>

        {saveDisabledReason ? (
          <p style={{ margin: 0, color: '#b42318', fontSize: 12 }}>{saveDisabledReason}</p>
        ) : null}
        {!saveDisabledReason && priceCheckWarning ? (
          <p style={{ margin: 0, color: '#667085', fontSize: 12 }}>注意: {priceCheckWarning}</p>
        ) : null}

        {error ? <p style={{ margin: 0, color: '#b42318', fontSize: 12 }}>{error}</p> : null}
      </form>
      {toast ? (
        <div
          role="status"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            background: '#111',
            color: '#fff',
            padding: '10px 12px',
            borderRadius: 10,
            fontSize: 13,
            boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
            zIndex: 9999,
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  )
}
