export default function TermsPage() {
  return (
    <div style={{ display: 'grid', gap: 10, maxWidth: 900 }}>
      <h2 style={{ margin: 0 }}>利用規約</h2>
      <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', lineHeight: 1.7, fontSize: 14 }}>
        <p style={{ marginTop: 0 }}>本サービスは投資記録と振り返りを支援するツールです。投資判断は利用者自身の責任で行ってください。</p>
        <p>本サービスは投資助言を提供しません。表示データの完全性・正確性・最新性を保証しません。</p>
        <p>ベータ提供中は仕様変更・停止・データ削除が発生する場合があります。</p>
      </div>
    </div>
  )
}
