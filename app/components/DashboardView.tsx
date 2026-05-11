'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { dollars, fmtDate } from '@/lib/format'

export interface DashboardData {
  friday: string
  weekLegacy: number
  weekAB: number
  weekLegacyCount: number
  weekABCount: number
  weekTotalCount: number
  nextWeekTotal: number
  nextWeekCount: number
  futureTotal: number
  futureCount: number
  projectedCount: number
  partialCount: number
  allActiveCount: number
  jobsCount: number
  dateFrom: string
  dateTo: string
  nextWeekMonStr: string
  nextWeekFriStr: string
  afterNextWeekFriStr: string
}

type ThemeId = 'slate-emerald' | 'white-indigo' | 'dark-mode' | 'warm-neutral'

interface ThemeConfig {
  id: ThemeId
  name: string
  swatch: string
  heading: string
  subheading: string
  button: string
  sectionBar: string
  sectionText: string
  kpiCard: string
  kpiHighlight: string
  kpiLabel: string
  kpiSub: string
  accentBar?: string
  receiptValue: string
  combinedValue: string
  nextWeekValue: string
  futureValue: string
  projectedValue: string
  partialValue: string
  quickCard: string
  quickLabel: string
  quickDesc: string
}

const THEMES: Record<ThemeId, ThemeConfig> = {
  'slate-emerald': {
    id: 'slate-emerald',
    name: 'Slate & Emerald',
    swatch: '#10b981',
    heading: 'text-gray-900',
    subheading: 'text-slate-400',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    sectionBar: 'bg-emerald-500',
    sectionText: 'text-slate-500',
    kpiCard: 'bg-slate-800',
    kpiHighlight: 'bg-slate-900 ring-1 ring-emerald-500/40',
    kpiLabel: 'text-slate-400',
    kpiSub: 'text-slate-500',
    receiptValue: 'text-emerald-400',
    combinedValue: 'text-emerald-300',
    nextWeekValue: 'text-amber-400',
    futureValue: 'text-slate-300',
    projectedValue: 'text-sky-400',
    partialValue: 'text-orange-400',
    quickCard: 'bg-white border border-gray-200 hover:border-emerald-400 hover:shadow-sm',
    quickLabel: 'text-gray-900 group-hover:text-emerald-700',
    quickDesc: 'text-gray-400',
  },
  'white-indigo': {
    id: 'white-indigo',
    name: 'White & Indigo',
    swatch: '#6366f1',
    heading: 'text-gray-900',
    subheading: 'text-gray-400',
    button: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    sectionBar: 'bg-indigo-400',
    sectionText: 'text-gray-400',
    kpiCard: 'bg-white border border-gray-200',
    kpiHighlight: 'bg-white border border-gray-200 shadow-md',
    kpiLabel: 'text-gray-500',
    kpiSub: 'text-gray-400',
    accentBar: 'bg-indigo-400',
    receiptValue: 'text-indigo-600',
    combinedValue: 'text-indigo-700',
    nextWeekValue: 'text-violet-600',
    futureValue: 'text-gray-600',
    projectedValue: 'text-indigo-500',
    partialValue: 'text-orange-500',
    quickCard: 'bg-white border border-gray-200 hover:border-indigo-400 hover:shadow-sm',
    quickLabel: 'text-gray-900 group-hover:text-indigo-700',
    quickDesc: 'text-gray-400',
  },
  'dark-mode': {
    id: 'dark-mode',
    name: 'Dark Mode',
    swatch: '#3b82f6',
    heading: 'text-gray-900',
    subheading: 'text-gray-400',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
    sectionBar: 'bg-blue-500',
    sectionText: 'text-gray-400',
    kpiCard: 'bg-slate-950',
    kpiHighlight: 'bg-slate-950 ring-1 ring-blue-500/40',
    kpiLabel: 'text-slate-500',
    kpiSub: 'text-slate-600',
    receiptValue: 'text-white',
    combinedValue: 'text-emerald-400',
    nextWeekValue: 'text-blue-400',
    futureValue: 'text-amber-400',
    projectedValue: 'text-green-400',
    partialValue: 'text-orange-400',
    quickCard: 'bg-slate-950 border border-slate-800 hover:border-blue-500 hover:shadow-sm',
    quickLabel: 'text-white group-hover:text-blue-400',
    quickDesc: 'text-slate-500',
  },
  'warm-neutral': {
    id: 'warm-neutral',
    name: 'Warm Neutral',
    swatch: '#0d9488',
    heading: 'text-stone-900',
    subheading: 'text-stone-400',
    button: 'bg-teal-600 hover:bg-teal-700 text-white',
    sectionBar: 'bg-teal-400',
    sectionText: 'text-stone-400',
    kpiCard: 'bg-white shadow-md',
    kpiHighlight: 'bg-white shadow-lg',
    kpiLabel: 'text-stone-400',
    kpiSub: 'text-stone-300',
    accentBar: 'bg-teal-400',
    receiptValue: 'text-teal-700',
    combinedValue: 'text-teal-600',
    nextWeekValue: 'text-cyan-600',
    futureValue: 'text-stone-500',
    projectedValue: 'text-teal-500',
    partialValue: 'text-amber-600',
    quickCard: 'bg-white shadow-md hover:shadow-lg',
    quickLabel: 'text-stone-900 group-hover:text-teal-700',
    quickDesc: 'text-stone-400',
  },
}

