'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { dollars, fmtDate } from '@/lib/format'
import { ALL_COMPANIES } from '@/lib/companies'
import Link from 'next/link'

interface PaymentRow {
  id: string
  datePmtReceived: string
  amountReceived: number
  paidThruDate: string | null
  notes: string | null
  job: {
    id: string
    jobNumber: string
    jobName: string
    company: string
    division: string
    customer: string | null
    jobStatus: string
    _count: { projections: number }
  }
}

const BLANK = { jobNumber: '', jobName: '', company: 'Johnson Bros Corporation', customer: '', jobStatus: 'IN_PROGRESS', nextAmountDue: '' }

function JobsContent() {
  const searchParams = useSearchParams()
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterDivision, setFilterDivision] = useState(searchParams.get('division') ?? '')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState(searchParams.get('dateFrom') ?? '')
  const [filterDateTo, setFilterDateTo] = useState(searchParams.get('dateTo') ?? '')

  const fetchPayments = useCallback(async () => {
    const res = await fetch('/api/payments')
    setPayments(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const from = filterDateFrom ? new Date(filterDateFrom) : null
    const to = filterDateTo ? new Date(filterDateTo + 'T23:59:59') : null
    return payments.filter(p => {
      if (q && !p.job.jobNumber.toLowerCase().includes(q) && !p.job.jobName.toLowerCase().includes(q) && !p.job.customer?.toLowerCase().includes(q)) return false
      if (filterCompany && p.job.company !== filterCompany) return false
      if (filterDivision && p.job.division !== filterDivision) return false
      if (filterStatus && p.job.jobStatus !== filterStatus) return false
      if (from || to) {
        const d = new Date(p.datePmtReceived)
        if (from && d < from) return false
        if (to && d > to) return false
      }
      return true
    })
  }, [payments, search, filterCompany, filterDivision, filterStatus, filterDateFrom, filterDateTo])

  const filteredTotal = useMemo(() => filtered.reduce((s, p) => s + p.amountReceived, 0), [filtered])
  const hasDateFilter = filterDateFrom || filterDateTo

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        nextAmountDue: form.nextAmountDue ? Math.round(parseFloat(form.nextAmountDue) * 100) : null,
      }),
    })
    setSubmitting(false)
    if (res.ok) { setForm(BLANK); setShowForm(false) }
    else { const d = await res.json(); setError(d.error ?? 'Failed') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Cash Receipts</h1>
        <div className="flex gap-2">
          <Link href="/import" className="text-sm border border-gray-300 bg-white px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            Import CSV
          </Link>
          <a href="/api/jobs/export" className="text-sm border border-gray-300 bg-white px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            Export CSV
          </a>
          <button
            onClick={() => setShowForm(f => !f)}
            className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add Job'}
          </button>
        </div>
      </div>

      {/* Add job form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
          <h2 className="text-base font-semibold mb-4">Add Job</h2>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Job Number *">
              <input value={form.jobNumber} onChange={e => set('jobNumber', e.target.value)} className="input" required placeholder="50-1028" />
            </Field>
            <Field label="Job Name *">
              <input value={form.jobName} onChange={e => set('jobName', e.target.value)} className="input" required />
            </Field>
            <Field label="Customer">
              <input value={form.customer} onChange={e => set('customer', e.target.value)} className="input" placeholder="Customer name" />
            </Field>
            <Field label="Company *">
              <select value={form.company} onChange={e => set('company', e.target.value)} className="input">
                {ALL_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.jobStatus} onChange={e => set('jobStatus', e.target.value)} className="input">
                <option value="IN_PROGRESS">In Progress</option>
                <option value="CLOSED">Closed</option>
              </select>
            </Field>
            <Field label="Next Amount Due ($)">
              <input type="number" step="0.01" min="0" value={form.nextAmountDue} onChange={e => set('nextAmountDue', e.target.value)} className="input" placeholder="0.00" />
            </Field>
            <div className="col-span-full flex gap-2">
              <button type="submit" disabled={submitting} className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50">
                {submitting ? 'Adding…' : 'Add Job'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-2 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search job #, name, or customer…"
          className="input flex-1 min-w-48"
        />
        <select value={filterDivision} onChange={e => setFilterDivision(e.target.value)} className="input w-36">
          <option value="">All Divisions</option>
          <option value="LEGACY">Legacy</option>
          <option value="AB">AB</option>
        </select>
        <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className="input w-56">
          <option value="">All Companies</option>
          {ALL_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input w-36">
          <option value="">All Statuses</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {/* Date filter row */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Payment date from</label>
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="input w-40" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">to</label>
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="input w-40" />
        </div>
        {hasDateFilter && (
          <button
            onClick={() => { setFilterDateFrom(''); setFilterDateTo('') }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Clear dates
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <span>
            {filtered.length} payment{filtered.length !== 1 ? 's' : ''}
            {hasDateFilter && <span className="ml-2 text-blue-600 font-medium">· filtered by payment date</span>}
          </span>
          {filtered.length > 0 && (
            <span className="font-mono font-semibold text-gray-700">{dollars(filteredTotal)}</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <Th>Job #</Th>
                <Th>Job Name</Th>
                <Th>Company</Th>
                <Th>Status</Th>
                <Th>Date Received</Th>
                <Th>Amount</Th>
                <Th>Paid Thru</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No payments found.</td></tr>
              ) : filtered.map(p => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => window.location.href = `/jobs/${p.job.id}`}
                >
                  <td className="px-4 py-3 font-mono text-xs font-medium whitespace-nowrap">{p.job.jobNumber}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-800">{p.job.jobName}</div>
                    {p.job.customer && <div className="text-xs text-gray-400">{p.job.customer}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-600">{p.job.company}</div>
                    <div className="text-xs text-gray-400">{p.job.division}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.job.jobStatus} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(p.datePmtReceived)}</td>
                  <td className="px-4 py-3 font-mono font-medium whitespace-nowrap">{dollars(p.amountReceived)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{p.paidThruDate ? fmtDate(p.paidThruDate) : '—'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {p.job._count.projections > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mr-2">{p.job._count.projections} proj</span>
                    )}
                    <Link
                      href={`/jobs/${p.job.id}`}
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="text-gray-400 p-8">Loading…</div>}>
      <JobsContent />
    </Suspense>
  )
}

function StatusBadge({ status }: { status: string }) {
  return status === 'IN_PROGRESS'
    ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap">In Progress</span>
    : <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">Closed</span>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left whitespace-nowrap">
      {children}
    </th>
  )
}
