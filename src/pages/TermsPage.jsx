import { CONTACT_FORM_URL, SUPPORT_EMAIL } from '../lib/siteConfig'

export default function TermsPage() {
  return (
    <div style={{ display: 'grid', gap: 10, maxWidth: 900 }}>
      <h2 style={{ margin: 0 }}>利用規約</h2>
      <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', lineHeight: 1.7, fontSize: 14 }}>
        <p style={{ marginTop: 0 }}><b>最終更新日:</b> 2026-03-08</p>
        <p><b>1. サービス内容</b><br />TradeTraceは、トレード記録と振り返りを支援するWebサービスです。投資判断は利用者自身の責任で行ってください。</p>
        <p><b>2. 禁止事項</b><br />不正アクセス、他者アカウントの利用、サービス妨害行為、法令違反行為を禁止します。</p>
        <p><b>3. 免責</b><br />本サービスは投資助言を提供しません。表示データの完全性・正確性・最新性を保証しません。利用により生じた損害について、運営者は故意または重過失がある場合を除き責任を負いません。</p>
        <p><b>4. 知的財産権</b><br />本サービスのUI、テキスト、ロゴ、デザイン、ソフトウェア等の権利は運営者に帰属します。運営者の事前許可なく、複製・再配布・改変・二次利用・商用利用を行うことはできません。</p>
        <p><b>5. アカウント停止・削除</b><br />利用規約違反がある場合、運営者は事前通知なく利用停止または削除を行うことがあります。</p>
        <p><b>6. 仕様変更・提供終了</b><br />運営者は、サービス内容の変更、一時停止、終了を行う場合があります。</p>
        <p><b>7. 規約変更</b><br />本規約は必要に応じて改定されます。改定後は本ページ掲載時点で効力を生じます。</p>
        <p>
          <b>8. お問い合わせ</b><br />
          {CONTACT_FORM_URL ? <a href={CONTACT_FORM_URL} target="_blank" rel="noreferrer">お問い合わせフォーム</a> : null}
          {CONTACT_FORM_URL && SUPPORT_EMAIL ? ' / ' : null}
          {SUPPORT_EMAIL ? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> : null}
          {!CONTACT_FORM_URL && !SUPPORT_EMAIL ? '問い合わせ先準備中' : null}
        </p>
      </div>
    </div>
  )
}