export default function DashboardView({ data: d }: { data: DashboardData }) {
  const [themeId, setThemeId] = useState<ThemeId>('slate-emerald')

  useEffect(() => {
    const saved = localStorage.getItem('vibin-dashboard-theme') as ThemeId | null
    if (saved && THEMES[saved]) setThemeId(saved)
  }, [])

  const t = THEMES[themeId]

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className={`text-3xl font-bold tracking-tight ${t.heading}`}>Dashboard</h1>
          <p className={`text-sm mt-1 ${t.subheading}`}>Next Friday report: {fmtDate(d.friday)}</p>
        </div>
        <Link href="/report" className={`px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors ${t.button}`}>
          Build Friday Report →
        </Link>
      </div>

      {/* This week's cash receipts */}
      <SectionHeader label="This Week's Cash Receipts" t={t} />
      <div className="grid grid-cols-3 gap-4 mb-8">
        <KpiCard label="Legacy" value={dollars(d.weekLegacy)} sub={`${d.weekLegacyCount} jobs`} valueClass={t.receiptValue} href={`/jobs?division=LEGACY&dateFrom=${d.dateFrom}&dateTo=${d.dateTo}`} t={t} />
        <KpiCard label="AB" value={dollars(d.weekAB)} sub={`${d.weekABCount} jobs`} valueClass={t.receiptValue} href={`/jobs?division=AB&dateFrom=${d.dateFrom}&dateTo=${d.dateTo}`} t={t} />
        <KpiCard label="Combined" value={dollars(d.weekLegacy + d.weekAB)} sub={`${d.weekTotalCount} jobs`} valueClass={t.combinedValue} href={`/jobs?dateFrom=${d.dateFrom}&dateTo=${d.dateTo}`} t={t} highlight />
      </div>

      {/* Projected payments */}
      <SectionHeader label="Projected Payments" t={t} />
      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiCard label="Next Week" value={dollars(d.nextWeekTotal)} sub={`${d.nextWeekCount} projections`} valueClass={t.nextWeekValue} href={`/projections?dateFrom=${d.nextWeekMonStr}&dateTo=${d.nextWeekFriStr}&excludeStatus=received`} t={t} />
        <KpiCard label="Future" value={dollars(d.futureTotal)} sub={`${d.futureCount} projections`} valueClass={t.futureValue} href={`/projections?dateFrom=${d.afterNextWeekFriStr}&excludeStatus=received`} t={t} />
        <KpiCard label="Projected" value={d.projectedCount.toString()} sub="awaiting payment" valueClass={t.projectedValue} href="/projections?statusName=Projected" t={t} />
        <KpiCard label="Partial" value={d.partialCount.toString()} sub="partially received" valueClass={t.partialValue} href="/projections?statusName=Partial" t={t} />
      </div>

      {/* Quick actions */}
      <SectionHeader label="Quick Actions" t={t} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickLink href="/jobs" label="Cash Receipts" desc={`${d.jobsCount} jobs tracked`} t={t} />
        <QuickLink href="/projections" label="Projections" desc={`${d.allActiveCount} active`} t={t} />
        <QuickLink href="/projections/new" label="Add Projection" desc="Log a new expected payment" t={t} />
        <QuickLink href="/report" label="Friday Report" desc="Build & copy email" t={t} />
      </div>
    </div>
  )
}

function SectionHeader({ label, t }: { label: string; t: ThemeConfig }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-1 h-4 rounded-full ${t.sectionBar}`} />
      <h2 className={`text-xs font-bold uppercase tracking-widest ${t.sectionText}`}>{label}</h2>
    </div>
  )
}

function KpiCard({ label, value, sub, valueClass, href, highlight, t }: {
  label: string; value: string; sub: string; valueClass: string
  href?: string; highlight?: boolean; t: ThemeConfig
}) {
  const base = `group rounded-xl p-5 transition-all block ${highlight ? t.kpiHighlight : t.kpiCard}`

  const inner = t.accentBar ? (
    <div className="flex gap-3 items-stretch">
      <div className={`w-1 rounded-full shrink-0 ${t.accentBar}`} />
      <div className="flex-1">
        <div className={`text-xs uppercase tracking-wider font-semibold mb-3 ${t.kpiLabel}`}>{label}</div>
        <div className={`text-3xl font-bold font-mono leading-none ${valueClass}`}>{value}</div>
        <div className={`text-xs mt-2 ${t.kpiSub}`}>{sub}</div>
      </div>
    </div>
  ) : (
    <>
      <div className={`text-xs uppercase tracking-wider font-semibold mb-3 ${t.kpiLabel}`}>{label}</div>
      <div className={`text-3xl font-bold font-mono leading-none ${valueClass}`}>{value}</div>
      <div className={`text-xs mt-2 ${t.kpiSub}`}>{sub}</div>
    </>
  )

  if (href) return <Link href={href} className={base}>{inner}</Link>
  return <div className={base}>{inner}</div>
}

function QuickLink({ href, label, desc, t }: { href: string; label: string; desc: string; t: ThemeConfig }) {
  return (
    <Link href={href} className={`rounded-xl p-4 transition-all group ${t.quickCard}`}>
      <div className={`font-semibold text-sm transition-colors ${t.quickLabel}`}>{label}</div>
      <div className={`text-xs mt-1 ${t.quickDesc}`}>{desc}</div>
    </Link>
  )
}
