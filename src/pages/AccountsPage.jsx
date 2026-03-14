import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import CrudTable from '../components/CrudTable'
import { api } from '../lib/api'

const initialForm = { name: '', institution: '', note: '', display_order: 0, is_active: true }

export default function AccountsPage() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => api.get('/accounts?is_active=true') })

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (!payload.name.trim()) throw new Error('口座名は必須です')
      if (editingId) return api.patch(`/accounts/${editingId}`, payload)
      return api.post('/accounts', payload)
    },
    onSuccess: () => {
      setError('')
      setForm(initialForm)
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
    onError: (e) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/accounts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
    onError: (e) => setError(e.message),
  })

  const columns = useMemo(
    () => [
      { key: 'name', label: '口座名' },
      { key: 'institution', label: '金融機関' },
      { key: 'display_order', label: '表示順' },
      { key: 'is_active', label: '状態', render: (v) => (v ? '有効' : '無効') },
      { key: 'note', label: 'メモ' },
    ],
    [],
  )

  function onSubmit(e) {
    e.preventDefault()
    saveMutation.mutate({ ...form, name: form.name.trim() })
  }

  return (
    <section>
      <h2>口座</h2>
      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          口座名 *
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </label>
        <label>
          金融機関
          <input
            value={form.institution}
            onChange={(e) => setForm((p) => ({ ...p, institution: e.target.value }))}
          />
        </label>
        <label>
          表示順
          <input
            type="number"
            value={form.display_order}
            onChange={(e) => setForm((p) => ({ ...p, display_order: Number(e.target.value) }))}
          />
        </label>
        <label>
          メモ
          <input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
          />
          有効
        </label>
        <div className="button-row">
          <button type="submit">{editingId ? '更新' : '作成'}</button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null)
                setForm(initialForm)
                setError('')
              }}
            >
              キャンセル
            </button>
          )}
        </div>
      </form>
      {error && <p className="error">{error}</p>}

      <CrudTable
        columns={columns}
        rows={accounts}
        onEdit={(row) => {
          setEditingId(row.id)
          setForm({
            name: row.name || '',
            institution: row.institution || '',
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
