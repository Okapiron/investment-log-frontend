import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, formatJPY } from '../lib/api'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const ASSET_TYPE_LABELS = {
  cash: '現金',
  stock: '株式',
  fund: '投資信託',
  bond: '債券',
  crypto: '暗号資産',
  other: 'その他',
}

export default function MonthlyPage() {
  const queryClient = useQueryClient()
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [drafts, setDrafts] = useState({})
  const [rowStatus, setRowStatus] = useState({})
  const [copyResult, setCopyResult] = useState('')

  const monthlyQuery = useQuery({
    queryKey: ['monthly', selectedMonth],
    queryFn: () => api.get(`/monthly?month=${selectedMonth}`),
  })

  useEffect(() => {
    const nextDrafts = {}
    const accounts = monthlyQuery.data?.accounts || []
    accounts.forEach((account) => {
      account.assets.forEach((asset) => {
        nextDrafts[asset.asset_id] = asset.value_jpy == null ? '' : String(asset.value_jpy)
      })
    })
    setDrafts(nextDrafts)
    setRowStatus({})
  }, [monthlyQuery.data])

  const copyMutation = useMutation({
    mutationFn: () => api.post('/snapshots/copy-latest', { to_month: selectedMonth }),
    onSuccess: (res) => {
      setCopyResult(
        `${res.from_month} から ${res.to_month} を作成（作成: ${res.created}件 / スキップ: ${res.skipped}件）`,
      )
      queryClient.invalidateQueries({ queryKey: ['monthly', selectedMonth] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['snapshots'] })
    },
    onError: (e) => {
      setCopyResult(e.message)
    },
  })

  const rows = useMemo(() => monthlyQuery.data?.accounts || [], [monthlyQuery.data])

  async function saveAsset(asset) {
    const rawValue = drafts[asset.asset_id]
    if (rawValue === '' || rawValue == null) {
      setRowStatus((prev) => ({
        ...prev,
        [asset.asset_id]: { saving: false, error: '空欄は未入力のままです（保存しません）' },
      }))
      return
    }

    const numeric = Number(rawValue)
    if (!Number.isInteger(numeric) || numeric < 0) {
      setRowStatus((prev) => ({
        ...prev,
        [asset.asset_id]: { saving: false, error: '0以上の整数を入力してください' },
      }))
      return
    }

    setRowStatus((prev) => ({ ...prev, [asset.asset_id]: { saving: true, error: '' } }))

    try {
      if (asset.snapshot_id) {
        await api.patch(`/snapshots/${asset.snapshot_id}`, { value_jpy: numeric })
      } else {
        await api.post('/snapshots', { month: selectedMonth, asset_id: asset.asset_id, value_jpy: numeric })
      }
      setRowStatus((prev) => ({ ...prev, [asset.asset_id]: { saving: false, error: '' } }))
      await queryClient.invalidateQueries({ queryKey: ['monthly', selectedMonth] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['snapshots'] })
    } catch (e) {
      setRowStatus((prev) => ({
        ...prev,
        [asset.asset_id]: { saving: false, error: e.message || '保存に失敗しました' },
      }))
    }
  }

  return (
    <section>
      <div className="monthly-header">
        <h2>月次入力</h2>
        <div className="monthly-controls">
          <label>
            対象月
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value)
                setCopyResult('')
              }}
            />
          </label>
          <button type="button" onClick={() => copyMutation.mutate()} disabled={copyMutation.isPending}>
            最新月から作成
          </button>
        </div>
      </div>

      {copyResult && <p className="meta">{copyResult}</p>}

      <div className="card">
        <strong>入力状況:</strong>{' '}
        {monthlyQuery.data ? `${monthlyQuery.data.summary.filled} 件入力 / ${monthlyQuery.data.summary.missing} 件未入力` : '-'}
      </div>

      {rows.map((account) => (
        <article key={account.account_id} className="card account-block">
          <h3>{account.account_name}</h3>
          <table className="table">
            <thead>
              <tr>
                <th>資産</th>
                <th>種別</th>
                <th>通貨</th>
                <th>評価額（JPY）</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {account.assets.map((asset) => {
                const status = rowStatus[asset.asset_id] || { saving: false, error: '' }
                return (
                  <tr key={asset.asset_id}>
                    <td>{asset.asset_name}</td>
                    <td>{ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}</td>
                    <td>{asset.currency}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        placeholder="未入力"
                        value={drafts[asset.asset_id] ?? ''}
                        onChange={(e) => {
                          const value = e.target.value
                          setDrafts((prev) => ({ ...prev, [asset.asset_id]: value }))
                        }}
                        onBlur={() => saveAsset(asset)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            saveAsset(asset)
                          }
                        }}
                      />
                      {drafts[asset.asset_id] !== '' && drafts[asset.asset_id] != null && (
                        <div className="meta">{formatJPY(Number(drafts[asset.asset_id]))}</div>
                      )}
                    </td>
                    <td>
                      {status.saving && <span className="meta">保存中...</span>}
                      {status.error && <span className="field-error">{status.error}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </article>
      ))}

      {!monthlyQuery.isLoading && rows.length === 0 && <p className="empty">有効な口座または資産がありません。</p>}
    </section>
  )
}
