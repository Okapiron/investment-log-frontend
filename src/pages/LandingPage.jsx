import { useEffect } from 'react'
import { Link } from 'react-router-dom'

const differentiationProps = [
  {
    label: 'RECORD',
    title: '記録を資産に',
    body: '売買データだけでなく、判断の理由まで残してあとから見返せます。',
    icon: '/lp/value-record.svg',
  },
  {
    label: 'REVIEW',
    title: '振り返りを習慣に',
    body: 'チャートと記録を並べて、結果だけでなく判断の質まで振り返れます。',
    icon: '/lp/value-review.svg',
  },
  {
    label: 'IMPROVE',
    title: '改善を次の一手に',
    body: '記録とレビューを積み重ねながら、次の投資判断に活かしていけます。',
    icon: '/lp/value-improve.svg',
  },
]

const cycleSteps = [
  {
    number: 1,
    area: 'plan',
    key: 'PLAN',
    title: 'PLAN',
    body: '過去の記録から、次の判断軸を持つ',
    image: '/lp/cycle-plan-trades-overview.png',
    position: 'center top',
  },
  {
    number: 2,
    area: 'do',
    key: 'DO',
    title: 'DO',
    body: '理由とともに売買を記録する',
    image: '/lp/cycle-do-new-trade.png',
    position: 'center 24%',
  },
  {
    number: 3,
    area: 'check',
    key: 'CHECK',
    title: 'CHECK',
    body: '結果だけでなく、判断の質まで振り返る',
    image: '/lp/cycle-check-detail-chart-log.png',
    position: 'center 45%',
  },
  {
    number: 4,
    area: 'act',
    key: 'ACT',
    title: 'ACT',
    body: '経験を蓄積し、次の一手に活かす',
    image: '/lp/cycle-act-trade-cards.png',
    position: 'center 34%',
  },
]

function trackCtaClick(name) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const detail = {
    event: 'tradetrace_landing_cta_click',
    cta_name: name,
    page: 'landing',
    path: window.location.pathname,
    utm_source: String(params.get('utm_source') || ''),
    utm_medium: String(params.get('utm_medium') || ''),
    utm_campaign: String(params.get('utm_campaign') || ''),
    timestamp_ms: Date.now(),
  }
  window.dispatchEvent(new CustomEvent('tradetrace:cta_click', { detail }))
  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(detail)
  }
}

