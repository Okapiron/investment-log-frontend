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
      if (!payload.name.trim()) throw new Error('nameは必須です')
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
      { key: 'name', label: 'Name' },
      { key: 'institution', label: 'Institution' },
      { key: 'display_order', label: 'Order' },
      { key: 'is_active', label: 'Active', render: (v) => (v ? 'Yes' : 'No') },
      { key: 'note', label: 'Note' },
    ],
    [],
  )

  function onSubmit(e) {
    e.preventDefault()
    saveMutation.mutate({ ...form, name: form.name.trim() })
  }

  return (
    <section>
      <h2>Accounts</h2>
      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          Name *
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </label>
        <label>
          Institution
          <input
            value={form.institution}
            onChange={(e) => setForm((p) => ({ ...p, institution: e.target.value }))}
          />
        </label>
        <label>
          Display Order
          <input
            type="number"
            value={form.display_order}
            onChange={(e) => setForm((p) => ({ ...p, display_order: Number(e.target.value) }))}
          />
        </label>
        <label>
          Note
          <input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
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
                setError('')
              }}
            >
              Cancel
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
