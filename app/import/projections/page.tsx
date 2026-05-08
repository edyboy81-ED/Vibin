'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { dollars, fmtDate } from '@/lib/format'
import { ALL_COMPANIES, getDivision } from '@/lib/companies'

interface UnmatchedRow {
  rowIndex: number
  jobNumber: string
  jobName: string
  company: string
  estimateNumber: string
  billingPeriod: string
  monthYear: string
  estimatedAmountOwed: number
  estimatedPaymentDate: string
  statusId: string
  statusName: string
  notes: string | null
}

interface ImportResult {
  stats: { created: number; updated: number; skipped: number; rowsSkipped: number }
  excelDateWarnings: string[]
  errors: string[]
  unmatched: UnmatchedRow[]
  totalRows: number
  detectedColumns: string[]
}

interface CreateJobsResult {
  stats: { jobsCreated: number; projectionsCreated: number; skipped: number }
  errors: string[]
}

// Editable state for each unmatched row
interface EditableRow extends UnmatchedRow {
  selected: boolean
  editJobName: string
  editCompany: string
}

export default function ImportProjectionsPage() {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [editableRows, setEditableRows] = useState<EditableRow[]>([])
  const [creating, setCreating] = useState(false)
  const [createResult, setCreateResult] = useState<CreateJobsResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.csv')) { setError('Please select a .csv file.'); return }
    setFile(f)
    setResult(null)
    setError('')
    setEditableRows([])
    setCreateResult(null)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  const handleImport = async () => {
    if (!file) return
    setUploading(true)
    setError('')
    setResult(null)
    setEditableRows([])
    setCreateResult(null)

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/import/projections', { method: 'POST', body: formData })
    const data = await res.json()
    setUploading(false)

    if (!res.ok) {
      setError(data.error ?? 'Import failed')
    } else {
      setResult(data)
      if (data.unmatched?.length) {
        setEditableRows(data.unmatched.map((r: UnmatchedRow) => ({
          ...r,
          selected: true,
          editJobName: r.jobName,
          editCompany: r.company || 'Johnson Bros Corporation',
        })))
      }
    }
  }

  const updateRow = (index: number, patch: Partial<EditableRow>) => {
    setEditableRows(rows => rows.map((r, i) => i === index ? { ...r, ...patch } : r))
  }

  const handleCreateJobs = async () => {
    const selected = editableRows.filter(r => r.selected)
    if (!selected.length) return
    setCreating(true)

    const rows = selected.map(r => ({
      jobNumber: r.jobNumber,
      jobName: r.editJobName,
      company: r.editCompany,
      estimateNumber: r.estimateNumber,
      billingPeriod: r.billingPeriod,
      monthYear: r.monthYear,
      estimatedAmountOwed: r.estimatedAmountOwed,
      estimatedPaymentDate: r.estimatedPaymentDate,
      statusId: r.statusId,
      notes: r.notes,
    }))

    const res = await fetch('/api/import/projections/create-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    })
    const data = await res.json()
    setCreateResult(data)
    setCreating(false)
    // Remove successfully processed rows
    if (data.stats.projectionsCreated > 0 || data.stats.skipped > 0) {
      setEditableRows(rows => rows.filter(r => !r.selected))
    }
  }

  const reset = () => {
    setFile(null)
    setResult(null)
    setError('')
    setEditableRows([])
    setCreateResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const selectedCount = editableRows.filter(r => r.selected).length

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/projections" className="text-sm text-gray-400 hover:text-gray-600">← Projections</Link>
        <span className="text-gray-300">/</span>
        <span className="font-semibold text-gray-900">Import Projections</span>
      </div>

      {/* Upload card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-1">Import from CSV</h2>
        <p className="text-sm text-gray-500 mb-5">
          Each row becomes one projection. If a job doesn't exist yet, you'll be prompted to create it.
        </p>

        {/* Column guide */}
        <div className="bg-gray-50 rounded-lg p-4 mb-5 text-xs">
          <p className="font-medium text-gray-600 mb-2">Recognized column names (not case-sensitive):</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-500">
            <span><span className="font-mono text-gray-700">Job</span> or <span className="font-mono text-gray-700">Job #</span> — job number <span className="text-red-500">*required</span></span>
            <span><span className="font-mono text-gray-700">Expected Payment Date</span> <span className="text-red-500">*required</span></span>
            <span><span className="font-mono text-gray-700">Amount Owed</span> or <span className="font-mono text-gray-700">Estimated Amount</span> <span className="text-red-500">*required</span></span>
            <span><span className="font-mono text-gray-700">Estimate #</span> or <span className="font-mono text-gray-700">Est #</span></span>
            <span><span className="font-mono text-gray-700">Billing Period</span> — e.g. 2/1/26–2/28/26</span>
            <span><span className="font-mono text-gray-700">Month/Year</span> — e.g. 04/2026</span>
            <span><span className="font-mono text-gray-700">Job Name</span> — used when creating new jobs</span>
            <span><span className="font-mono text-gray-700">Company</span> — used when creating new jobs</span>
            <span><span className="font-mono text-gray-700">Status</span> — defaults to Projected</span>
            <span><span className="font-mono text-gray-700">Notes</span></span>
          </div>
          <p className="text-gray-400 mt-2">Existing projections (same job + estimate #) are updated automatically. New ones are created.</p>
        </div>

        {!result && (
          <>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                dragging ? 'border-blue-400 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
              {file ? (
                <>
                  <p className="text-green-700 font-medium">{file.name}</p>
                  <p className="text-sm text-green-600 mt-1">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                </>
              ) : (
                <>
                  <p className="text-gray-500 font-medium">Drop your CSV file here</p>
                  <p className="text-sm text-gray-400 mt-1">or click to browse</p>
                </>
              )}
            </div>

            {error && (
              <pre className="mt-3 text-red-600 text-sm whitespace-pre-wrap bg-red-50 rounded-lg p-3">{error}</pre>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleImport}
                disabled={!file || uploading}
                className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
              >
                {uploading ? 'Importing…' : 'Import'}
              </button>
              {file && (
                <button onClick={reset} className="text-sm text-gray-500 px-4 py-2">Clear</button>
              )}
            </div>
          </>
        )}

        {result && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-green-600 text-lg">✓</span>
              <span className="font-semibold text-gray-900">Initial import complete</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <StatCard label="Projections Created" value={result.stats.created} color="text-green-700" />
              <StatCard label="Projections Updated" value={result.stats.updated} color="text-blue-700" />
              <StatCard label="No Changes" value={result.stats.skipped} color="text-gray-500" note="already up to date" />
              <StatCard label="Rows Skipped" value={result.stats.rowsSkipped} color="text-gray-500" note="missing data" />
              <StatCard label="Jobs Not Found" value={result.unmatched?.length ?? 0} color={result.unmatched?.length ? 'text-orange-600' : 'text-gray-500'} note="see below" />
            </div>

            {result.excelDateWarnings?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-red-800 mb-1">⚠️ Excel date formatting detected — these rows were skipped:</p>
                {result.excelDateWarnings.map((w, i) => <p key={i} className="text-xs text-red-700">{w}</p>)}
                <p className="text-xs text-red-600 mt-2 font-medium">Fix: In Excel, select the Job # column → right-click → Format Cells → Text → re-enter the job numbers → re-export as CSV.</p>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-yellow-800 mb-1">Some rows had issues:</p>
                {result.errors.map((e, i) => <p key={i} className="text-xs text-yellow-700">{e}</p>)}
              </div>
            )}

            {!editableRows.length && (
              <div className="flex gap-3 mt-2">
                <Link href="/projections" className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm hover:bg-slate-700">
                  View Projections →
                </Link>
                <button onClick={reset} className="text-sm text-gray-500 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Import Another File
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unmatched rows — job creation step */}
      {editableRows.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-200 p-6 mb-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className="font-semibold text-gray-900">Jobs Not Found — Review & Create</h2>
              <p className="text-sm text-gray-500 mt-1">
                These rows couldn't be matched to an existing job. Review the details, fill in any missing fields, then create the jobs and projections together.
              </p>
            </div>
            <span className="text-sm text-orange-600 font-medium bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
              {editableRows.length} row{editableRows.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Select all */}
          <div className="flex items-center gap-2 mb-4 pt-3 border-t border-gray-100">
            <input
              type="checkbox"
              id="select-all"
              checked={editableRows.every(r => r.selected)}
              onChange={e => setEditableRows(rows => rows.map(r => ({ ...r, selected: e.target.checked })))}
              className="rounded"
            />
            <label htmlFor="select-all" className="text-xs text-gray-500 cursor-pointer">Select all</label>
          </div>

          <div className="space-y-4">
            {editableRows.map((row, i) => (
              <div key={row.rowIndex} className={`rounded-lg border p-4 transition-colors ${row.selected ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={e => updateRow(i, { selected: e.target.checked })}
                    className="mt-1 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    {/* Projection context (read-only) */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-gray-500">
                      <span className="font-mono font-bold text-gray-800">{row.jobNumber}</span>
                      <span>Est #{row.estimateNumber}</span>
                      <span>{fmtDate(row.estimatedPaymentDate)}</span>
                      <span className="font-mono font-medium text-gray-700">{dollars(row.estimatedAmountOwed)}</span>
                      {row.billingPeriod !== '—' && <span>{row.billingPeriod}</span>}
                      <span className="text-orange-600">{row.statusName}</span>
                    </div>

                    {/* Editable job fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Job Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={row.editJobName}
                          onChange={e => updateRow(i, { editJobName: e.target.value })}
                          placeholder="Enter job name"
                          className="input text-sm"
                          disabled={!row.selected}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Company <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={row.editCompany}
                          onChange={e => updateRow(i, { editCompany: e.target.value })}
                          className="input text-sm"
                          disabled={!row.selected}
                        >
                          {ALL_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Division</label>
                        <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-500">
                          {getDivision(row.editCompany) === 'LEGACY' ? 'Legacy' : 'AB'}
                        </div>
                      </div>
                    </div>

                    {row.notes && (
                      <p className="mt-2 text-xs text-gray-400 italic">Note: {row.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {createResult && (
            <div className={`mt-4 rounded-lg p-3 ${createResult.errors.length ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
              <p className="text-sm font-medium text-gray-800 mb-1">
                {createResult.stats.jobsCreated} job{createResult.stats.jobsCreated !== 1 ? 's' : ''} created,{' '}
                {createResult.stats.projectionsCreated} projection{createResult.stats.projectionsCreated !== 1 ? 's' : ''} added
                {createResult.stats.skipped > 0 && `, ${createResult.stats.skipped} duplicate${createResult.stats.skipped !== 1 ? 's' : ''} skipped`}
              </p>
              {createResult.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}

          <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-100">
            <button
              onClick={handleCreateJobs}
              disabled={creating || selectedCount === 0}
              className="bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
            >
              {creating ? 'Creating…' : `Create ${selectedCount} Job${selectedCount !== 1 ? 's' : ''} & Import Projections`}
            </button>
            {createResult && !editableRows.filter(r => r.selected).length && (
              <Link href="/projections" className="text-sm text-blue-600 hover:underline">
                View Projections →
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">Tips</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-700 text-xs">
          <li>Include a "Job Name" and "Company" column to pre-fill new job details automatically</li>
          <li>Status values must match exactly: Projected, Partial, Received, etc.</li>
          <li>Dates in M/D/YYYY format are supported</li>
          <li>Dollar amounts can include $ signs and commas</li>
          <li>If Month/Year is omitted, it is derived from the payment date</li>
        </ol>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, note }: { label: string; value: number; color: string; note?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</p>
      <p className={`text-2xl font-bold font-mono mt-0.5 ${color}`}>{value}</p>
      {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
    </div>
  )
}
