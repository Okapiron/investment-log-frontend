import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'

import EpisodeReviewNotes from '../components/EpisodeReviewNotes'
import EpisodeReviewSidebar from '../components/EpisodeReviewSidebar'
import TradeReviewCharts from '../components/TradeReviewCharts'
import { formatJPY } from '../lib/api'
import { getEpisodeCharts } from '../lib/chartsApi'
import {
  completeEpisodeReview,
  getEpisode,
  patchDecisionPointReview,
  patchEpisodeReview,
} from '../lib/v2EpisodesApi'

const AUTOSAVE_DELAY_MS = 800
const EPISODE_REVIEW_FIELDS = [
  'strategy_timeframe',
  'entry_pattern',
  'entry_pattern_other',
  'exit_reason',
  'exit_reason_other',
  'learning_note',
  'next_action_note',
]
const DECISION_REVIEW_FIELDS = ['entry_evaluation', 'exit_evaluation', 'note']

function draftKey(episodeId) {
  return `tradetrace:v2:episode-draft:${episodeId}`
}

function readDraft(episodeId) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(episodeId)) || 'null')
  } catch {
    return null
  }
}

function reviewPayload(review, version) {
  const payload = { version }
  EPISODE_REVIEW_FIELDS.forEach((key) => {
    payload[key] = review?.[key] ?? null
  })
  return payload
}

function decisionPayload(review, version) {
  const payload = { version }
  DECISION_REVIEW_FIELDS.forEach((key) => {
    payload[key] = review?.[key] ?? null
  })
  return payload
}

function episodeTitle(episode) {
  return [episode?.symbol, episode?.name].filter(Boolean).join(' ') || 'Episode'
}

function formatDate(value) {
  if (!value) return '-'
  return String(value).slice(0, 10).replaceAll('-', '/')
}

function formatProfit(episode) {
  if (episode?.status === 'open') return `保有 ${Number(episode.open_quantity || 0).toLocaleString('ja-JP')}株`
  if (episode?.realized_profit_jpy == null) return '損益 -'
  const formatted = formatJPY(episode.realized_profit_jpy)
  return Number(episode.realized_profit_jpy) > 0 ? `+${formatted}` : formatted
}

function missingReviewItems(episode, review, decisionReviews) {
  const missing = []
  if (!String(review?.strategy_timeframe || '').trim()) missing.push('主戦略足')
  if (!String(review?.entry_pattern || '').trim()) missing.push('エントリーパターン')
  if (review?.entry_pattern === 'other' && !String(review?.entry_pattern_other || '').trim()) missing.push('その他パターン')
  if (episode?.status === 'closed') {
    if (!String(review?.exit_reason || '').trim()) missing.push('決済理由')
    if (review?.exit_reason === 'other' && !String(review?.exit_reason_other || '').trim()) missing.push('その他決済理由')
  }
  if (!String(review?.learning_note || '').trim()) missing.push('学び')
  if (!String(review?.next_action_note || '').trim()) missing.push('次回どうするか')
  const points = episode?.decision_points || []
  if (points.some((point) => point.side === 'buy' && !String(decisionReviews?.[point.id]?.entry_evaluation || '').trim())) {
    missing.push('各買付の評価')
  }
  if (episode?.status === 'closed' && points.some(
    (point) => point.side === 'sell' && !String(decisionReviews?.[point.id]?.exit_evaluation || '').trim(),
  )) {
    missing.push('各売却の評価')
  }
  return missing
}

