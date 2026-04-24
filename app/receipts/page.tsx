'use client'

import { useState, useEffect, useCallback } from 'react'

const COMPANIES = [
  { value: 'PRESTIGE', label: 'Prestige Productions' },
  { value: 'HARMONY', label: 'Harmony Events' },
  { value: 'RHYTHM', label: 'Rhythm Records' },
  { value: 'MELODY', label: 'Melody Media' },
  { value: 'ENCORE', label: 'Encore Entertainment' },
]

interface Receipt {
  id: string
  jobNumber: string
  company: string
  amount: number
  date: string
  description: string | null
}

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function coLabel(company: string) {
  return COMPANIES.find((c) => c.value === company)?.label ?? company
}

const BLANK = { jobNumber: '', company: 'PRESTIGE', amount: '', date: '', description: '' }

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(BLANK)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchReceipts = useCallback(async () => {
    const res = await fetch('/api/receipts')
    setReceipts(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchReceipts()
  }, [fetchReceipts])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const amountCents = Math.round(parseFloat(form.amount) * 100)
    const res = await fetch('/api/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobNumber: form.jobNumber,
        company: form.company,
        amount: amountCents,
        date: form.date,
        description: form.description || null,
      }),
    })

    setSubmitting(false)

    if (res.ok) {
      setForm(BLANK)
      fetchReceipts()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to create receipt')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this receipt?')) return
    await fetch(`/api/receipts/${id}`, { method: 'DELETE' })
    fetchReceipts()
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Receipts</h1>

      {/* Add form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-base font-semibold mb-4">Add Receipt</h2>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Job Number *">
            <input
              value={form.jobNumber}
              onChange={(e) => set('jobNumber', e.target.value)}
              className="input"
              placeholder="e.g. J001"
              required
            />
          </Field>
          <Field label="Company *">
            <select
              value={form.company}
              onChange={(e) => set('company', e.target.value)}
              className="input"
            >
              {COMPANIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Amount ($) *">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              className="input"
              placeholder="0.00"
              required
            />
          </Field>
          <Field label="Date *">
            <input
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              className="input"
              required
            />
          </Field>
          <Field label="Description">
            <input
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className="input"
              placeholder="Optional"
            />
          </Field>
          <div className="col-span-full">
            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {submitting ? 'Adding…' : 'Add Receipt'}
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <Th>Job #</Th>
              <Th>Company</Th>
              <Th>Date</Th>
              <Th right>Amount</Th>
              <Th>Description</Th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td>
              </tr>
            ) : receipts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No receipts yet. Add one above.
                </td>
              </tr>
            ) : (
              receipts.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{r.jobNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{coLabel(r.company)}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right font-mono">{dollars(r.amount)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.description ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-red-500 hover:text-red-700 text-xs transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}
