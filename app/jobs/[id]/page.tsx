'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { dollars, fmtDate, toDateInput, daysSince } from '@/lib/format'
import { ALL_COMPANIES } from '@/lib/companies'
import Link from 'next/link'

interface Job {
  id: string; jobNumber: string; jobName: string; company: string
  division: string; jobStatus: string; paidThruDate: string | null
  billedThruDate: string | null; nextAmountDue: number | null; notes: string | null
  payments: Payment[]
  projections: Projection[]
}

interface Payment {
  id: string; datePmtReceived: string; amountReceived: number
  paidThruDate: string | null; notes: string | null; createdAt: string
}

interface Projection {
  id: string; estimateNumber: string; estimatedAmountOwed: number
  estimatedPaymentDate: string; status: { id: string; name: string; color: string }
}

interface ProjectionStatus { id: string; name: string; color: string }

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [statuses, setStatuses] = useState<ProjectionStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [showPayForm, setShowPayForm] = useState(false)
  const [payForm, setPayForm] = useState({ datePmtReceived: '', amountReceived: '', paidThruDate: '', notes: '' })
  const [payResult, setPayResult] = useState<{ activeProjections: Projection[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchJob = useCallback(async () => {
    const [jobRes, statusRes] = await Promise.all([
      fetch(`/api/jobs/${id}`),
      fetch('/api/projection-statuses'),
    ])
    setJob(await jobRes.json())
    setStatuses(await statusRes.json())
    setLoading(false)
  }, [id])

  useEffect(() => { fetchJob() }, [fetchJob])

  useEffect(() => {
    if (job) setEditForm({
      jobName: job.jobName, company: job.company, jobStatus: job.jobStatus,
      paidThruDate: toDateInput(job.paidThruDate), billedThruDate: toDateInput(job.billedThruDate),
      nextAmountDue: job.nextAmountDue != null ? (job.nextAmountDue / 100).toFixed(2) : '',
      notes: job.notes ?? '',
    })
  }, [job])

  const handleSaveJob = async () => {
    setSaving(true)
    await fetch(`/api/jobs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editForm,
        nextAmountDue: editForm.nextAmountDue ? Math.round(parseFloat(editForm.nextAmountDue) * 100) : null,
      }),
    })
    setSaving(false)
    setEditing(false)
    fetchJob()
  }

  const handleLogPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch(`/api/jobs/${id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        datePmtReceived: payForm.datePmtReceived,
        amountReceived: Math.round(parseFloat(payForm.amountReceived) * 100),
        paidThruDate: payForm.paidThruDate || null,
        notes: payForm.notes || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json()
      setPayForm({ datePmtReceived: '', amountReceived: '', paidThruDate: '', notes: '' })
      setShowPayForm(false)
      setPayResult(data)
      fetchJob()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Failed to log payment')
    }
  }

  const handleUpdateProjectionStatus = async (projId: string, statusId: string) => {
    await fetch(`/api/projections/${projId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusId }),
    })
    setPayResult(null)
    fetchJob()
  }

  const handleDelete = async () => {
    if (!confirm(`Delete job ${job?.jobNumber}? This will also delete all payment history.`)) return
    await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    router.push('/jobs')
  }

  if (loading) return <div className="text-gray-400 p-8">Loading…</div>
  if (!job) return <div className="text-red-600 p-8">Job not found</div>

  const ef = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }))

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/jobs" className="text-sm text-gray-400 hover:text-gray-600">← Cash Receipts</Link>
        <span className="text-gray-300">/</span>
        <span className="font-mono font-bold text-gray-900">{job.jobNumber}</span>
        <span className="text-gray-500">{job.jobName}</span>
      </div>

      {/* Job details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="font-semibold text-gray-900">Job Details</h2>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="text-sm text-gray-500 px-3 py-1.5 border border-gray-300 rounded-lg">Cancel</button>
                <button onClick={handleSaveJob} disabled={saving} className="text-sm bg-slate-900 text-white px-4 py-1.5 rounded-lg disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="text-sm text-gray-500 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">Edit</button>
                <button onClick={handleDelete} className="text-sm text-red-500 px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50">Delete</button>
              </>
            )}
          </div>
        </div>

        {editing ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Job Name"><input value={editForm.jobName} onChange={e => ef('jobName', e.target.value)} className="input" /></Field>
            <Field label="Company">
              <select value={editForm.company} onChange={e => ef('company', e.target.value)} className="input">
                {ALL_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={editForm.jobStatus} onChange={e => ef('jobStatus', e.target.value)} className="input">
                <option value="IN_PROGRESS">In Progress</option>
                <option value="CLOSED">Closed</option>
              </select>
            </Field>
            <Field label="Paid Thru Date"><input type="date" value={editForm.paidThruDate} onChange={e => ef('paidThruDate', e.target.value)} className="input" /></Field>
            <Field label="Billed Thru Date"><input type="date" value={editForm.billedThruDate} onChange={e => ef('billedThruDate', e.target.value)} className="input" /></Field>
            <Field label="Next Amount Due ($)"><input type="number" step="0.01" value={editForm.nextAmountDue} onChange={e => ef('nextAmountDue', e.target.value)} className="input" /></Field>
            <div className="col-span-full">
              <Field label="Notes"><textarea value={editForm.notes} onChange={e => ef('notes', e.target.value)} className="input" rows={2} /></Field>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <Pair label="Job #" value={job.jobNumber} mono />
            <Pair label="Job Name" value={job.jobName} />
            <Pair label="Company" value={job.company} />
            <Pair label="Division" value={job.division} />
            <Pair label="Status" value={job.jobStatus === 'IN_PROGRESS' ? 'In Progress' : 'Closed'} />
            <Pair label="Paid Thru Date" value={fmtDate(job.paidThruDate)} />
            <Pair label="Billed Thru Date" value={fmtDate(job.billedThruDate)} />
            <Pair label="Next Amount Due" value={job.nextAmountDue ? dollars(job.nextAmountDue) : '—'} mono />
            {job.notes && <div className="col-span-full"><Pair label="Notes" value={job.notes} /></div>}
          </dl>
        )}
      </div>

      {/* Active projections notice */}
      {payResult?.activeProjections && payResult.activeProjections.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-yellow-800 mb-3">
            Payment logged. This job has active projections — update their status:
          </p>
          {payResult.activeProjections.map(p => (
            <div key={p.id} className="flex items-center gap-3 mb-2">
              <span className="text-sm text-yellow-700">Est #{p.estimateNumber} · {dollars(p.estimatedAmountOwed)} · due {fmtDate(p.estimatedPaymentDate)}</span>
              <select
                defaultValue={p.status.id}
                onChange={e => handleUpdateProjectionStatus(p.id, e.target.value)}
                className="text-xs border border-yellow-300 rounded px-2 py-1"
              >
                {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          ))}
          <button onClick={() => setPayResult(null)} className="text-xs text-yellow-600 mt-2">Dismiss</button>
        </div>
      )}

      {/* Log payment */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-900">Payment History</h2>
          <button
            onClick={() => setShowPayForm(f => !f)}
            className="text-sm bg-slate-900 text-white px-4 py-1.5 rounded-lg hover:bg-slate-700"
          >
            {showPayForm ? 'Cancel' : '+ Log Payment'}
          </button>
        </div>

        {showPayForm && (
          <form onSubmit={handleLogPayment} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pb-6 border-b border-gray-100">
            {error && <p className="col-span-full text-red-600 text-sm">{error}</p>}
            <Field label="Date Received *">
              <input type="date" value={payForm.datePmtReceived} onChange={e => setPayForm(f => ({ ...f, datePmtReceived: e.target.value }))} className="input" required />
            </Field>
            <Field label="Amount Received ($) *">
              <input type="number" step="0.01" min="0" value={payForm.amountReceived} onChange={e => setPayForm(f => ({ ...f, amountReceived: e.target.value }))} className="input" required placeholder="0.00" />
            </Field>
            <Field label="Paid Thru Date">
              <input type="date" value={payForm.paidThruDate} onChange={e => setPayForm(f => ({ ...f, paidThruDate: e.target.value }))} className="input" />
            </Field>
            <Field label="Notes">
              <input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} className="input" placeholder="Optional" />
            </Field>
            <div className="col-span-full">
              <button type="submit" disabled={saving} className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm disabled:opacity-50">
                {saving ? 'Logging…' : 'Log Payment'}
              </button>
            </div>
          </form>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <Th>Date Received</Th>
              <Th right>Amount</Th>
              <Th>Paid Thru</Th>
              <Th right>Days Since Prev</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {job.payments.length === 0 ? (
              <tr><td colSpan={5} className="py-6 text-center text-gray-400">No payments logged yet.</td></tr>
            ) : job.payments.map((p, i) => {
              const prev = job.payments[i + 1]
              const daysBetween = prev
                ? Math.floor((new Date(p.datePmtReceived).getTime() - new Date(prev.datePmtReceived).getTime()) / 86_400_000)
                : daysSince(p.datePmtReceived)
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="py-3 pr-4">{fmtDate(p.datePmtReceived)}</td>
                  <td className="py-3 pr-4 text-right font-mono">{dollars(p.amountReceived)}</td>
                  <td className="py-3 pr-4 text-gray-500">{fmtDate(p.paidThruDate)}</td>
                  <td className="py-3 pr-4 text-right text-gray-500">{daysBetween ?? '—'}</td>
                  <td className="py-3 text-gray-500 text-xs">{p.notes ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Active projections */}
      {job.projections.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Active Projections</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <Th>Est #</Th>
                <Th right>Amount</Th>
                <Th>Est. Payment Date</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {job.projections.map(p => (
                <tr key={p.id}>
                  <td className="py-3 pr-4 font-mono text-xs">{p.estimateNumber}</td>
                  <td className="py-3 pr-4 text-right font-mono">{dollars(p.estimatedAmountOwed)}</td>
                  <td className="py-3 pr-4">{fmtDate(p.estimatedPaymentDate)}</td>
                  <td className="py-3 pr-4">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: p.status.color + '22', color: p.status.color }}>
                      {p.status.name}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <Link href={`/projections/${p.id}`} className="text-xs text-blue-600 hover:underline">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}

function Pair({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</dt>
      <dd className={`mt-0.5 text-gray-800 ${mono ? 'font-mono' : ''}`}>{value || '—'}</dd>
    </div>
  )
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide ${right ? 'text-right' : 'text-left'}`}>{children}</th>
}
