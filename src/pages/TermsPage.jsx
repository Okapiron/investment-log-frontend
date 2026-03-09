import {
  CONTACT_FORM_URL,
  LEGAL_ADDRESS,
  LEGAL_GOVERNING_LAW,
  LEGAL_JURISDICTION,
  LEGAL_OPERATOR_NAME,
  LEGAL_REPRESENTATIVE,
  SUPPORT_EMAIL,
} from '../lib/siteConfig'

export default function TermsPage() {
  const contactFormNode = CONTACT_FORM_URL
    ? <a href={CONTACT_FORM_URL} target="_blank" rel="noreferrer">{CONTACT_FORM_URL}</a>
    : 'なし'
  const supportEmailNode = SUPPORT_EMAIL
    ? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
    : 'なし'

  return (
    <div style={{ display: 'grid', gap: 10, maxWidth: 900 }}>
      <h2 style={{ margin: 0 }}>利用規約</h2>
      <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', lineHeight: 1.7, fontSize: 14 }}>
        <p style={{ marginTop: 0 }}><b>最終更新日:</b> 2026-03-09</p>
        <p><b>1. サービス内容</b><br />TradeTrace（以下「本サービス」といいます。）は、トレード記録、振り返り、学習のための機能を提供するWebサービスです。<br />本サービスは投資助言、投資勧誘その他これらに類する行為を目的とするものではありません。投資判断は利用者自身の責任で行ってください。</p>
        <p><b>2. 利用条件</b><br />利用者は、自己の責任において本サービスを利用し、関連法令、本規約および運営者が別途定めるルールに従うものとします。<br />利用者は、登録情報について正確かつ最新の情報を提供し、自己の責任でアカウントを管理するものとします。</p>
        <div>
          <p style={{ marginBottom: 6 }}><b>3. 禁止事項</b><br />利用者は、以下の行為をしてはなりません。</p>
          <ul style={{ marginTop: 0 }}>
            <li>法令または公序良俗に反する行為</li>
            <li>不正アクセス、認証情報の不正使用、他者アカウントの利用</li>
            <li>本サービスの運営を妨害する行為</li>
            <li>運営者または第三者の権利・利益を侵害する行為</li>
            <li>虚偽の情報を登録または送信する行為</li>
            <li>本サービスを通じて取得した情報を、運営者の事前承諾なく商業利用、再配布または改変する行為</li>
            <li>その他、運営者が不適切と判断する行為</li>
          </ul>
        </div>
        <p><b>4. アカウントの停止・削除</b><br />運営者は、利用者が本規約に違反した場合、または本サービスの運営上必要があると判断した場合、事前通知なく当該利用者の利用停止、アカウント停止またはデータ削除等の措置を行うことがあります。</p>
        <p><b>5. サービスの変更・中断・終了</b><br />運営者は、保守、障害対応、仕様変更その他運営上の必要に応じて、本サービスの全部または一部を変更、一時中断または終了することがあります。</p>
        <p><b>6. 知的財産権</b><br />本サービスに関するプログラム、デザイン、文章、画像、ロゴその他一切の知的財産権は、運営者または正当な権利者に帰属します。<br />利用者は、法令で認められる場合を除き、運営者の事前承諾なく複製、転載、改変、再配布その他の利用をしてはなりません。</p>
        <p><b>7. 利用者データ</b><br />利用者が本サービスに登録したデータの取扱いは、別途定めるプライバシーポリシーによるものとします。<br />利用者は、自己の責任において必要なバックアップまたはエクスポートを行うものとします。</p>
        <p><b>8. 免責</b><br />本サービスに表示される情報、計算結果、外部データ連携結果その他一切の情報について、運営者は完全性、正確性、有用性、最新性、継続的提供を保証しません。<br />運営者は、本サービスの利用または利用不能により利用者に生じた損害について、運営者の故意または重過失による場合その他法令上免責が認められない場合を除き、責任を負いません。</p>
        <p><b>9. 規約変更</b><br />運営者は、必要に応じて本規約を変更することがあります。<br />重要な変更を行う場合、運営者は本サービス上への掲示その他相当の方法で周知します。<br />変更後の規約は、本サービス上に掲載した時点または別途定めた効力発生日から効力を生じます。</p>
        <p><b>10. 準拠法・裁判管轄</b><br />本規約の準拠法は {LEGAL_GOVERNING_LAW} とします。<br />本サービスまたは本規約に関して紛争が生じた場合、{LEGAL_JURISDICTION} を第一審の専属的合意管轄裁判所とします。</p>
        <p>
          <b>11. 運営者情報</b><br />
          運営者名: {LEGAL_OPERATOR_NAME}<br />
          代表者: {LEGAL_REPRESENTATIVE}<br />
          所在地: {LEGAL_ADDRESS}
        </p>
        <p>
          <b>12. お問い合わせ</b><br />
          本サービスに関するお問い合わせは、以下の窓口で受け付けます。<br />
          - お問い合わせフォーム: {contactFormNode}<br />
          - メールアドレス: {supportEmailNode}
        </p>
      </div>
    </div>
  )
}
