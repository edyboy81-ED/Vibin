import { prisma } from '@/lib/db'
import { reconcile } from '@/lib/reconcile'
import Link from 'next/link'

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default async function DashboardPage() {
  const [jobs, receipts] = await Promise.all([
    prisma.job.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.receipt.findMany({ orderBy: { date: 'desc' } }),
  ])

  const result = reconcile(jobs, receipts)

  const totalExpected = jobs.reduce((s, j) => s + j.amount, 0)
  const totalReceived = receipts.reduce((s, r) => s + r.amount, 0)
  const pendingAmount = result.unmatchedJobs.reduce((s, j) => s + j.amount, 0)
  const unmatchedReceiptsAmount = result.unmatchedReceipts.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Dashboard</h1>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Jobs" value={jobs.length.toString()} />
        <StatCard label="Receipts" value={receipts.length.toString()} />
        <StatCard label="Expected" value={dollars(totalExpected)} mono />
        <StatCard label="Received" value={dollars(totalReceived)} mono />
      </div>

      {/* Reconciliation status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatusCard
          label="Matched"
          count={result.matched.length}
          sub={`${dollars(result.matched.reduce((s, m) => s + m.receipt.amount, 0))} received`}
          color="green"
        />
        <StatusCard
          label="Pending Payment"
          count={result.unmatchedJobs.length}
          sub={`${dollars(pendingAmount)} outstanding`}
          color="yellow"
        />
        <StatusCard
          label="Unmatched Receipts"
          count={result.unmatchedReceipts.length}
          sub={`${dollars(unmatchedReceiptsAmount)} unlinked`}
          color="red"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/reconciliation"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
        >
          View Reconciliation
        </Link>
        <Link
          href="/jobs"
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
        >
          Manage Jobs
        </Link>
        <Link
          href="/receipts"
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
        >
          Manage Receipts
        </Link>
      </div>
    </div>
  )
}

function StatCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

function StatusCard({
  label,
  count,
  sub,
  color,
}: {
  label: string
  count: number
  sub: string
  color: 'green' | 'yellow' | 'red'
}) {
  const styles = {
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800',
  }
  return (
    <div className={`rounded-xl border p-5 ${styles[color]}`}>
      <div className="text-sm font-medium">{label}</div>
      <div className="text-4xl font-bold my-2">{count}</div>
      <div className="text-xs opacity-70">{sub}</div>
    </div>
  )
}
