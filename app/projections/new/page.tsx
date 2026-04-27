'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ALL_COMPANIES, getDivision } from '@/lib/companies'
import Link from 'next/link'

interface Status { id: string; name: string; color: string }
interface JobSuggestion { id: string; jobNumber: string; jobName: string; company: string; division: string }

export default function NewProjectionPage() {
  const router = useRouter()
  const [statuses, setStatuses] = useState<Status[]>([])
  const [suggestions, setSuggestions] = useState<JobSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    jobId: '', jobNumber: '', jobName: '', company: 'Johnson Bros Corporation',
    monthYear: '', estimateNumber: '', billingPeriod: '',
    estimatedAmountOwed: '', estimatedPaymentDate: '', statusId: '', initialNote: '',
  })

  useEffect(() => {
    fetch('/api/projection-statuses').then(r => r.json()).then(data => {
      setStatuses(data)
      const projected = data.find((s: Status) => s.name === 'Projected')
      if (projected) setForm(f => ({ ...f, statusId: projected.id }))
    })
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleJobNumberChange = (value: string) => {
    set('jobNumber', value)
    set('jobId', '')
    if (searchRef.current) clearTimeout(searchRef.current)
    if (value.length < 2) { setSuggestions([]); return }
    searchRef.current = setTimeout(async () => {
      const res = await fetch(`/api/jobs/search?q=${encodeURIComponent(value)}`)
      const data = await res.json()
      setSuggestions(data)
      setShowSuggestions(true)
    }, 250)
  }

  const selectJob = (job: JobSuggestion) => {
    setForm(f => ({ ...f, jobId: job.id, jobNumber: job.jobNumber, jobName: job.jobName, company: job.company }))
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/projections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        estimatedAmountOwed: Math.round(parseFloat(form.estimatedAmountOwed) * 100),
      }),
    })
    setSubmitting(false)
    if (res.ok) {
      const data = await res.json()
      router.push(`/projections/${data.id}`)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to create projection')
    }
  }

  const division = getDivision(form.company)

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/projections" className="text-sm text-gray-400 hover:text-gray-600">← Projections</Link>
        <span className="text-gray-300">/</span>
        <span className="font-semibold text-gray-900">New Projection</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Job number with auto-fill */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <Field label="Job Number *">
                <input
                  value={form.jobNumber}
                  onChange={e => handleJobNumberChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  className="input"
                  placeholder="Type to search…"
                  required
                  autoComplete="off"
                />
              </Field>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {suggestions.map(j => (
                    <button
                      key={j.id}
                      type="button"
                      onMouseDown={() => selectJob(j)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-gray-50 last:border-0"
                    >
                      <span className="font-mono text-xs text-gray-600">{j.jobNumber}</span>
                      <span className="ml-2 text-gray-800">{j.jobName}</span>
                      <span className="ml-2 text-xs text-gray-400">{j.company}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Field label="Job Name *">
              <input value={form.jobName} onChange={e => set('jobName', e.target.value)} className="input" required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Company *">
              <select value={form.company} onChange={e => set('company', e.target.value)} className="input">
                {ALL_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Division">
              <div className="input bg-gray-50 text-gray-500 cursor-not-allowed">{division}</div>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Month/Year">
              <input value={form.monthYear} onChange={e => set('monthYear', e.target.value)} className="input" placeholder="04/2026" />
            </Field>
            <Field label="Est #">
              <input value={form.estimateNumber} onChange={e => set('estimateNumber', e.target.value)} className="input" placeholder="105" />
            </Field>
            <Field label="Billing Period">
              <input value={form.billingPeriod} onChange={e => set('billingPeriod', e.target.value)} className="input" placeholder="2/1/26-2/28/26" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Estimated Amount Owed ($) *">
              <input type="number" step="0.01" min="0" value={form.estimatedAmountOwed} onChange={e => set('estimatedAmountOwed', e.target.value)} className="input" placeholder="0.00" required />
            </Field>
            <Field label="Estimated Payment Date *">
              <input type="date" value={form.estimatedPaymentDate} onChange={e => set('estimatedPaymentDate', e.target.value)} className="input" required />
            </Field>
          </div>

          <Field label="Status *">
            <div className="flex gap-2 flex-wrap">
              {statuses.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => set('statusId', s.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${form.statusId === s.id ? 'border-transparent' : 'border-transparent opacity-50'}`}
                  style={form.statusId === s.id ? { backgroundColor: s.color + '22', color: s.color, borderColor: s.color } : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Initial Note">
            <textarea
              value={form.initialNote}
              onChange={e => set('initialNote', e.target.value)}
              className="input"
              rows={3}
              placeholder="Add context, contact information, or any relevant details…"
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting || !form.statusId} className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create Projection'}
            </button>
            <Link href="/projections" className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
