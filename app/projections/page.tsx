'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { dollars, fmtDate } from '@/lib/format'
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

export default function ProjectionsPage() {
  const [projections, setProjections] = useState<Projection[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDivision, setFilterDivision] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return projections.filter(p => {
      if (!showInactive && !p.isActive) return false
      if (q && !p.jobNumber.toLowerCase().includes(q) && !p.jobName.toLowerCase().includes(q)) return false
      if (filterDivision && p.division !== filterDivision) return false
      if (filterStatus && p.status.id !== filterStatus) return false
      if (filterCompany && p.company !== filterCompany) return false
      return true
    })
  }, [projections, search, filterDivision, filterStatus, filterCompany, showInactive])

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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projections</h1>
          {!loading && (
            <p className="text-sm text-gray-400 mt-1">
              {filtered.length} projections · {dollars(totalFiltered)} total
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
      <div className="flex gap-3 mb-4 flex-wrap items-center">
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

function ProjectionTable({ rows }: { rows: Projection[] }) {
  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="border-b border-gray-100">
          <Th w="w-[9%]">Job #</Th>
          <Th w="w-[20%]">Job Name</Th>
          <Th w="w-[8%]">Est #</Th>
          <Th w="w-[14%]">Billing Period</Th>
          <Th w="w-[12%]">Amount</Th>
          <Th w="w-[10%]">Status</Th>
          <Th w="w-[23%]">Latest Note</Th>
          <Th w="w-[4%]"></Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map(p => (
          <tr key={p.id} className="hover:bg-slate-50">
            <td className="px-4 py-3 font-mono text-xs">{p.jobNumber}</td>
            <td className="px-4 py-3 text-gray-800 truncate">{p.jobName}</td>
            <td className="px-4 py-3 text-gray-500">{p.estimateNumber}</td>
            <td className="px-4 py-3 text-gray-400 text-xs truncate">{p.billingPeriod}</td>
            <td className="px-4 py-3 font-mono">{dollars(p.estimatedAmountOwed)}</td>
            <td className="px-4 py-3">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: p.status.color + '22', color: p.status.color }}>
                {p.status.name}
              </span>
            </td>
            <td className="px-4 py-3 text-gray-400 text-xs truncate">
              {p.notes[0]?.content ?? '—'}
            </td>
            <td className="px-4 py-3">
              <Link href={`/projections/${p.id}`} className="text-xs text-blue-600 hover:underline whitespace-nowrap">View →</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Th({ children, w }: { children?: React.ReactNode; w?: string }) {
  return (
    <th className={`px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide text-left ${w ?? ''}`}>
      {children}
    </th>
  )
}
