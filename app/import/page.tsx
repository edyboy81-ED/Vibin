'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'

interface ImportResult {
  stats: { jobsCreated: number; jobsUpdated: number; paymentsCreated: number; paymentsSkipped: number; rowsSkipped: number }
  errors: string[]
  excelDateWarnings: string[]
  totalRows: number
  detectedColumns: string[]
}

export default function ImportPage() {
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

    const res = await fetch('/api/import/jobs', { method: 'POST', body: formData })
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
        <Link href="/jobs" className="text-sm text-gray-400 hover:text-gray-600">← Cash Receipts</Link>
        <span className="text-gray-300">/</span>
        <span className="font-semibold text-gray-900">Import Jobs</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-1">Import from CSV</h2>
        <p className="text-sm text-gray-500 mb-5">
          Export your cash receipts spreadsheet as a CSV file and upload it here.
          The app will create all jobs and their most recent payment in one shot.
        </p>

        {/* Column guide */}
        <div className="bg-gray-50 rounded-lg p-4 mb-5 text-xs">
          <p className="font-medium text-gray-600 mb-2">Recognized column names (not case-sensitive):</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-500">
            <span><span className="font-mono text-gray-700">Job</span> or <span className="font-mono text-gray-700">Job #</span> — job number <span className="text-red-500">*required</span></span>
            <span><span className="font-mono text-gray-700">Job Name</span></span>
            <span><span className="font-mono text-gray-700">Company</span></span>
            <span><span className="font-mono text-gray-700">Customer</span></span>
            <span><span className="font-mono text-gray-700">Job Status</span> — In Progress / Closed</span>
            <span><span className="font-mono text-gray-700">Date Pmt Received</span></span>
            <span><span className="font-mono text-gray-700">Amount Received</span></span>
            <span><span className="font-mono text-gray-700">Paid Thru Date</span></span>
            <span><span className="font-mono text-gray-700">Billed Thru Date</span></span>
            <span><span className="font-mono text-gray-700">Next Amount Due</span></span>
            <span><span className="font-mono text-gray-700">Notes</span></span>
          </div>
          <p className="text-gray-400 mt-2">Extra columns (like "Days Last Paid") are safely ignored.</p>
        </div>

        {/* Drop zone */}
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

        {/* Results */}
        {result && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-green-600 text-lg">✓</span>
              <span className="font-semibold text-gray-900">Import complete</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <StatCard label="Jobs Created" value={result.stats.jobsCreated} color="text-green-700" />
              <StatCard label="Jobs Updated" value={result.stats.jobsUpdated} color="text-blue-700" />
              <StatCard label="Payments Created" value={result.stats.paymentsCreated} color="text-green-700" />
              <StatCard label="Payments Skipped" value={result.stats.paymentsSkipped} color="text-gray-500" note="already existed" />
              <StatCard label="Rows Skipped" value={result.stats.rowsSkipped} color="text-gray-500" note="no job number" />
              <StatCard label="Total Rows" value={result.totalRows} color="text-gray-700" />
            </div>

            <div className="text-xs text-gray-400 mb-4">
              Columns matched: {result.detectedColumns.join(', ')}
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

            <div className="flex gap-3">
              <Link href="/jobs" className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm hover:bg-slate-700">
                View Jobs →
              </Link>
              <button onClick={reset} className="text-sm text-gray-500 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Import Another File
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">Tips for exporting from Excel</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-700 text-xs">
          <li>Open your cash receipts spreadsheet</li>
          <li>File → Save As → choose "CSV UTF-8 (Comma delimited) (*.csv)"</li>
          <li>If your spreadsheet has multiple sheets, export the one with the job list</li>
          <li>Dollar amounts can include $ signs and commas — the importer handles them</li>
          <li>Dates in M/D/YYYY format are supported</li>
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
