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
      where: { isActive: true, estimatedPaymentDate: { gte: nextWeekMon, lte: nextWeekFriEnd } },
      select: { estimatedAmountOwed: true },
    }),
    prisma.projectedPayment.findMany({
      where: { isActive: true, estimatedPaymentDate: { gt: nextWeekFriEnd } },
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Next report: {fmtDate(friday)}</p>
        </div>
        <Link
          href="/report"
          className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          Build Friday Report →
        </Link>
      </div>

      {/* This week receipts */}
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">This Week's Cash Receipts</h2>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Legacy" value={dollars(weekLegacy)} sub={`${weekLegacyJobs.length} jobs`} color="blue" href={`/jobs?division=LEGACY&dateFrom=${dateFrom}&dateTo=${dateTo}`} />
        <StatCard label="AB" value={dollars(weekAB)} sub={`${weekABJobs.length} jobs`} color="blue" href={`/jobs?division=AB&dateFrom=${dateFrom}&dateTo=${dateTo}`} />
        <StatCard label="Combined" value={dollars(weekLegacy + weekAB)} sub={`${weekJobs.length} jobs`} color="green" href={`/jobs?dateFrom=${dateFrom}&dateTo=${dateTo}`} />
      </div>

      {/* Projections */}
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Projected Payments</h2>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Next Week" value={dollars(nextWeekTotal)} sub={`${nextWeekProjections.length} projections`} color="yellow" href={`/projections?dateFrom=${nextWeekMonStr}&dateTo=${nextWeekFriStr}`} />
        <StatCard label="Future" value={dollars(futureTotal)} sub={`${futureProjections.length} projections`} color="gray" href={`/projections?dateFrom=${afterNextWeekFriStr}`} />
        <StatCard label="Projected" value={projectedCount.toString()} sub="awaiting payment" color="blue" href="/projections?statusName=Projected" />
        <StatCard label="Partial" value={partialCount.toString()} sub="partially received" color="orange" href="/projections?statusName=Partial" />
      </div>

      {/* Quick links */}
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickLink href="/jobs" label="Cash Receipts" desc={`${jobs} jobs tracked`} />
        <QuickLink href="/projections" label="Projections" desc={`${allActive.length} active`} />
        <QuickLink href="/projections/new" label="Add Projection" desc="Log a new expected payment" />
        <QuickLink href="/report" label="Friday Report" desc="Build & copy email" />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color, href }: { label: string; value: string; sub: string; color: string; href?: string }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    yellow: 'border-yellow-200 bg-yellow-50',
    orange: 'border-orange-200 bg-orange-50',
    gray: 'border-gray-200 bg-white',
  }
  const inner = (
    <>
      <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</div>
      <div className="text-2xl font-bold font-mono mt-1 text-gray-900">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </>
  )
  if (href) {
    return (
      <Link href={href} className={`rounded-xl border p-4 block hover:shadow-md transition-shadow ${colors[color] ?? colors.gray}`}>
        {inner}
      </Link>
    )
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color] ?? colors.gray}`}>
      {inner}
    </div>
  )
}

function QuickLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <Link href={href} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-slate-400 hover:shadow-sm transition-all">
      <div className="font-semibold text-sm text-gray-900">{label}</div>
      <div className="text-xs text-gray-400 mt-1">{desc}</div>
    </Link>
  )
}
