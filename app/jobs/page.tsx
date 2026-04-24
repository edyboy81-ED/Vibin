'use client'

import { useState, useEffect, useCallback } from 'react'

const COMPANIES = [
  { value: 'PRESTIGE', label: 'Prestige Productions' },
  { value: 'HARMONY', label: 'Harmony Events' },
  { value: 'RHYTHM', label: 'Rhythm Records' },
  { value: 'MELODY', label: 'Melody Media' },
  { value: 'ENCORE', label: 'Encore Entertainment' },
]

interface Job {
  id: string
  jobNumber: string
  company: string
  name: string | null
  date: string | null
  amount: number
  notes: string | null
}

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function coLabel(company: string) {
  return COMPANIES.find((c) => c.value === company)?.label ?? company
}

const BLANK = { jobNumber: '', company: 'PRESTIGE', name: '', date: '', amount: '', notes: '' }

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(BLANK)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchJobs = useCallback(async () => {
    const res = await fetch('/api/jobs')
    setJobs(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const amountCents = Math.round(parseFloat(form.amount) * 100)
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobNumber: form.jobNumber,
        company: form.company,
        name: form.name || null,
        date: form.date || null,
        amount: amountCents,
        notes: form.notes || null,
      }),
    })

    setSubmitting(false)

    if (res.ok) {
      setForm(BLANK)
      fetchJobs()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to create job')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this job?')) return
    await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    fetchJobs()
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Jobs</h1>

      {/* Add form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-base font-semibold mb-4">Add Job</h2>
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
          <Field label="Job Name">
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="input"
              placeholder="Optional"
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              className="input"
            />
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
          <Field label="Notes">
            <input
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
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
              {submitting ? 'Adding…' : 'Add Job'}
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
              <Th>Name</Th>
              <Th>Date</Th>
              <Th right>Amount</Th>
              <Th>Notes</Th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No jobs yet. Add one above.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{job.jobNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{coLabel(job.company)}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {job.name ?? <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {job.date ? new Date(job.date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{dollars(job.amount)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{job.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(job.id)}
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
