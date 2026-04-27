import { prisma } from '@/lib/db'
import { dollars, fmtDate, daysSince, nextFriday } from '@/lib/format'
import Link from 'next/link'

export default async function DashboardPage() {
  const today = new Date()
  const friday = nextFriday(today)

  const [jobs, payments, projections] = await Promise.all([
    prisma.job.count(),
    prisma.payment.findMany({
      where: {
        datePmtReceived: {
          gte: new Date(Date.now() - 7 * 86_400_000),
        },
      },
      include: { job: { select: { division: true } } },
    }),
    prisma.projectedPayment.findMany({
      where: { isActive: true },
      include: { status: true },
    }),
  ])

  const weekLegacy = payments.filter(p => p.job.division === 'LEGACY').reduce((s, p) => s + p.amountReceived, 0)
  const weekAB = payments.filter(p => p.job.division === 'AB').reduce((s, p) => s + p.amountReceived, 0)

  const nextWeekEnd = new Date(friday.getTime() + 7 * 86_400_000)
  const nextWeekProjections = projections.filter(p => new Date(p.estimatedPaymentDate) <= nextWeekEnd)
  const futureProjections = projections.filter(p => new Date(p.estimatedPaymentDate) > nextWeekEnd)

  const nextWeekTotal = nextWeekProjections.reduce((s, p) => s + p.estimatedAmountOwed, 0)
  const futureTotal = futureProjections.reduce((s, p) => s + p.estimatedAmountOwed, 0)

  const projectedCount = projections.filter(p => p.status.name === 'Projected').length
  const partialCount = projections.filter(p => p.status.name === 'Partial').length

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
        <StatCard label="Legacy" value={dollars(weekLegacy)} sub={`${payments.filter(p => p.job.division === 'LEGACY').length} payments`} color="blue" />
        <StatCard label="AB" value={dollars(weekAB)} sub={`${payments.filter(p => p.job.division === 'AB').length} payments`} color="blue" />
        <StatCard label="Combined" value={dollars(weekLegacy + weekAB)} sub="total received" color="green" />
      </div>

      {/* Projections */}
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Projected Payments</h2>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Next Week" value={dollars(nextWeekTotal)} sub={`${nextWeekProjections.length} projections`} color="yellow" />
        <StatCard label="Future" value={dollars(futureTotal)} sub={`${futureProjections.length} projections`} color="gray" />
        <StatCard label="Projected" value={projectedCount.toString()} sub="awaiting payment" color="blue" />
        <StatCard label="Partial" value={partialCount.toString()} sub="partially received" color="orange" />
      </div>

      {/* Quick links */}
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickLink href="/jobs" label="Cash Receipts" desc={`${jobs} jobs tracked`} />
        <QuickLink href="/projections" label="Projections" desc={`${projections.length} active`} />
        <QuickLink href="/projections/new" label="Add Projection" desc="Log a new expected payment" />
        <QuickLink href="/report" label="Friday Report" desc="Build & copy email" />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    yellow: 'border-yellow-200 bg-yellow-50',
    orange: 'border-orange-200 bg-orange-50',
    gray: 'border-gray-200 bg-white',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color] ?? colors.gray}`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</div>
      <div className="text-2xl font-bold font-mono mt-1 text-gray-900">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
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
