export default function PrivacyPage() {
  return (
    <div style={{ display: 'grid', gap: 10, maxWidth: 900 }}>
      <h2 style={{ margin: 0 }}>プライバシーポリシー</h2>
      <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', lineHeight: 1.7, fontSize: 14 }}>
        <p style={{ marginTop: 0 }}>本サービスは、アカウント管理と機能提供のために必要な範囲でメールアドレスと利用データを保存します。</p>
        <p>法令に基づく場合を除き、本人同意なく第三者提供は行いません。</p>
        <p>利用者はSettings画面からデータエクスポートおよび削除を実行できます。</p>
      </div>
    </div>
  )
}
