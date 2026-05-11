'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { dollars, fmtDate } from '@/lib/format'

function getThisWeek() {
  const today = new Date()
  const day = today.getDay()
  const diffToMon = (day === 0 ? -6 : 1 - day)
  const mon = new Date(today); mon.setDate(today.getDate() + diffToMon)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { from: fmt(mon), to: fmt(sun) }
}
import { ALL_COMPANIES } from '@/lib/companies'
import Link from 'next/link'

interface Projection {
  id: string; jobNumber: string; jobName: string; company: string
  division: string; estimateNumber: string; estimatedAmountOwed: number
  estimatedPaymentDate: string; monthYear: string; billingPeriod: string
  isActive: boolean
  status: { id: string; name: string; color: string }
  notes: { content: string; createdAt: string }[]
}

interface Status { id: string; name: string; color: string }

function ProjectionsContent() {
  const searchParams = useSearchParams()
  const [projections, setProjections] = useState<Projection[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDivision, setFilterDivision] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState(searchParams.get('dateFrom') ?? '')
  const [filterDateTo, setFilterDateTo] = useState(searchParams.get('dateTo') ?? '')
  const [showInactive, setShowInactive] = useState(false)

  const fetchData = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([
      fetch('/api/projections'),
      fetch('/api/projection-statuses'),
    ])
    setProjections(await pRes.json())
    setStatuses(await sRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Resolve statusName URL param to a status ID once statuses are loaded
  useEffect(() => {
    const statusName = searchParams.get('statusName')
    if (statusName && statuses.length > 0) {
      const match = statuses.find(s => s.name.toLowerCase() === statusName.toLowerCase())
      if (match) setFilterStatus(match.id)
    }
  }, [statuses, searchParams])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const from = filterDateFrom ? new Date(filterDateFrom) : null
    const to = filterDateTo ? new Date(filterDateTo + 'T23:59:59') : null
    const excludeStatus = searchParams.get('excludeStatus')?.toLowerCase() ?? null
    return projections.filter(p => {
      if (!showInactive && !p.isActive) return false
      if (q && !p.jobNumber.toLowerCase().includes(q) && !p.jobName.toLowerCase().includes(q)) return false
      if (filterDivision && p.division !== filterDivision) return false
      if (filterStatus && p.status.id !== filterStatus) return false
      if (filterCompany && p.company !== filterCompany) return false
      if (excludeStatus && p.status.name.toLowerCase() === excludeStatus) return false
      if (from || to) {
        const d = new Date(p.estimatedPaymentDate)
        if (from && d < from) return false
        if (to && d > to) return false
      }
      return true
    })
  }, [projections, search, filterDivision, filterStatus, filterCompany, showInactive, filterDateFrom, filterDateTo, searchParams])

  // Group by payment date
  const grouped = useMemo(() => {
    const map = new Map<string, { date: string; items: Projection[] }>()
    for (const p of filtered) {
      const key = fmtDate(p.estimatedPaymentDate)
      if (!map.has(key)) map.set(key, { date: key, items: [] })
      map.get(key)!.items.push(p)
    }
    return Array.from(map.values()).sort((a, b) =>
      new Date(a.items[0].estimatedPaymentDate).getTime() - new Date(b.items[0].estimatedPaymentDate).getTime()
    )
  }, [filtered])

  const totalFiltered = filtered.reduce((s, p) => s + p.estimatedAmountOwed, 0)
  const hasDateFilter = filterDateFrom || filterDateTo

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projections</h1>
          {!loading && (
            <p className="text-sm text-gray-400 mt-1">
              {filtered.length} projections · {dollars(totalFiltered)} total
              {hasDateFilter && <span className="ml-2 text-blue-600 font-medium">· filtered by date</span>}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/import/projections" className="text-sm border border-gray-300 bg-white px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            Import CSV
          </Link>
          <Link href="/projections/new" className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors">
            + Add Projection
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-2 flex-wrap items-center">
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
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input w-36">
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className="input w-56">
          <option value="">All Companies</option>
          {ALL_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
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
        <button
          onClick={() => { const w = getThisWeek(); setFilterDateFrom(w.from); setFilterDateTo(w.to) }}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            hasDateFilter && filterDateFrom === getThisWeek().from && filterDateTo === getThisWeek().to
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-700'
          }`}
        >
          This Week
        </button>
        {hasDateFilter && (
          <button
            onClick={() => { setFilterDateFrom(''); setFilterDateTo('') }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Clear dates
          </button>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {(['', 'LEGACY', 'AB'] as const).map(d => (
            <button
              key={d}
              onClick={() => setFilterDivision(d)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterDivision === d
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-700'
              }`}
            >
              {d === '' ? 'All' : d === 'LEGACY' ? 'Legacy' : 'AB'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 py-8 text-center">Loading…</div>
      ) : grouped.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-gray-400">
          No projections match your filters.{' '}
          <Link href="/projections/new" className="text-blue-600 hover:underline">Add one →</Link>
        </div>
      ) : grouped.map(group => {
        const legacy = group.items.filter(p => p.division === 'LEGACY')
        const ab = group.items.filter(p => p.division === 'AB')
        const legacyTotal = legacy.reduce((s, p) => s + p.estimatedAmountOwed, 0)
        const abTotal = ab.reduce((s, p) => s + p.estimatedAmountOwed, 0)

        return (
          <div key={group.date} className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="font-semibold text-gray-700">Week of {group.date}</h2>
              <span className="text-sm text-gray-400">{dollars(legacyTotal + abTotal)}</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {legacy.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-slate-50 border-b border-gray-100 flex justify-between">
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Legacy</span>
                    <span className="text-xs font-mono text-slate-600">{dollars(legacyTotal)}</span>
                  </div>
                  <ProjectionTable rows={legacy} />
                </>
              )}
              {ab.length > 0 && (
                <>
                  <div className={`px-4 py-2 bg-blue-50 border-b border-gray-100 flex justify-between ${legacy.length > 0 ? 'border-t border-gray-200' : ''}`}>
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">AB</span>
                    <span className="text-xs font-mono text-blue-600">{dollars(abTotal)}</span>
                  </div>
                  <ProjectionTable rows={ab} />
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ProjectionsPage() {
  return (
    <Suspense fallback={<div className="text-gray-400 p-8">Loading…</div>}>
      <ProjectionsContent />
    </Suspense>
  )
}

function ProjectionTable({ rows }: { rows: Projection[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100">
          <Th>Job #</Th>
          <Th>Job Name</Th>
          <Th>Est #</Th>
          <Th>Billing Period</Th>
          <Th>Amount</Th>
          <Th>Exp. Payment Date</Th>
          <Th>Status</Th>
          <Th>Latest Note</Th>
          <Th></Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map(p => (
          <tr key={p.id} className="hover:bg-slate-50">
            <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{p.jobNumber}</td>
            <td className="px-4 py-3 text-gray-800">{p.jobName}</td>
            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{p.estimateNumber}</td>
            <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{p.billingPeriod}</td>
            <td className="px-4 py-3 font-mono whitespace-nowrap">{dollars(p.estimatedAmountOwed)}</td>
            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(p.estimatedPaymentDate)}</td>
            <td className="px-4 py-3">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: p.status.color + '22', color: p.status.color }}>
                {p.status.name}
              </span>
            </td>
            <td className="px-4 py-3 text-gray-400 text-xs">
              {p.notes[0]?.content ?? '—'}
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
              <Link href={`/projections/${p.id}`} className="text-xs text-blue-600 hover:underline">View →</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide text-left">
      {children}
    </th>
  )
}
