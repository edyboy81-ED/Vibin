'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

interface ImportResult {
  stats: { updated: number; notFound: number; projectionsUpdated: number }
  notFound: string[]
  totalRows: number
}

export default function SuretyImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError('')
    setResult(null)

    const fd = new FormData()
    fd.append('file', file)

    const res = await fetch('/api/admin/surety-import', { method: 'POST', body: fd })
    setUploading(false)

    if (res.ok) {
      setResult(await res.json())
    } else {
      const d = await res.json()
      setError(d.error ?? 'Import failed')
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="text-sm text-gray-400 hover:text-gray-600">← Settings</Link>
        <span className="text-gray-300">/</span>
        <span className="font-semibold text-gray-900">Bulk Surety Assignment</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Assign Surety to Jobs</h1>
        <p className="text-sm text-gray-500 mb-5">
          Upload a CSV with two columns — <span className="font-mono text-xs bg-gray-100 px-1 rounded">Job #</span> and <span className="font-mono text-xs bg-gray-100 px-1 rounded">Surety</span> — to bulk-assign surety bonds to existing jobs.
          Each job's active projections will be updated automatically.
          Moving forward, surety is assigned automatically when projections are imported from the weekly CSV.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-5 text-sm">
          <p className="font-medium text-gray-700 mb-2">Expected CSV format</p>
          <pre className="text-xs font-mono text-gray-600 overflow-x-auto">{`Job #,Surety
50-1028,Zurich
50-1029,Berkshire
50-1030,Markel
50-1031,Unbonded`}</pre>
          <p className="text-xs text-gray-400 mt-2">Accepted surety values: Zurich, Berkshire, Markel, Unbonded (case-insensitive)</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">CSV File</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-900 file:text-white hover:file:bg-slate-700 cursor-pointer"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={!file || uploading}
            className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
          >
            {uploading ? 'Importing…' : 'Import & Assign'}
          </button>
        </form>
      </div>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <h2 className="font-semibold text-green-900 mb-3">Import Complete</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <dt className="text-xs text-green-600 uppercase tracking-wide font-medium mb-1">Rows in file</dt>
              <dd className="text-2xl font-bold text-green-900">{result.totalRows}</dd>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <dt className="text-xs text-green-600 uppercase tracking-wide font-medium mb-1">Jobs updated</dt>
              <dd className="text-2xl font-bold text-green-900">{result.stats.updated}</dd>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <dt className="text-xs text-green-600 uppercase tracking-wide font-medium mb-1">Projections updated</dt>
              <dd className="text-2xl font-bold text-green-900">{result.stats.projectionsUpdated}</dd>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <dt className="text-xs text-green-600 uppercase tracking-wide font-medium mb-1">Jobs not found</dt>
              <dd className="text-2xl font-bold text-green-900">{result.stats.notFound}</dd>
            </div>
          </dl>
          {result.notFound.length > 0 && (
            <div>
              <p className="text-sm font-medium text-green-800 mb-1">Job numbers not found in the system:</p>
              <p className="text-xs font-mono text-green-700 bg-white border border-green-100 rounded-lg p-3 break-all">
                {result.notFound.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
