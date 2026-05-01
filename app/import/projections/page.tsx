'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'

interface ImportResult {
  stats: { created: number; skipped: number; rowsSkipped: number }
  errors: string[]
  totalRows: number
  detectedColumns: string[]
}

export default function ImportProjectionsPage() {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.csv')) { setError('Please select a .csv file.'); return }
    setFile(f)
    setResult(null)
    setError('')
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

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/import/projections', { method: 'POST', body: formData })
    const data = await res.json()
    setUploading(false)

    if (!res.ok) {
      setError(data.error ?? 'Import failed')
      if (data.detectedColumns) {
        setError(prev => prev + `\n\nDetected columns: ${data.detectedColumns.join(', ')}`)
      }
    } else {
      setResult(data)
    }
  }

  const reset = () => {
    setFile(null)
    setResult(null)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/projections" className="text-sm text-gray-400 hover:text-gray-600">← Projections</Link>
        <span className="text-gray-300">/</span>
        <span className="font-semibold text-gray-900">Import Projections</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-1">Import from CSV</h2>
        <p className="text-sm text-gray-500 mb-5">
          Each row becomes one projection. Jobs must already exist in the system — import jobs first if needed.
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
            <span><span className="font-mono text-gray-700">Status</span> — defaults to Projected</span>
            <span><span className="font-mono text-gray-700">Notes</span></span>
          </div>
          <p className="text-gray-400 mt-2">Duplicate rows (same job + estimate # + date) are skipped automatically.</p>
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
              <span className="font-semibold text-gray-900">Import complete</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <StatCard label="Projections Created" value={result.stats.created} color="text-green-700" />
              <StatCard label="Duplicates Skipped" value={result.stats.skipped} color="text-gray-500" note="already existed" />
              <StatCard label="Rows Skipped" value={result.stats.rowsSkipped} color="text-gray-500" note="missing data / no job" />
              <StatCard label="Total Rows" value={result.totalRows} color="text-gray-700" />
            </div>

            <div className="text-xs text-gray-400 mb-4">
              Columns matched: {result.detectedColumns.join(', ')}
            </div>

            {result.errors.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-yellow-800 mb-1">Some rows had issues:</p>
                {result.errors.map((e, i) => <p key={i} className="text-xs text-yellow-700">{e}</p>)}
              </div>
            )}

            <div className="flex gap-3">
              <Link href="/projections" className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm hover:bg-slate-700">
                View Projections →
              </Link>
              <button onClick={reset} className="text-sm text-gray-500 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Import Another File
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">Tips</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-700 text-xs">
          <li>Job numbers in the CSV must match jobs already in the system</li>
          <li>Status values must match exactly: Projected, Partial, Paid, etc.</li>
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
