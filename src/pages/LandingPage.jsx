import { useEffect } from 'react'
import { Link } from 'react-router-dom'

const differentiationProps = [
  {
    title: '記録で終わらない',
    body: '一覧で状況を把握し、未レビューを次の振り返りに回しやすくします。',
  },
  {
    title: '理由まで残せる',
    body: '売買理由・考察・自己評価まで同じ文脈で残し、後から読み返せます。',
  },
  {
    title: '振り返りまで1つで完結',
    body: '新規記録、詳細チャート確認、レビュー更新を分断せずにつなげます。',
  },
]

const cycleSteps = [
  {
    key: 'PLAN',
    title: 'PLAN',
    body: '過去の記録から、次の判断軸を持つ',
    image: '/lp/cycle-plan-trades-overview.png',
    position: 'center top',
    icon: 'P',
  },
  {
    key: 'DO',
    title: 'DO',
    body: '理由とともに売買を記録する',
    image: '/lp/cycle-do-new-trade.png',
    position: 'center 24%',
    icon: 'D',
  },
  {
    key: 'CHECK',
    title: 'CHECK',
    body: '結果だけでなく、判断の質まで振り返る',
    image: '/lp/cycle-check-detail-chart-log.png',
    position: 'center 45%',
    icon: 'C',
  },
  {
    key: 'ACT',
    title: 'ACT',
    body: '経験を蓄積し、次の一手に活かす',
    image: '/lp/cycle-act-trade-cards.png',
    position: 'center 34%',
    icon: 'A',
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
            <div className="lp-kicker">Review First Trading Journal</div>
            <h2>投資の記録を、あとで振り返れる形に。</h2>
            <p>
              TradeTrace は投資の売買記録と根拠を残し、チャートとあわせて振り返りやすくするためのサービスです。
              個人投資家が自分の判断をあとから整理し、投資の再現性を高めていくことを目指しています。
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
                <span>レビューを次の判断へ接続</span>
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
            <p className="lp-note">特定の銘柄や売買を推奨するサービスではありません。</p>
          </div>
          <div className="lp-hero-visual">
            <div className="lp-hero-stack">
              <figure className="lp-hero-shot lp-hero-shot-main">
                <img src="/lp/cycle-plan-trades-overview.png" alt="投資記録一覧の画面" loading="eager" />
                <figcaption>一覧とサマリーで全体を把握</figcaption>
              </figure>
              <figure className="lp-hero-shot lp-hero-shot-a">
                <img src="/lp/cycle-do-new-trade.png" alt="新規トレード作成の画面" loading="lazy" />
                <figcaption>新規記録</figcaption>
              </figure>
              <figure className="lp-hero-shot lp-hero-shot-b">
                <img src="/lp/cycle-check-detail-chart-log.png" alt="トレード詳細の画面" loading="lazy" />
                <figcaption>詳細レビュー</figcaption>
              </figure>
            </div>
            <div className="lp-float-chip lp-float-chip-a">記録</div>
            <div className="lp-float-chip lp-float-chip-b">振り返り</div>
            <div className="lp-float-chip lp-float-chip-c">レビュー</div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-diff-section lp-reveal">
        <h3>TradeTraceの違い</h3>
        <div className="lp-diff-grid">
          {differentiationProps.map((item, idx) => (
            <article key={item.title} className="lp-diff-card">
              <span className="lp-diff-badge">{`0${idx + 1}`}</span>
              <h4>{item.title}</h4>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="lp-cycle" className="lp-section lp-cycle-section lp-reveal">
        <h3>記録から改善につながる、4つの循環</h3>
        <p className="lp-cycle-lead">
          TradeTrace は「記録して終わり」ではなく、振り返りを次の判断へつなげることを重視しています。
        </p>
        <div className="lp-cycle-flow" aria-hidden>
          {cycleSteps.map((step, idx) => (
            <div key={step.key} className="lp-cycle-flow-item">
              <span>{step.key}</span>
              <i>{idx < cycleSteps.length - 1 ? '→' : '↺'}</i>
            </div>
          ))}
        </div>
        <div className="lp-cycle-grid" aria-label="TradeTrace 改善サイクル">
          {cycleSteps.map((step, idx) => (
            <article key={step.key} className="lp-cycle-card">
              <div className="lp-cycle-head">
                <span className={`lp-cycle-icon lp-cycle-icon-${step.key.toLowerCase()}`}>{step.icon}</span>
                <div className="lp-cycle-head-text">
                  <span className="lp-cycle-index">{`STEP ${idx + 1}`}</span>
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
              <span className="lp-cycle-arrow" aria-hidden>
                {idx < cycleSteps.length - 1 ? '→' : '↺'}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section lp-early-note lp-reveal">
        <h3>公開初期として改善を続けています</h3>
        <p>
          TradeTrace は公開初期のため、使いやすさと導線を継続的に改善しています。ご意見は X DM
          で受け付けています。正式なお問い合わせはメールまたはフォームをご案内します。
        </p>
      </section>

      <section className="lp-disclaimer lp-reveal" aria-label="ご利用にあたって">
        <h3>ご利用にあたって</h3>
        <p>
          TradeTrace は投資の記録と振り返りを支援するサービスです。特定の銘柄や売買を推奨するものではありません。
        </p>
      </section>

      <section className="lp-section lp-final-cta lp-reveal">
        <span className="lp-final-kicker">Ready to Start</span>
        <h3>まずは、記録を残すところから。</h3>
        <p>投資の記録とレビューを続けやすくしたい方は、TradeTrace をご確認ください。</p>
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