export default function LandingPage() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const targets = Array.from(document.querySelectorAll('.lp-reveal'))
    if (prefersReducedMotion) {
      targets.forEach((node) => node.classList.add('is-visible'))
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    )

    targets.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="lp-page">
      <section className="lp-hero lp-reveal is-visible">
        <div className="lp-orb lp-orb-left" aria-hidden />
        <div className="lp-orb lp-orb-right" aria-hidden />
        <div className="lp-hero-grid">
          <div className="lp-hero-copy">
            <h2>投資記録を振り返りやすく</h2>
            <p>
              TradeTrace は投資の売買記録と根拠を残し、チャートとあわせて振り返りやすくするためのサービスです。
              個人投資家が自分の判断をあとから整理し、投資成績の改善につなげていけることを目指しています。
            </p>
            <div className="lp-hero-signals">
              <div className="lp-hero-signal">
                <strong>記録</strong>
                <span>売買と理由を一緒に残す</span>
              </div>
              <div className="lp-hero-signal">
                <strong>振り返り</strong>
                <span>チャートとメモを並べて確認</span>
              </div>
              <div className="lp-hero-signal">
                <strong>改善</strong>
                <span>自己分析を次の投資判断へ活かす</span>
              </div>
            </div>
            <div className="lp-hero-actions">
              <Link
                to="/auth?mode=signup"
                className="lp-btn lp-btn-primary"
                data-cta="hero-signup"
                onClick={() => trackCtaClick('hero-signup')}
              >
                新規登録
              </Link>
              <a href="#lp-cycle" className="lp-btn lp-btn-secondary" data-cta="hero-more">
                詳しく見る
              </a>
            </div>
          </div>
          <div className="lp-hero-visual">
            <div className="lp-hero-stack">
              <figure className="lp-hero-shot lp-hero-shot-main">
                <img src="/lp/cycle-plan-trades-overview.png" alt="投資記録一覧の画面" loading="eager" />
              </figure>
              <figure className="lp-hero-shot lp-hero-shot-a">
                <img src="/lp/cycle-check-detail-chart-log.png" alt="トレード詳細の画面" loading="lazy" />
              </figure>
              <figure className="lp-hero-shot lp-hero-shot-b">
                <img src="/lp/cycle-act-trade-cards.png" alt="トレード一覧カードの画面" loading="lazy" />
              </figure>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-diff-section lp-reveal">
        <h3>TradeTraceの生み出す価値</h3>
        <div className="lp-diff-grid">
          {differentiationProps.map((item) => (
            <article
              key={item.title}
              className="lp-diff-card"
              style={{ '--lp-diff-watermark': `url(${item.icon})` }}
            >
              <div className="lp-diff-meta">
                <span className="lp-diff-icon-wrap" aria-hidden>
                  <img src={item.icon} alt="" className="lp-diff-icon" loading="lazy" />
                </span>
                <span className="lp-diff-label">{item.label}</span>
              </div>
              <h4>{item.title}</h4>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="lp-cycle" className="lp-section lp-cycle-section lp-reveal">
        <h3>投資成績の改善へ 4STEPサイクル</h3>
        <p className="lp-cycle-lead">
          TradeTrace は「記録して終わり」ではなく、振り返りを次の判断へつなげることを重視しています。
        </p>
        <div className="lp-cycle-layout">
          <div className="lp-cycle-connectors" aria-hidden>
            <img src="/lp/cycle-arrow.svg" alt="" className="lp-cycle-connector-icon lp-cycle-connector-top" />
            <img src="/lp/cycle-arrow.svg" alt="" className="lp-cycle-connector-icon lp-cycle-connector-right" />
            <img src="/lp/cycle-arrow.svg" alt="" className="lp-cycle-connector-icon lp-cycle-connector-bottom" />
            <img src="/lp/cycle-arrow.svg" alt="" className="lp-cycle-connector-icon lp-cycle-connector-left" />
          </div>
          <div className="lp-cycle-grid" aria-label="TradeTrace 改善サイクル">
            {cycleSteps.map((step, idx) => (
              <article key={step.key} className={`lp-cycle-card lp-cycle-card-${step.area}`}>
                <div className="lp-cycle-head">
                  <span className="lp-cycle-step">{`STEP ${step.number}`}</span>
                  <div className="lp-cycle-head-text">
                    <h4>{step.title}</h4>
                  </div>
                </div>
                <div
                  className="lp-cycle-shot"
                  role="img"
                  aria-label={`${step.title} 画面イメージ`}
                  style={{ backgroundImage: `url(${step.image})`, backgroundPosition: step.position }}
                />
                <p>{step.body}</p>
                {idx < cycleSteps.length - 1 ? (
                  <span className="lp-cycle-mobile-arrow" aria-hidden>
                    ↓
                  </span>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-early-note lp-reveal">
        <h3>貴重なレビューをお待ちしております</h3>
        <p className="lp-early-note-body">
          <span>TradeTrace は公開初期のため、使いやすさと導線を継続的に改善しています。</span>
          <span>ご意見は X DM で受け付けています。</span>
          <span>正式なお問い合わせはメールまたはフォームをご案内します。</span>
        </p>
        <p className="lp-early-note-disclaimer">
          TradeTrace は投資の記録と振り返りを支援するサービスです。特定の銘柄や売買を推奨するものではありません。
        </p>
      </section>

      <section className="lp-section lp-final-cta lp-reveal">
        <span className="lp-final-kicker">Ready to Start</span>
        <h3>まずは、やってみよう。</h3>
        <p>トレード記録をきちんとつけるならTradeTrace をお試しください。</p>
        <div className="lp-final-actions">
          <Link
            to="/auth?mode=signup"
            className="lp-btn lp-btn-primary"
            data-cta="final-signup"
            onClick={() => trackCtaClick('final-signup')}
          >
            新規登録
          </Link>
          <Link
            to="/auth"
            className="lp-btn lp-btn-secondary"
            data-cta="final-login"
            onClick={() => trackCtaClick('final-login')}
          >
            ログイン
          </Link>
        </div>
      </section>
    </div>
  )
}
