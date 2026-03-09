import { CONTACT_FORM_URL, SUPPORT_EMAIL } from '../lib/siteConfig'

export default function PrivacyPage() {
  return (
    <div style={{ display: 'grid', gap: 10, maxWidth: 900 }}>
      <h2 style={{ margin: 0 }}>プライバシーポリシー</h2>
      <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', lineHeight: 1.7, fontSize: 14 }}>
        <p style={{ marginTop: 0 }}><b>最終更新日:</b> 2026-03-08</p>
        <p><b>1. 取得する情報</b><br />本サービスは、メールアドレス、アカウント識別子、トレード記録、操作ログ（障害調査目的）を取得する場合があります。</p>
        <p><b>2. 利用目的</b><br />取得した情報は、認証、機能提供、障害対応、セキュリティ対策、サービス改善に利用します。</p>
        <p><b>3. 第三者提供</b><br />法令に基づく場合を除き、本人同意なく第三者提供は行いません。</p>
        <p><b>4. 外部サービス利用</b><br />本サービスは、ホスティング/データ保存/認証のために外部事業者（例: Vercel, Render, Supabase）を利用します。</p>
        <p><b>5. 利用者の権利</b><br />利用者はSettings画面からデータエクスポートおよび削除を実行できます。</p>
        <p><b>6. 安全管理</b><br />運営者は不正アクセス防止やキー管理を含む合理的な安全管理措置を実施します。</p>
        <p><b>7. ポリシー変更</b><br />本ポリシーは必要に応じて改定され、改定後は本ページ掲載時点で効力を生じます。</p>
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
