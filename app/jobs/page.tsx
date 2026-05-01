'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { dollars, fmtDate, daysSince } from '@/lib/format'
import { ALL_COMPANIES } from '@/lib/companies'
import Link from 'next/link'

interface Job {
  id: string
  jobNumber: string
  jobName: string
  company: string
  division: string
  customer: string | null
  jobStatus: string
  paidThruDate: string | null
  billedThruDate: string | null
  nextAmountDue: number | null
  payments: { datePmtReceived: string; amountReceived: number }[]
  _count: { projections: number }
}

const BLANK = { jobNumber: '', jobName: '', company: 'Johnson Bros Corporation', customer: '', jobStatus: 'IN_PROGRESS', nextAmountDue: '' }

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterDivision, setFilterDivision] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const fetchJobs = useCallback(async () => {
    const res = await fetch('/api/jobs')
    setJobs(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return jobs.filter(j => {
      if (q && !j.jobNumber.toLowerCase().includes(q) && !j.jobName.toLowerCase().includes(q)) return false
      if (filterCompany && j.company !== filterCompany) return false
      if (filterDivision && j.division !== filterDivision) return false
      if (filterStatus && j.jobStatus !== filterStatus) return false
      return true
    })
  }, [jobs, search, filterCompany, filterDivision, filterStatus])

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
    if (res.ok) { setForm(BLANK); setShowForm(false); fetchJobs() }
    else { const d = await res.json(); setError(d.error ?? 'Failed') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Cash Receipts</h1>
        <div className="flex gap-2">
          <Link
            href="/import"
            className="text-sm border border-gray-300 bg-white px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Import CSV
          </Link>
          <a
            href="/api/jobs/export"
            className="text-sm border border-gray-300 bg-white px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
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

      {/* Add form */}
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
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search job # or name…"
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

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
          {filtered.length} of {jobs.length} jobs
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <Th w="w-[8%]">Job #</Th>
                <Th w="w-[18%]">Job Name</Th>
                <Th w="w-[16%]">Company</Th>
                <Th w="w-[10%]">Status</Th>
                <Th w="w-[12%]">Last Payment</Th>
                <Th w="w-[10%]">Days Since</Th>
                <Th w="w-[13%]">Amount Received</Th>
                <Th w="w-[10%]">Next Due</Th>
                <Th w="w-[3%]"></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No jobs found.</td></tr>
              ) : filtered.map(job => {
                const latest = job.payments[0]
                const days = latest ? daysSince(latest.datePmtReceived) : null
                return (
                  <tr key={job.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => window.location.href = `/jobs/${job.id}`}>
                    <td className="px-4 py-3 font-mono text-xs font-medium">{job.jobNumber}</td>
                    <td className="px-4 py-3 truncate">
                      <div className="text-gray-800 truncate">{job.jobName}</div>
                      {job.customer && <div className="text-xs text-gray-400 truncate">{job.customer}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-600 truncate">{job.company}</div>
                      <div className="text-xs text-gray-400">{job.division}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.jobStatus} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{latest ? fmtDate(latest.datePmtReceived) : '—'}</td>
                    <td className={`px-4 py-3 text-xs font-mono ${days != null && days > 90 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                      {days != null ? days : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{latest ? dollars(latest.amountReceived) : '—'}</td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-500">{job.nextAmountDue ? dollars(job.nextAmountDue) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {job._count.projections > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{job._count.projections} proj</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return status === 'IN_PROGRESS'
    ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">In Progress</span>
    : <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Closed</span>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Th({ children, w }: { children?: React.ReactNode; w?: string }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left ${w ?? ''}`}>
      {children}
    </th>
  )
}