export default function EpisodeReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mainTimeframe, setMainTimeframe] = useState('daily')
  const [indicatorMode, setIndicatorMode] = useState('none')
  const [selectedDecisionPointId, setSelectedDecisionPointId] = useState(null)
  const [review, setReview] = useState({})
  const [decisionReviews, setDecisionReviews] = useState({})
  const [saveStatus, setSaveStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const hydratedIdRef = useRef(null)
  const reviewRef = useRef({})
  const decisionReviewsRef = useRef({})
  const episodeVersionRef = useRef(0)
  const decisionVersionsRef = useRef({})
  const episodeDirtyRef = useRef(false)
  const decisionDirtyRef = useRef(new Set())
  const episodeTimerRef = useRef(null)
  const decisionTimersRef = useRef(new Map())
  const saveChainRef = useRef(Promise.resolve())

  const episodeQuery = useQuery({
    queryKey: ['v2-episode', id],
    queryFn: () => getEpisode(id),
    enabled: Boolean(id),
    retry: 1,
  })
  const episode = episodeQuery.data

  const chartsQuery = useQuery({
    queryKey: ['v2-episode-charts', episode?.market, episode?.symbol],
    queryFn: () => getEpisodeCharts({ market: episode?.market, symbol: episode?.symbol }),
    enabled: Boolean(episode?.market && episode?.symbol),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  function persistDraft() {
    if (!id) return
    try {
      const pendingDecisionIds = [...decisionDirtyRef.current]
      if (!episodeDirtyRef.current && pendingDecisionIds.length === 0) {
        localStorage.removeItem(draftKey(id))
        return
      }
      localStorage.setItem(draftKey(id), JSON.stringify({
        episodeVersion: episodeVersionRef.current,
        decisionVersions: decisionVersionsRef.current,
        review: reviewRef.current,
        decisionReviews: decisionReviewsRef.current,
        pendingEpisode: episodeDirtyRef.current,
        pendingDecisionIds,
        savedAt: new Date().toISOString(),
      }))
    } catch {
      // Server autosave remains the source of truth if browser storage is unavailable.
    }
  }

  function queueTask(task) {
    const next = saveChainRef.current.catch(() => undefined).then(task)
    saveChainRef.current = next
    return next
  }

  function queueEpisodeSave() {
    if (!episodeDirtyRef.current) return saveChainRef.current
    episodeDirtyRef.current = false
    const snapshot = { ...reviewRef.current }
    return queueTask(async () => {
      setSaveStatus('saving')
      try {
        const saved = await patchEpisodeReview(id, reviewPayload(snapshot, episodeVersionRef.current))
        episodeVersionRef.current = Number(saved.version || episodeVersionRef.current)
        setReview((current) => ({ ...current, version: saved.version, review_status: saved.review_status }))
        setSaveStatus(episodeDirtyRef.current || decisionDirtyRef.current.size ? 'saving' : 'saved')
        persistDraft()
        if (episodeDirtyRef.current) scheduleEpisodeSave(0)
        return saved
      } catch (nextError) {
        episodeDirtyRef.current = true
        setSaveStatus('error')
        setError(`自動保存に失敗しました: ${String(nextError?.message || nextError)}`)
        persistDraft()
        throw nextError
      }
    })
  }

  function scheduleEpisodeSave(delay = AUTOSAVE_DELAY_MS) {
    if (episodeTimerRef.current) clearTimeout(episodeTimerRef.current)
    episodeTimerRef.current = setTimeout(() => {
      episodeTimerRef.current = null
      queueEpisodeSave()
    }, delay)
  }

  function queueDecisionSave(pointId) {
    if (!decisionDirtyRef.current.has(pointId)) return saveChainRef.current
    decisionDirtyRef.current.delete(pointId)
    const snapshot = { ...(decisionReviewsRef.current[pointId] || {}) }
    return queueTask(async () => {
      setSaveStatus('saving')
      try {
        const saved = await patchDecisionPointReview(
          pointId,
          decisionPayload(snapshot, Number(decisionVersionsRef.current[pointId] || 0)),
        )
        decisionVersionsRef.current = { ...decisionVersionsRef.current, [pointId]: Number(saved.version || 0) }
        setDecisionReviews((current) => ({
          ...current,
          [pointId]: { ...current[pointId], version: saved.version },
        }))
        setSaveStatus(episodeDirtyRef.current || decisionDirtyRef.current.size ? 'saving' : 'saved')
        persistDraft()
        if (decisionDirtyRef.current.has(pointId)) scheduleDecisionSave(pointId, 0)
        return saved
      } catch (nextError) {
        decisionDirtyRef.current.add(pointId)
        setSaveStatus('error')
        setError(`自動保存に失敗しました: ${String(nextError?.message || nextError)}`)
        persistDraft()
        throw nextError
      }
    })
  }

  function scheduleDecisionSave(pointId, delay = AUTOSAVE_DELAY_MS) {
    const existing = decisionTimersRef.current.get(pointId)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      decisionTimersRef.current.delete(pointId)
      queueDecisionSave(pointId)
    }, delay)
    decisionTimersRef.current.set(pointId, timer)
  }

  useEffect(() => {
    if (!episode || hydratedIdRef.current === episode.id) return
    hydratedIdRef.current = episode.id
    const serverReview = { ...(episode.review || {}) }
    const serverDecisionReviews = Object.fromEntries(
      (episode.decision_points || []).map((point) => [point.id, { ...(point.review || {}) }]),
    )
    episodeVersionRef.current = Number(serverReview.version || 0)
    decisionVersionsRef.current = Object.fromEntries(
      (episode.decision_points || []).map((point) => [point.id, Number(point.review?.version || 0)]),
    )

    const draft = readDraft(episode.id)
    let nextReview = serverReview
    let nextDecisionReviews = serverDecisionReviews
    let restored = false
    if (draft && Number(draft.episodeVersion) === episodeVersionRef.current) {
      if (draft.pendingEpisode) {
        nextReview = { ...serverReview, ...(draft.review || {}) }
        episodeDirtyRef.current = true
        restored = true
      }
      nextDecisionReviews = { ...serverDecisionReviews }
      Object.entries(draft.decisionReviews || {}).forEach(([pointId, pointReview]) => {
        const pending = (draft.pendingDecisionIds || []).map(String).includes(String(pointId))
        if (pending && Number(draft.decisionVersions?.[pointId] || 0) === Number(decisionVersionsRef.current[pointId] || 0)) {
          nextDecisionReviews[pointId] = { ...serverDecisionReviews[pointId], ...pointReview }
          decisionDirtyRef.current.add(Number(pointId))
          restored = true
        }
      })
    }

    reviewRef.current = nextReview
    decisionReviewsRef.current = nextDecisionReviews
    setReview(nextReview)
    setDecisionReviews(nextDecisionReviews)
    const firstPending = (episode.decision_points || []).find((point) => {
      const pointReview = nextDecisionReviews[point.id] || {}
      return point.side === 'buy' ? !pointReview.entry_evaluation : !pointReview.exit_evaluation
    })
    setSelectedDecisionPointId(firstPending?.id || episode.decision_points?.[0]?.id || null)
    setMainTimeframe(nextReview.strategy_timeframe || 'daily')
    setSaveStatus('idle')
    setError('')
    setMessage(restored ? 'このブラウザに残っていた未送信の下書きを復元しました。' : '')
    if (episodeDirtyRef.current) scheduleEpisodeSave(0)
    decisionDirtyRef.current.forEach((pointId) => scheduleDecisionSave(pointId, 0))
  }, [episode])

  useEffect(() => () => {
    if (episodeTimerRef.current) clearTimeout(episodeTimerRef.current)
    decisionTimersRef.current.forEach((timer) => clearTimeout(timer))
  }, [])

  function handleEpisodeReviewChange(key, value) {
    const next = { ...reviewRef.current, [key]: value }
    reviewRef.current = next
    setReview(next)
    episodeDirtyRef.current = true
    setSaveStatus('idle')
    setError('')
    persistDraft()
    scheduleEpisodeSave()
  }

  function handleDecisionReviewChange(pointId, key, value) {
    const nextPoint = { ...(decisionReviewsRef.current[pointId] || {}), [key]: value }
    const next = { ...decisionReviewsRef.current, [pointId]: nextPoint }
    decisionReviewsRef.current = next
    setDecisionReviews(next)
    decisionDirtyRef.current.add(pointId)
    setSaveStatus('idle')
    setError('')
    persistDraft()
    scheduleDecisionSave(pointId)
  }

  async function flushAutosave() {
    if (episodeTimerRef.current) {
      clearTimeout(episodeTimerRef.current)
      episodeTimerRef.current = null
    }
    decisionTimersRef.current.forEach((timer) => clearTimeout(timer))
    decisionTimersRef.current.clear()
    if (episodeDirtyRef.current) queueEpisodeSave()
    ;[...decisionDirtyRef.current].forEach((pointId) => queueDecisionSave(pointId))
    await saveChainRef.current
  }

  async function handleComplete() {
    try {
      setError('')
      setMessage('')
      await flushAutosave()
      const result = await completeEpisodeReview(id, episodeVersionRef.current)
      episodeVersionRef.current = Number(result.version || episodeVersionRef.current)
      localStorage.removeItem(draftKey(id))
      await queryClient.invalidateQueries({ queryKey: ['v2-review-queue'] })
      setSaveStatus('saved')
      setMessage('レビューを完了しました。')
      if (result.next_review_episode_id) {
        navigate(`/episodes/${result.next_review_episode_id}`)
      } else {
        navigate('/review')
      }
    } catch (nextError) {
      setSaveStatus('error')
      setError(String(nextError?.message || nextError || 'レビュー完了に失敗しました。'))
    }
  }

  const completionMissingItems = useMemo(
    () => missingReviewItems(episode, review, decisionReviews),
    [episode, review, decisionReviews],
  )

  if (episodeQuery.isLoading) return <div style={{ padding: 16 }}>Episodeを読み込み中...</div>
  if (episodeQuery.error) {
    return <div style={{ padding: 16, color: '#b42318' }}>Episodeを取得できませんでした: {String(episodeQuery.error?.message || episodeQuery.error)}</div>
  }
  if (!episode) return <div style={{ padding: 16 }}>Episodeがありません。</div>

  return (
    <main className="v2-episode-page">
      <header className="v2-episode-header">
        <div style={{ minWidth: 0 }}>
          <div className="v2-episode-kicker">EPISODE #{episode.id}</div>
          <h1>{episodeTitle(episode)}</h1>
          <div className="v2-episode-meta">
            <span>{formatDate(episode.started_at)} → {episode.ended_at ? formatDate(episode.ended_at) : '保有中'}</span>
            <span>{episode.decision_count}判断</span>
            {episode.holding_days == null ? null : <span>{episode.holding_days}日</span>}
            <strong className={Number(episode.realized_profit_jpy || 0) < 0 ? 'is-loss' : 'is-gain'}>{formatProfit(episode)}</strong>
          </div>
        </div>
        <Link to="/review" className="v2-back-link">キューへ戻る</Link>
      </header>

      {message ? <div className="v2-page-message is-success">{message}</div> : null}
      {error ? <div className="v2-page-message is-error">{error}</div> : null}
      {chartsQuery.data?.cache?.is_stale ? (
        <div className="v2-page-message is-warning">
          保存済みチャートを表示しています。{chartsQuery.data.cache.refresh_error ? ` 更新失敗: ${chartsQuery.data.cache.refresh_error}` : ''}
        </div>
      ) : null}
      {chartsQuery.error ? (
        <div className="v2-page-message is-warning">チャートを取得できませんでした: {String(chartsQuery.error?.message || chartsQuery.error)}</div>
      ) : null}

      <div className="v2-episode-cockpit">
        <TradeReviewCharts
          seriesByTimeframe={chartsQuery.data || {}}
          decisionPoints={episode.decision_points || []}
          selectedDecisionPointId={selectedDecisionPointId}
          onDecisionPointSelect={setSelectedDecisionPointId}
          mainTimeframe={mainTimeframe}
          indicatorMode={indicatorMode}
          onMainTimeframeChange={setMainTimeframe}
          onIndicatorModeChange={setIndicatorMode}
        />
        <EpisodeReviewSidebar
          episode={episode}
          review={review}
          decisionReviews={decisionReviews}
          selectedDecisionPointId={selectedDecisionPointId}
          onSelectDecisionPoint={setSelectedDecisionPointId}
          onEpisodeReviewChange={handleEpisodeReviewChange}
          onDecisionReviewChange={handleDecisionReviewChange}
          onComplete={handleComplete}
          saveStatus={saveStatus}
          completionMissingItems={completionMissingItems}
        />
      </div>

      <EpisodeReviewNotes
        review={review}
        aiDraft={episode.review?.ai_draft}
        onChange={handleEpisodeReviewChange}
      />
    </main>
  )
}
