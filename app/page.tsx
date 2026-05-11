import { prisma } from '@/lib/db'
import { dollars, fmtDate } from '@/lib/format'
import Link from 'next/link'

export default async function DashboardPage() {
  const today = new Date()

  // Next report Friday: always the upcoming Friday (7 days out when today IS Friday)
  const dayOfWeekForFriday = today.getUTCDay()
  const daysUntilFriday = dayOfWeekForFriday === 5 ? 7 : (5 - dayOfWeekForFriday + 7) % 7
  const friday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysUntilFriday))

  // This week: Monday 00:00 UTC → today 23:59 UTC
  const startOfWeek = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() - (today.getUTCDay() === 0 ? 6 : today.getUTCDay() - 1)
  ))
  const endOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999))

  // Next calendar week: Mon–Fri in UTC
  const dayOfWeek = today.getUTCDay()
  const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const nextWeekMon = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysUntilNextMonday))
  const nextWeekFri = new Date(Date.UTC(nextWeekMon.getUTCFullYear(), nextWeekMon.getUTCMonth(), nextWeekMon.getUTCDate() + 4))
  const nextWeekFriEnd = new Date(Date.UTC(nextWeekFri.getUTCFullYear(), nextWeekFri.getUTCMonth(), nextWeekFri.getUTCDate(), 23, 59, 59, 999))

  const dateFrom = startOfWeek.toISOString().slice(0, 10)
  const dateTo = today.toISOString().slice(0, 10)
  const nextWeekMonStr = nextWeekMon.toISOString().slice(0, 10)
  const nextWeekFriStr = nextWeekFri.toISOString().slice(0, 10)
  const afterNextWeekFriStr = new Date(nextWeekFri.getTime() + 86_400_000).toISOString().slice(0, 10)

  const weekWindow = { gte: startOfWeek, lte: endOfToday }

  const [jobs, weekJobs, allActive, nextWeekProjections, futureProjections] = await Promise.all([
    prisma.job.count(),
    prisma.job.findMany({
      where: { payments: { some: { datePmtReceived: weekWindow } } },
      include: {
        payments: {
          where: { datePmtReceived: weekWindow },
          orderBy: { datePmtReceived: 'desc' },
        },
      },
    }),
    prisma.projectedPayment.findMany({
      where: { isActive: true },
      select: { status: { select: { name: true } } },
    }),
    prisma.projectedPayment.findMany({
      where: { isActive: true, estimatedPaymentDate: { gte: nextWeekMon, lte: nextWeekFriEnd }, NOT: [{ status: { name: { equals: 'received', mode: 'insensitive' } } }] },
      select: { estimatedAmountOwed: true },
    }),
    prisma.projectedPayment.findMany({
      where: { isActive: true, estimatedPaymentDate: { gt: nextWeekFriEnd }, NOT: [{ status: { name: { equals: 'received', mode: 'insensitive' } } }] },
      select: { estimatedAmountOwed: true },
    }),
  ])

  const weekLegacyJobs = weekJobs.filter(j => j.division === 'LEGACY')
  const weekABJobs = weekJobs.filter(j => j.division === 'AB')
  const weekLegacy = weekLegacyJobs.reduce((s, j) => s + j.payments.reduce((ps, p) => ps + p.amountReceived, 0), 0)
  const weekAB = weekABJobs.reduce((s, j) => s + j.payments.reduce((ps, p) => ps + p.amountReceived, 0), 0)

  const nextWeekTotal = nextWeekProjections.reduce((s, p) => s + p.estimatedAmountOwed, 0)
  const futureTotal = futureProjections.reduce((s, p) => s + p.estimatedAmountOwed, 0)

  const projectedCount = allActive.filter(p => p.status.name === 'Projected').length
  const partialCount = allActive.filter(p => p.status.name === 'Partial').length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Next Friday report: {fmtDate(friday)}</p>
        </div>
        <Link
          href="/report"
          className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
        >
          Build Friday Report →
        </Link>
      </div>

      {/* This week receipts */}
      <SectionHeader label="This Week's Cash Receipts" />
      <div className="grid grid-cols-3 gap-4 mb-8">
        <KpiCard label="Legacy" value={dollars(weekLegacy)} sub={`${weekLegacyJobs.length} jobs`} valueClass="text-emerald-400" href={`/jobs?division=LEGACY&dateFrom=${dateFrom}&dateTo=${dateTo}`} />
        <KpiCard label="AB" value={dollars(weekAB)} sub={`${weekABJobs.length} jobs`} valueClass="text-emerald-400" href={`/jobs?division=AB&dateFrom=${dateFrom}&dateTo=${dateTo}`} />
        <KpiCard label="Combined" value={dollars(weekLegacy + weekAB)} sub={`${weekJobs.length} jobs`} valueClass="text-emerald-300 text-4xl" href={`/jobs?dateFrom=${dateFrom}&dateTo=${dateTo}`} highlight />
      </div>

      {/* Projections */}
      <SectionHeader label="Projected Payments" />
      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiCard label="Next Week" value={dollars(nextWeekTotal)} sub={`${nextWeekProjections.length} projections`} valueClass="text-amber-400" href={`/projections?dateFrom=${nextWeekMonStr}&dateTo=${nextWeekFriStr}&excludeStatus=received`} />
        <KpiCard label="Future" value={dollars(futureTotal)} sub={`${futureProjections.length} projections`} valueClass="text-slate-300" href={`/projections?dateFrom=${afterNextWeekFriStr}&excludeStatus=received`} />
        <KpiCard label="Projected" value={projectedCount.toString()} sub="awaiting payment" valueClass="text-sky-400" href="/projections?statusName=Projected" />
        <KpiCard label="Partial" value={partialCount.toString()} sub="partially received" valueClass="text-orange-400" href="/projections?statusName=Partial" />
      </div>

      {/* Quick links */}
      <SectionHeader label="Quick Actions" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickLink href="/jobs" label="Cash Receipts" desc={`${jobs} jobs tracked`} />
        <QuickLink href="/projections" label="Projections" desc={`${allActive.length} active`} />
        <QuickLink href="/projections/new" label="Add Projection" desc="Log a new expected payment" />
        <QuickLink href="/report" label="Friday Report" desc="Build & copy email" />
      </div>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-1 h-4 bg-emerald-500 rounded-full" />
      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</h2>
    </div>
  )
}

function KpiCard({ label, value, sub, valueClass, href, highlight }: {
  label: string; value: string; sub: string; valueClass?: string; href?: string; highlight?: boolean
}) {
  const base = `group rounded-xl p-5 transition-all ${
    highlight
      ? 'bg-slate-900 ring-1 ring-emerald-500/40 hover:ring-emerald-500/70'
      : 'bg-slate-800 hover:bg-slate-750 hover:ring-1 hover:ring-slate-600'
  }`
  const inner = (
    <>
      <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">{label}</div>
      <div className={`font-bold font-mono leading-none ${valueClass ?? 'text-white'} ${valueClass?.includes('text-4xl') ? 'text-4xl' : 'text-3xl'}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-2">{sub}</div>
    </>
  )
  if (href) return <Link href={href} className={base}>{inner}</Link>
  return <div className={base}>{inner}</div>
}

function QuickLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <Link href={href} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-emerald-400 hover:shadow-sm transition-all group">
      <div className="font-semibold text-sm text-gray-900 group-hover:text-emerald-700 transition-colors">{label}</div>
      <div className="text-xs text-gray-400 mt-1">{desc}</div>
    </Link>
  )
}
