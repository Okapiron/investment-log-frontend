import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import CrudTable from '../components/CrudTable'
import { api } from '../lib/api'

const types = ['cash', 'stock', 'fund', 'bond', 'crypto', 'other']
const initialForm = {
  account_id: '',
  name: '',
  asset_type: 'cash',
  currency: 'JPY',
  ticker: '',
  note: '',
  display_order: 0,
  is_active: true,
}

export default function AssetsPage() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [filter, setFilter] = useState({ account_id: '', asset_type: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => api.get('/accounts?is_active=true') })
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => api.get('/assets?is_active=true') })

  const filtered = assets.filter((row) => {
    if (filter.account_id && String(row.account_id) !== filter.account_id) return false
    if (filter.asset_type && row.asset_type !== filter.asset_type) return false
    return true
  })

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const nextErrors = {}
      if (!payload.account_id) nextErrors.account_id = 'accountは必須です'
      if (!payload.name.trim()) nextErrors.name = 'nameは必須です'
      if (!payload.asset_type) nextErrors.asset_type = 'asset_typeは必須です'
      if (!payload.currency.trim()) nextErrors.currency = 'currencyは必須です'
      setErrors(nextErrors)
      if (Object.keys(nextErrors).length > 0) throw new Error('入力を確認してください')

      if (editingId) return api.patch(`/assets/${editingId}`, payload)
      return api.post('/assets', payload)
    },
    onSuccess: () => {
      setApiError('')
      setErrors({})
      setEditingId(null)
      setForm(initialForm)
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
    onError: (e) => setApiError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/assets/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
    onError: (e) => setApiError(e.message),
  })

  const columns = useMemo(
    () => [
      {
        key: 'account_id',
        label: 'Account',
        render: (v) => accounts.find((a) => a.id === v)?.name || v,
      },
      { key: 'name', label: 'Name' },
      { key: 'asset_type', label: 'Type' },
      { key: 'currency', label: 'Currency' },
      { key: 'display_order', label: 'Order' },
      { key: 'is_active', label: 'Active', render: (v) => (v ? 'Yes' : 'No') },
    ],
    [accounts],
  )

  function onSubmit(e) {
    e.preventDefault()
    saveMutation.mutate({
      ...form,
      account_id: Number(form.account_id),
      display_order: Number(form.display_order),
      name: form.name.trim(),
      currency: form.currency.trim().toUpperCase(),
      ticker: form.ticker || null,
      note: form.note || null,
    })
  }

  return (
    <section>
      <h2>Assets</h2>

      <div className="filters">
        <label>
          Account
          <select value={filter.account_id} onChange={(e) => setFilter((p) => ({ ...p, account_id: e.target.value }))}>
            <option value="">All</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select value={filter.asset_type} onChange={(e) => setFilter((p) => ({ ...p, asset_type: e.target.value }))}>
            <option value="">All</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          Account *
          <select value={form.account_id} onChange={(e) => setForm((p) => ({ ...p, account_id: e.target.value }))}>
            <option value="">Select</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {errors.account_id && <span className="field-error">{errors.account_id}</span>}
        </label>
        <label>
          Name *
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>
        <label>
          Type *
          <select value={form.asset_type} onChange={(e) => setForm((p) => ({ ...p, asset_type: e.target.value }))}>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {errors.asset_type && <span className="field-error">{errors.asset_type}</span>}
        </label>
        <label>
          Currency *
          <input value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} />
          {errors.currency && <span className="field-error">{errors.currency}</span>}
        </label>
        <label>
          Ticker
          <input value={form.ticker} onChange={(e) => setForm((p) => ({ ...p, ticker: e.target.value }))} />
        </label>
        <label>
          Note
          <input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
        </label>
        <label>
          Display Order
          <input
            type="number"
            value={form.display_order}
            onChange={(e) => setForm((p) => ({ ...p, display_order: Number(e.target.value) }))}
          />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
          />
          Active
        </label>
        <div className="button-row">
          <button type="submit">{editingId ? 'Update' : 'Create'}</button>
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
              Cancel
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
          setForm({
            account_id: String(row.account_id),
            name: row.name || '',
            asset_type: row.asset_type,
            currency: row.currency || 'JPY',
            ticker: row.ticker || '',
            note: row.note || '',
            display_order: row.display_order || 0,
            is_active: row.is_active,
          })
        }}
        onDelete={(row) => {
          if (window.confirm('削除しますか？')) deleteMutation.mutate(row.id)
        }}
      />
    </section>
  )
}
