import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import CrudTable from '../components/CrudTable'
import { api, formatJPY } from '../lib/api'

const initialForm = { month: '', asset_id: '', value_jpy: '', memo: '' }

export default function SnapshotsPage() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [filter, setFilter] = useState({ month: '', account_id: '', asset_id: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => api.get('/accounts?is_active=true') })
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => api.get('/assets?is_active=true') })
  const { data: snapshots = [] } = useQuery({ queryKey: ['snapshots'], queryFn: () => api.get('/snapshots') })

  const filtered = snapshots.filter((row) => {
    if (filter.month && row.month !== filter.month) return false
    if (filter.account_id && String(row.account_id) !== filter.account_id) return false
    if (filter.asset_id && String(row.asset_id) !== filter.asset_id) return false
    return true
  })

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const nextErrors = {}
      if (!payload.month) nextErrors.month = '対象月は必須です'
      if (!payload.asset_id) nextErrors.asset_id = '資産は必須です'
      if (payload.value_jpy === '' || Number(payload.value_jpy) < 0) nextErrors.value_jpy = '0以上の整数を入力してください'
      setErrors(nextErrors)
      if (Object.keys(nextErrors).length > 0) throw new Error('入力を確認してください')

      if (editingId) return api.patch(`/snapshots/${editingId}`, payload)
      return api.post('/snapshots', payload)
    },
    onSuccess: () => {
      setApiError('')
      setErrors({})
      setEditingId(null)
      setForm(initialForm)
      queryClient.invalidateQueries({ queryKey: ['snapshots'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e) => setApiError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/snapshots/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e) => setApiError(e.message),
  })

  const columns = useMemo(
    () => [
      { key: 'month', label: '対象月' },
      {
        key: 'account_id',
        label: '口座',
        render: (v) => accounts.find((a) => a.id === v)?.name || v,
      },
      {
        key: 'asset_id',
        label: '資産',
        render: (v) => assets.find((a) => a.id === v)?.name || v,
      },
      { key: 'value_jpy', label: '評価額', render: (v) => formatJPY(v) },
      { key: 'memo', label: 'メモ' },
    ],
    [accounts, assets],
  )

  function onSubmit(e) {
    e.preventDefault()
    saveMutation.mutate({
      month: form.month,
      asset_id: Number(form.asset_id),
      value_jpy: Number(form.value_jpy),
      memo: form.memo || null,
    })
  }

  return (
    <section>
      <h2>スナップショット</h2>

      <div className="filters">
        <label>
          対象月
          <input type="month" value={filter.month} onChange={(e) => setFilter((p) => ({ ...p, month: e.target.value }))} />
        </label>
        <label>
          口座
          <select value={filter.account_id} onChange={(e) => setFilter((p) => ({ ...p, account_id: e.target.value }))}>
            <option value="">すべて</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          資産
          <select value={filter.asset_id} onChange={(e) => setFilter((p) => ({ ...p, asset_id: e.target.value }))}>
            <option value="">すべて</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          対象月 *
          <input type="month" value={form.month} onChange={(e) => setForm((p) => ({ ...p, month: e.target.value }))} />
          {errors.month && <span className="field-error">{errors.month}</span>}
        </label>
        <label>
          資産 *
          <select value={form.asset_id} onChange={(e) => setForm((p) => ({ ...p, asset_id: e.target.value }))}>
            <option value="">選択してください</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {errors.asset_id && <span className="field-error">{errors.asset_id}</span>}
        </label>
        <label>
          評価額（JPY）*
          <input
            type="number"
            min="0"
            value={form.value_jpy}
            onChange={(e) => setForm((p) => ({ ...p, value_jpy: e.target.value }))}
          />
          {errors.value_jpy && <span className="field-error">{errors.value_jpy}</span>}
        </label>
        <label>
          メモ
          <input value={form.memo} onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))} />
        </label>
        <div className="button-row">
          <button type="submit">{editingId ? '更新' : '作成'}</button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null)
                setForm(initialForm)
                setErrors({})
                setApiError('')
              }}
            >
              キャンセル
            </button>
          )}
        </div>
      </form>
      {apiError && <p className="error">{apiError}</p>}

      <CrudTable
        columns={columns}
        rows={filtered}
        onEdit={(row) => {
          setEditingId(row.id)
          setForm({ month: row.month, asset_id: String(row.asset_id), value_jpy: String(row.value_jpy), memo: row.memo || '' })
        }}
        onDelete={(row) => {
          if (window.confirm('削除しますか？')) deleteMutation.mutate(row.id)
        }}
      />
    </section>
  )
}
