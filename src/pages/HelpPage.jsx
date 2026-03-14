import { useMemo, useState } from 'react'
import { CONTACT_FORM_URL, SUPPORT_EMAIL, getSupportMailto } from '../lib/siteConfig'

export default function HelpPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const supportMailto = useMemo(() => {
    const body = [
      `お名前: ${name || '（未入力）'}`,
      `返信先メール: ${email || '（未入力）'}`,
      '',
      'お問い合わせ内容:',
      message || '（未入力）',
    ].join('\n')
    return getSupportMailto({
      subject: '[TradeTrace] お問い合わせ',
      body,
    })
  }, [email, message, name])

  return (
    <div style={{ display: 'grid', gap: 10, maxWidth: 900 }}>
      <h2 style={{ margin: 0 }}>ヘルプ</h2>

      <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', lineHeight: 1.7, fontSize: 14 }}>
        <h3 style={{ marginTop: 0 }}>はじめかた</h3>
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>
            「新規記録」から新しいトレードを登録します。
            <br />
            まずは銘柄・買付日・買値・数量などの基本情報を入力します。
          </li>
          <li>
            「投資記録」で登録したトレードの一覧を確認します。
            <br />
            保有中・未レビュー・レビュー済みなどの状態も確認できます。
          </li>
          <li>
            各トレードの詳細画面で内容を更新します。
            <br />
            売却情報、売買理由、考察、自己評価などをあとから追記できます。
          </li>
          <li>
            振り返りが完了したらレビュー済みにします。
            <br />
            自分の学びや反省点を残して、次回の判断に活かせます。
          </li>
        </ol>
      </div>

      <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', lineHeight: 1.7, fontSize: 14 }}>
        <h3 style={{ marginTop: 0 }}>基本操作</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>トレード作成: 「新規記録」→ 必須項目を入力 → 保存</li>
          <li>トレード編集: 「投資記録」→ 対象トレードを開く → 「編集」→ 保存</li>
          <li>レビュー更新: トレード詳細画面で、売却理由・考察・自己評価を入力して更新</li>
          <li>エクスポート: 「設定」→ 「データ」→ JSON / CSV を選んでダウンロード</li>
          <li>ログアウト: 「設定」→ 「アカウント」→ 「ログアウト」</li>
        </ul>
      </div>

      <div style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: 12, background: '#fff', lineHeight: 1.7, fontSize: 14, display: 'grid', gap: 8 }}>
        <h3 style={{ marginTop: 0, marginBottom: 0 }}>お問い合わせ</h3>
        <div style={{ fontSize: 13, color: '#667085' }}>
          不具合やご質問があれば、以下からご連絡ください。
        </div>

        {CONTACT_FORM_URL ? (
          <div>
            <a href={CONTACT_FORM_URL} target="_blank" rel="noreferrer">
              問い合わせフォームを開く
            </a>
          </div>
        ) : null}

        {SUPPORT_EMAIL ? (
          <>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#667085' }}>お名前</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="任意" />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#667085' }}>返信先メール</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="任意" />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#667085' }}>内容</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="お問い合わせ内容を入力してください"
                style={{ border: '1px solid #d0d5dd', borderRadius: 8, padding: 10 }}
              />
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <a href={supportMailto || `mailto:${SUPPORT_EMAIL}`}>メールアプリで送信</a>
              <span style={{ fontSize: 12, color: '#667085' }}>宛先: {SUPPORT_EMAIL}</span>
            </div>
          </>
        ) : null}

        {!CONTACT_FORM_URL && !SUPPORT_EMAIL ? (
          <div style={{ fontSize: 13, color: '#b54708' }}>
            問い合わせ先メールが未設定です。`VITE_SUPPORT_EMAIL` を設定してください。
          </div>
        ) : null}
      </div>
    </div>
  )
}
