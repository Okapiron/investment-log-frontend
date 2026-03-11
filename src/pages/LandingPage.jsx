import { useEffect } from 'react'
import { Link } from 'react-router-dom'

const problemItems = [
  '売買した理由を、あとでうまく思い出せない',
  '数字は残っても、判断の背景までは振り返りにくい',
  '勝ち負けだけでは、次に活かせる学びが残りにくい',
]

const solutionSteps = [
  '売買を記録する',
  'チャートとあわせて見返す',
  '次の投資の再現性につなげる',
]

const valueProps = [
  {
    title: '記録を残す',
    body: '売買内容やメモを、あとで見返せる形で整理しやすくします。',
  },
  {
    title: 'チャートで振り返る',
    body: '履歴だけでは見えにくい場面も、チャートと並べて整理しやすくします。',
  },
  {
    title: 'レビュー習慣を作る',
    body: '単発で終わらず、振り返りを続けやすい流れを目指しています。',
  },
]

const audienceItems = [
  '初心者〜中級の個人投資家',
  '売買の記録をメモだけで終わらせたくない人',
  '自分の判断をあとで振り返りたい人',
  'レビュー習慣を少しずつ作りたい人',
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
            <div className="lp-hero-actions">
              <Link
                to="/auth?mode=signup"
                className="lp-btn lp-btn-primary"
                data-cta="hero-signup"
                onClick={() => trackCtaClick('hero-signup')}
              >
                新規登録
              </Link>
              <a href="#lp-problem" className="lp-btn lp-btn-secondary" data-cta="hero-more">
                詳しく見る
              </a>
            </div>
            <p className="lp-note">
              特定の銘柄や売買を推奨するサービスではありません。
            </p>
          </div>
          <div className="lp-hero-visual">
            <div className="lp-app-mock">
              <div className="lp-mock-topbar">
                <span />
                <span />
                <span />
              </div>
              <div className="lp-mock-content">
                <div className="lp-mock-card">
                  <div className="lp-mock-title">Trades</div>
                  <div className="lp-mock-row">
                    <strong>8306</strong>
                    <span>未レビュー</span>
                  </div>
                  <div className="lp-mock-row">
                    <strong>AAPL</strong>
                    <span>レビュー済</span>
                  </div>
                  <div className="lp-mock-row">
                    <strong>9432</strong>
                    <span>保有中</span>
                  </div>
                </div>
                <div className="lp-mock-grid">
                  <div className="lp-mock-pill">売買理由</div>
                  <div className="lp-mock-pill">考察</div>
                  <div className="lp-mock-pill">自己評価</div>
                </div>
                <div className="lp-mock-chart" />
              </div>
            </div>
            <div className="lp-float-chip lp-float-chip-a">記録</div>
            <div className="lp-float-chip lp-float-chip-b">振り返り</div>
            <div className="lp-float-chip lp-float-chip-c">レビュー</div>
          </div>
        </div>
      </section>

      <section id="lp-problem" className="lp-section lp-reveal">
        <h3>こんな状態になりやすくありませんか</h3>
        <div className="lp-card-grid">
          {problemItems.map((item) => (
            <article key={item} className="lp-card lp-card-problem">
              {item}
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section lp-reveal">
        <h3>TradeTrace は、記録と振り返りをつなげます</h3>
        <div className="lp-steps">
          {solutionSteps.map((step, idx) => (
            <article key={step} className="lp-step">
              <div className="lp-step-index">{idx + 1}</div>
              <div className="lp-step-text">{step}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section lp-reveal">
        <h3>TradeTraceでできること</h3>
        <div className="lp-card-grid lp-value-grid">
          {valueProps.map((item) => (
            <article key={item.title} className="lp-card lp-card-value">
              <h4>{item.title}</h4>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section lp-reveal">
        <h3>プロダクトイメージ</h3>
        <div className="lp-product-strip">
          <article className="lp-product-panel">
            <h4>一覧画面</h4>
            <p>保有中・未レビュー・レビュー済みを見分けながら、記録を整理します。</p>
            <div className="lp-product-rows">
              <span>7203 / 保有中</span>
              <span>AAPL / レビュー済</span>
              <span>9432 / 未レビュー</span>
            </div>
          </article>
          <article className="lp-product-panel">
            <h4>新規記録</h4>
            <p>銘柄、BUY、SELL、思考ログを1つの流れで記録できます。</p>
            <div className="lp-product-inputs">
              <span>銘柄</span>
              <span>BUY</span>
              <span>SELL</span>
            </div>
          </article>
          <article className="lp-product-panel">
            <h4>レビュー更新</h4>
            <p>売買理由・考察・自己評価を追記して、次回の判断に活かします。</p>
            <div className="lp-product-tags">
              <span>売買理由</span>
              <span>考察</span>
              <span>自己評価</span>
            </div>
          </article>
        </div>
      </section>

      <section className="lp-section lp-reveal">
        <h3>利用イメージ</h3>
        <div className="lp-usage">
          <article className="lp-usage-item">
            <h4>1. 売買を記録する</h4>
            <p>あとで振り返る前提で、取引内容やメモを残します。</p>
          </article>
          <article className="lp-usage-item">
            <h4>2. 記録を見返す</h4>
            <p>チャートや履歴を見ながら、そのときの判断を整理します。</p>
          </article>
          <article className="lp-usage-item">
            <h4>3. 次のレビューに活かす</h4>
            <p>自分の傾向や改善点を、次回の振り返りにつなげやすくします。</p>
          </article>
        </div>
      </section>

      <section className="lp-section lp-reveal">
        <h3>こんな人に向いています</h3>
        <ul className="lp-audience-list">
          {audienceItems.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section className="lp-section lp-reveal">
        <h3>公開初期として改善を続けています</h3>
        <p>
          TradeTrace は公開初期のため、使いやすさや導線を改善しながら運用しています。
          ご意見やご要望は X DM で受け付けています。正式なお問い合わせはメールまたはフォームをご案内します。
        </p>
      </section>

      <section className="lp-section lp-reveal">
        <h3>ご利用にあたって</h3>
        <p>
          TradeTrace は投資の記録と振り返りを支援するサービスです。
          特定の銘柄や売買を推奨するものではありません。
        </p>
      </section>

      <section className="lp-section lp-final-cta lp-reveal">
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
