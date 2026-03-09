import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="lp-root">
      <section className="lp-section lp-hero">
        <p className="lp-kicker">TradeTrace</p>
        <h2 className="lp-title">投資の記録を、あとで振り返れる形に。</h2>
        <p className="lp-lead">
          TradeTrace は、投資の売買記録を残し、チャートとあわせて見返しやすくするためのサービスです。
          初心者〜中級の個人投資家が、自分の判断をあとから整理しやすい体験を目指しています。
        </p>
        <div className="lp-cta-row">
          <Link to="/auth?mode=signup" className="lp-btn lp-btn-primary">新規登録</Link>
          <a href="#lp-overview" className="lp-btn lp-btn-secondary">詳しく見る</a>
        </div>
        <p className="lp-note">
          投資判断を助言するサービスではなく、記録と振り返りを支えるためのツールです。
        </p>
      </section>

      <section id="lp-overview" className="lp-section">
        <h3>こんな人に向いています</h3>
        <ul className="lp-list">
          <li>売買の理由をあとで見返したい</li>
          <li>感覚ではなく、記録ベースで振り返りたい</li>
          <li>トレードのレビュー習慣を少しずつ作りたい</li>
        </ul>
        <p className="lp-subtext">
          毎回完璧に分析するというより、まずは記録を残して、自分の判断の流れを見直したい人向けです。
        </p>
      </section>

      <section className="lp-section">
        <h3>TradeTraceでできること</h3>
        <div className="lp-grid3">
          <article className="lp-card">
            <h4>記録を残す</h4>
            <p>売買の内容やそのときの考えを、あとで見返せる形で残しやすくします。</p>
          </article>
          <article className="lp-card">
            <h4>チャートで振り返る</h4>
            <p>数字だけでは思い出しにくい場面も、チャートとあわせて整理しやすくします。</p>
          </article>
          <article className="lp-card">
            <h4>レビュー習慣を作る</h4>
            <p>単発で終わらず、記録して見返す流れを続けやすくすることを目指しています。</p>
          </article>
        </div>
      </section>

      <section className="lp-section">
        <h3>使い方はシンプルです</h3>
        <ol className="lp-steps">
          <li>
            <b>1. 売買を記録する</b>
            <p>あとで振り返る前提で、取引内容やメモを残します。</p>
          </li>
          <li>
            <b>2. 記録を見返す</b>
            <p>チャートや履歴を見ながら、そのときの判断を整理します。</p>
          </li>
          <li>
            <b>3. 次のレビューに活かす</b>
            <p>自分の傾向や改善点を、次回の振り返りにつなげやすくします。</p>
          </li>
        </ol>
      </section>

      <section className="lp-section">
        <h3>公開初期として改善を続けています</h3>
        <p>
          TradeTrace は公開初期のため、使いやすさや導線を改善しながら運用しています。
          ご意見やご要望は X DM で受け付けています。正式なお問い合わせはメールまたはフォームをご案内します。
        </p>
      </section>

      <section className="lp-section lp-caution">
        <h3>ご利用にあたって</h3>
        <p>
          TradeTrace は投資の記録と振り返りを支援するサービスです。
          特定の銘柄や売買を推奨するものではありません。
        </p>
      </section>

      <section className="lp-section lp-final-cta">
        <h3>まずは、記録を残すところから。</h3>
        <p>投資の振り返りを続けやすい形にしたい方は、TradeTrace をご確認ください。</p>
        <div className="lp-cta-row">
          <Link to="/auth?mode=signup" className="lp-btn lp-btn-primary">新規登録</Link>
        </div>
        <p className="lp-subtext">
          すでに利用中の方はこちら: <Link to="/auth?mode=signin">ログイン</Link>
        </p>
      </section>
    </div>
  )
}
