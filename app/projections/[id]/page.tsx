'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { dollars, fmtDate, toDateInput } from '@/lib/format'
import Link from 'next/link'

interface Projection {
  id: string; jobNumber: string; jobName: string; company: string; division: string
  monthYear: string; estimateNumber: string; billingPeriod: string
  estimatedAmountOwed: number; estimatedPaymentDate: string; isActive: boolean
  status: { id: string; name: string; color: string }
  notes: { id: string; content: string; createdAt: string }[]
  movements: { id: string; fromDate: string; toDate: string; reason: string | null; createdAt: string }[]
  job: { id: string } | null
}

interface Status { id: string; name: string; color: string }

export default function ProjectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [proj, setProj] = useState<Projection | null>(null)
  const [statuses, setStatuses] = useState<Status[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moveForm, setMoveForm] = useState({ toDate: '', reason: '' })
  const [moving, setMoving] = useState(false)
  const [showPaymentPanel, setShowPaymentPanel] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ date: '', amount: '' })
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')

  const fetch_ = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([
      fetch(`/api/projections/${id}`),
      fetch('/api/projection-statuses'),
    ])
    setProj(await pRes.json())
    setStatuses(await sRes.json())
    setLoading(false)
  }, [id])

  useEffect(() => { fetch_() }, [fetch_])

  useEffect(() => {
    if (proj) {
      const today = new Date()
      const todayStr = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0')
      setPaymentForm({
        date: todayStr,
        amount: (proj.estimatedAmountOwed / 100).toFixed(2),
      })
    }
  }, [proj])

  useEffect(() => {
    if (proj) setEditForm({
      monthYear: proj.monthYear,
      estimateNumber: proj.estimateNumber,
      billingPeriod: proj.billingPeriod,
      estimatedAmountOwed: (proj.estimatedAmountOwed / 100).toFixed(2),
      estimatedPaymentDate: toDateInput(proj.estimatedPaymentDate),
      statusId: proj.status.id,
    })
  }, [proj])

  const ef = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    await fetch(`/api/projections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editForm,
        estimatedAmountOwed: Math.round(parseFloat(editForm.estimatedAmountOwed) * 100),
      }),
    })
    setSaving(false)
    setEditing(false)
    fetch_()
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setAddingNote(true)
    await fetch(`/api/projections/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newNote }),
    })
    setNewNote('')
    setAddingNote(false)
    fetch_()
  }

  const handleMove = async () => {
    if (!moveForm.toDate) return
    setMoving(true)
    await fetch(`/api/projections/${id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(moveForm),
    })
    setMoving(false)
    setShowMoveModal(false)
    setMoveForm({ toDate: '', reason: '' })
    fetch_()
  }

  const handlePostPayment = async () => {
    setPosting(true)
    setPostError('')
    const res = await fetch(`/api/projections/${id}/post-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        datePmtReceived: paymentForm.date,
        amountReceived: Math.round(parseFloat(paymentForm.amount) * 100),
      }),
    })
    if (res.ok) {
      setShowPaymentPanel(false)
      fetch_()
    } else {
      const d = await res.json()
      setPostError(d.error ?? 'Failed to post payment')
    }
    setPosting(false)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this projection?')) return
    await fetch(`/api/projections/${id}`, { method: 'DELETE' })
    router.push('/projections')
  }

  if (loading) return <div className="text-gray-400 p-8">Loading…</div>
  if (!proj) return <div className="text-red-600 p-8">Projection not found</div>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/projections" className="text-sm text-gray-400 hover:text-gray-600">← Projections</Link>
        <span className="text-gray-300">/</span>
        <span className="font-mono text-sm text-gray-600">{proj.jobNumber}</span>
        <span className="text-gray-500">{proj.jobName}</span>
        {!proj.isActive && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inactive</span>}
      </div>

      {/* Header info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-lg text-gray-900">{proj.jobNumber}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: proj.status.color + '22', color: proj.status.color }}>
                {proj.status.name}
              </span>
              <span className="text-xs text-gray-400">{proj.division}</span>
            </div>
            <p className="text-gray-700 mt-1">{proj.jobName}</p>
            <p className="text-sm text-gray-400">{proj.company}</p>
          </div>
          <div className="flex gap-2">
            {proj.job && (
              <Link href={`/jobs/${proj.job.id}`} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-500">
                View Job →
              </Link>
            )}
            {!editing ? (
              <>
                <button
                  onClick={() => { setShowPaymentPanel(p => !p); setPostError('') }}
                  className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700"
                >
                  Post Payment
                </button>
                <button onClick={() => setEditing(true)} className="text-sm text-gray-500 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">Edit</button>
                <button onClick={() => setShowMoveModal(true)} className="text-sm bg-orange-50 text-orange-600 px-3 py-1.5 border border-orange-200 rounded-lg hover:bg-orange-100">Move Date</button>
                <button onClick={handleDelete} className="text-sm text-red-500 px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50">Delete</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(false)} className="text-sm text-gray-500 px-3 py-1.5 border border-gray-300 rounded-lg">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="text-sm bg-slate-900 text-white px-4 py-1.5 rounded-lg disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>

        {editing ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Month/Year"><input value={editForm.monthYear} onChange={e => ef('monthYear', e.target.value)} className="input" /></Field>
            <Field label="Est #"><input value={editForm.estimateNumber} onChange={e => ef('estimateNumber', e.target.value)} className="input" /></Field>
            <Field label="Billing Period"><input value={editForm.billingPeriod} onChange={e => ef('billingPeriod', e.target.value)} className="input" /></Field>
            <Field label="Est. Amount Owed ($)">
              <input type="number" step="0.01" value={editForm.estimatedAmountOwed} onChange={e => ef('estimatedAmountOwed', e.target.value)} className="input" />
            </Field>
            <Field label="Est. Payment Date">
              <input type="date" value={editForm.estimatedPaymentDate} onChange={e => ef('estimatedPaymentDate', e.target.value)} className="input" />
            </Field>
            <Field label="Status">
              <select value={editForm.statusId} onChange={e => ef('statusId', e.target.value)} className="input">
                {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Active">
              <select value={editForm.isActive ?? (proj.isActive ? 'true' : 'false')} onChange={e => ef('isActive', e.target.value)} className="input">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
          </div>
        ) : (
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <Pair label="Month/Year" value={proj.monthYear} />
            <Pair label="Est #" value={proj.estimateNumber} />
            <Pair label="Billing Period" value={proj.billingPeriod} />
            <Pair label="Est. Amount Owed" value={dollars(proj.estimatedAmountOwed)} mono />
            <Pair label="Est. Payment Date" value={fmtDate(proj.estimatedPaymentDate)} />
          </dl>
        )}
      </div>

      {/* Post payment panel */}
      {showPaymentPanel && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
          <h3 className="font-semibold text-green-900 mb-1">Post Payment</h3>
          <p className="text-xs text-green-700 mb-4">
            Creates a cash receipt on <span className="font-medium">{proj.jobNumber} — {proj.jobName}</span>. If the amount equals or exceeds the balance, the projection is marked Received. If less, it is marked Partial and the balance is updated automatically.
          </p>
          <div className="flex flex-wrap gap-4 items-end">
            <Field label="Date Received">
              <input
                type="date"
                value={paymentForm.date}
                onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))}
                className="input w-44"
              />
            </Field>
            <Field label="Amount Received ($)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={paymentForm.amount}
                onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                className="input w-44"
              />
            </Field>
            <div className="flex gap-2 items-center">
              <button
                onClick={handlePostPayment}
                disabled={posting || !paymentForm.date || !paymentForm.amount}
                className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {posting ? 'Posting…' : 'Confirm Payment'}
              </button>
              <button
                onClick={() => { setShowPaymentPanel(false); setPostError('') }}
                className="text-sm text-gray-500 px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
          {postError && <p className="text-xs text-red-600 mt-3">{postError}</p>}
        </div>
      )}

      {/* Communication log */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-4">Communication Log</h2>

        <div className="mb-4">
          <textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Add a note — contact info, email summary, payment status update…"
            className="input w-full"
            rows={3}
          />
          <button
            onClick={handleAddNote}
            disabled={addingNote || !newNote.trim()}
            className="mt-2 bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50"
          >
            {addingNote ? 'Adding…' : 'Add Note'}
          </button>
        </div>

        <div className="space-y-3">
          {proj.notes.length === 0 ? (
            <p className="text-gray-400 text-sm">No notes yet.</p>
          ) : proj.notes.map(note => (
            <div key={note.id} className="border-l-2 border-gray-200 pl-4 py-1">
              <p className="text-xs text-gray-400 mb-1">{new Date(note.createdAt).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Movement history */}
      {proj.movements.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Movement History</h2>
          <div className="space-y-2">
            {proj.movements.map(m => (
              <div key={m.id} className="flex items-start gap-3 text-sm">
                <span className="text-orange-500 mt-0.5">→</span>
                <div>
                  <span className="text-gray-500">{fmtDate(m.fromDate)}</span>
                  <span className="text-gray-300 mx-2">→</span>
                  <span className="text-gray-800 font-medium">{fmtDate(m.toDate)}</span>
                  {m.reason && <span className="text-gray-400 ml-2 text-xs">· {m.reason}</span>}
                  <span className="text-gray-300 ml-2 text-xs">{new Date(m.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Move date modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-gray-900 mb-4">Move to New Date</h3>
            <p className="text-sm text-gray-500 mb-4">Current date: <strong>{fmtDate(proj.estimatedPaymentDate)}</strong></p>
            <div className="space-y-4">
              <Field label="New Payment Date *">
                <input type="date" value={moveForm.toDate} onChange={e => setMoveForm(f => ({ ...f, toDate: e.target.value }))} className="input" />
              </Field>
              <Field label="Reason (optional)">
                <input value={moveForm.reason} onChange={e => setMoveForm(f => ({ ...f, reason: e.target.value }))} className="input" placeholder="e.g. Customer delayed, will pay next week" />
              </Field>
              <div className="flex gap-3 pt-2">
                <button onClick={handleMove} disabled={moving || !moveForm.toDate} className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm disabled:opacity-50">
                  {moving ? 'Moving…' : 'Move Date'}
                </button>
                <button onClick={() => setShowMoveModal(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
              </div>
            </div>
          </div>
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
