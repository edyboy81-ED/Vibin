'use client'

import { useState, useEffect, useCallback } from 'react'

interface Status { id: string; name: string; color: string; isSystem: boolean; sortOrder: number }

const PRESET_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280']

type ThemeId = 'slate-emerald' | 'white-indigo' | 'dark-mode' | 'warm-neutral'
const THEMES: { id: ThemeId; name: string; description: string; swatches: string[] }[] = [
  { id: 'slate-emerald', name: 'Slate & Emerald', description: 'Dark slate cards with emerald green accents. Professional finance feel.', swatches: ['#1e293b', '#10b981', '#f59e0b', '#38bdf8'] },
  { id: 'white-indigo',  name: 'White & Indigo',  description: 'Clean white cards with indigo left-bar accents. Modern SaaS feel.', swatches: ['#ffffff', '#6366f1', '#7c3aed', '#f97316'] },
  { id: 'dark-mode',     name: 'Dark Mode',        description: 'Very dark cards with color-coded KPIs. Executive dashboard feel.', swatches: ['#020617', '#3b82f6', '#34d399', '#fbbf24'] },
  { id: 'warm-neutral',  name: 'Warm Neutral',     description: 'White shadow cards with teal accents. Approachable and clean.', swatches: ['#ffffff', '#0d9488', '#0891b2', '#d97706'] },
]

export default function SettingsPage() {
  const [statuses, setStatuses] = useState<Status[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', color: '#3b82f6' })
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', color: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeTheme, setActiveTheme] = useState<ThemeId>('slate-emerald')

  useEffect(() => {
    const saved = localStorage.getItem('vibin-dashboard-theme') as ThemeId | null
    if (saved) setActiveTheme(saved)
  }, [])

  const selectTheme = (id: ThemeId) => {
    setActiveTheme(id)
    localStorage.setItem('vibin-dashboard-theme', id)
  }

  const fetchStatuses = useCallback(async () => {
    const res = await fetch('/api/projection-statuses')
    setStatuses(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchStatuses() }, [fetchStatuses])

  const handleAdd = async () => {
    if (!addForm.name.trim()) return
    setAdding(true)
    setError('')
    const res = await fetch('/api/projection-statuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    })
    setAdding(false)
    if (res.ok) {
      setAddForm({ name: '', color: '#3b82f6' })
      setShowAdd(false)
      fetchStatuses()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to add status')
    }
  }

  const startEdit = (s: Status) => {
    setEditId(s.id)
    setEditForm({ name: s.name, color: s.color })
    setError('')
  }

  const handleSave = async (id: string) => {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/projection-statuses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setSaving(false)
    if (res.ok) {
      setEditId(null)
      fetchStatuses()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to save')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete status "${name}"? Any projections using it will need to be reassigned.`)) return
    const res = await fetch(`/api/projection-statuses/${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchStatuses()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to delete')
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Manage projection statuses and app configuration</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-900">Projection Statuses</h2>
          <button
            onClick={() => { setShowAdd(s => !s); setError('') }}
            className="text-sm bg-slate-900 text-white px-4 py-1.5 rounded-lg hover:bg-slate-700"
          >
            {showAdd ? 'Cancel' : '+ Add Status'}
          </button>
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {showAdd && (
          <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700 mb-3">New Status</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  className="input"
                  placeholder="e.g. On Hold"
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                <ColorPicker value={addForm.color} onChange={c => setAddForm(f => ({ ...f, color: c }))} />
              </div>
              <button
                onClick={handleAdd}
                disabled={adding || !addForm.name.trim()}
                className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-400 text-sm py-4">Loading…</p>
        ) : (
          <div className="space-y-2">
            {statuses.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200">
                {editId === s.id ? (
                  <>
                    <div className="flex-1 flex gap-3 items-center">
                      <input
                        value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="input flex-1"
                        onKeyDown={e => e.key === 'Enter' && handleSave(s.id)}
                      />
                      <ColorPicker value={editForm.color} onChange={c => setEditForm(f => ({ ...f, color: c }))} />
                    </div>
                    <button onClick={() => handleSave(s.id)} disabled={saving} className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                      {saving ? '…' : 'Save'}
                    </button>
                    <button onClick={() => setEditId(null)} className="text-sm text-gray-500 px-3 py-1.5">Cancel</button>
                  </>
                ) : (
                  <>
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{ backgroundColor: s.color + '22', color: s.color }}
                    >
                      {s.name}
                    </span>
                    {s.isSystem && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">system</span>
                    )}
                    <span className="flex-1" />
                    <button
                      onClick={() => startEdit(s)}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                    >
                      Edit
                    </button>
                    {!s.isSystem && (
                      <button
                        onClick={() => handleDelete(s.id, s.name)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                      >
                        Delete
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Dashboard Theme */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
        <h2 className="font-semibold text-gray-900 mb-1">Dashboard Theme</h2>
        <p className="text-sm text-gray-400 mb-5">Choose how your dashboard looks. Your selection is saved in this browser.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {THEMES.map(theme => (
            <button
              key={theme.id}
              onClick={() => selectTheme(theme.id)}
              className={`text-left rounded-xl border-2 p-4 transition-all ${
                activeTheme === theme.id
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm text-gray-900">{theme.name}</span>
                {activeTheme === theme.id && (
                  <span className="text-xs bg-slate-900 text-white px-2 py-0.5 rounded-full">Active</span>
                )}
              </div>
              <div className="flex gap-1.5 mb-2">
                {theme.swatches.map((color, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-md border border-gray-200"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400">{theme.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {PRESET_COLORS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full border-2 transition-transform ${value === c ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}
