import { prisma } from '@/lib/db'
import { reconcile } from '@/lib/reconcile'
import EmailForm from '@/app/components/EmailForm'

const COMPANY_LABELS: Record<string, string> = {
  PRESTIGE: 'Prestige Productions',
  HARMONY: 'Harmony Events',
  RHYTHM: 'Rhythm Records',
  MELODY: 'Melody Media',
  ENCORE: 'Encore Entertainment',
}

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function co(company: string) {
  return COMPANY_LABELS[company] ?? company
}

export default async function ReconciliationPage() {
  const [jobs, receipts] = await Promise.all([
    prisma.job.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.receipt.findMany({ orderBy: { date: 'asc' } }),
  ])

  const result = reconcile(jobs, receipts)

  const totalExpected = jobs.reduce((s, j) => s + j.amount, 0)
  const totalReceived = receipts.reduce((s, r) => s + r.amount, 0)
  const netDiff = totalReceived - totalExpected

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Reconciliation</h1>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <SummaryCard label="Total Expected" value={dollars(totalExpected)} />
        <SummaryCard label="Total Received" value={dollars(totalReceived)} />
        <SummaryCard
          label="Net Difference"
          value={(netDiff >= 0 ? '+' : '') + dollars(netDiff)}
          valueClass={netDiff < 0 ? 'text-red-600' : netDiff > 0 ? 'text-green-600' : 'text-gray-800'}
        />
      </div>

      {/* Matched */}
      <Section title={`Matched (${result.matched.length})`} accent="green">
        {result.matched.length === 0 ? (
          <Empty>No matched jobs yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-green-50">
              <tr>
                <Th>Job #</Th><Th>Company</Th><Th>Name</Th>
                <Th right>Expected</Th><Th right>Received</Th><Th right>Diff</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.matched.map((m) => (
                <tr key={m.job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{m.job.jobNumber}</td>
                  <td className="px-4 py-3">{co(m.job.company)}</td>
                  <td className="px-4 py-3">{m.job.name ?? m.job.jobNumber}</td>
                  <td className="px-4 py-3 text-right font-mono">{dollars(m.job.amount)}</td>
                  <td className="px-4 py-3 text-right font-mono">{dollars(m.receipt.amount)}</td>
                  <td className={`px-4 py-3 text-right font-mono ${
                    m.amountDiff < 0 ? 'text-red-600' : m.amountDiff > 0 ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {m.amountDiff === 0
                      ? '—'
                      : (m.amountDiff > 0 ? '+' : '') + dollars(m.amountDiff)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Pending */}
      <Section title={`Pending Payment — No Receipt (${result.unmatchedJobs.length})`} accent="yellow">
        {result.unmatchedJobs.length === 0 ? (
          <Empty>All jobs have matching receipts.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-yellow-50">
              <tr>
                <Th>Job #</Th><Th>Company</Th><Th>Name</Th><Th>Date</Th><Th right>Expected</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.unmatchedJobs.map((j) => (
                <tr key={j.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{j.jobNumber}</td>
                  <td className="px-4 py-3">{co(j.company)}</td>
                  <td className="px-4 py-3">{j.name ?? j.jobNumber}</td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(j.date)}</td>
                  <td className="px-4 py-3 text-right font-mono">{dollars(j.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Unmatched receipts */}
      <Section title={`Unmatched Receipts — No Job (${result.unmatchedReceipts.length})`} accent="red">
        {result.unmatchedReceipts.length === 0 ? (
          <Empty>All receipts match jobs.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-red-50">
              <tr>
                <Th>Job #</Th><Th>Company</Th><Th>Date</Th><Th right>Amount</Th><Th>Description</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.unmatchedReceipts.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{r.jobNumber}</td>
                  <td className="px-4 py-3">{co(r.company)}</td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(r.date)}</td>
                  <td className="px-4 py-3 text-right font-mono">{dollars(r.amount)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <EmailForm />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  valueClass = 'text-gray-800',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold font-mono mt-1 ${valueClass}`}>{value}</div>
    </div>
  )
}

function Section({
  title,
  accent,
  children,
}: {
  title: string
  accent: 'green' | 'yellow' | 'red'
  children: React.ReactNode
}) {
  const colors = {
    green: 'text-green-800 border-green-200',
    yellow: 'text-yellow-800 border-yellow-200',
    red: 'text-red-800 border-red-200',
  }
  return (
    <section className="mb-8">
      <h2 className={`text-base font-semibold mb-3 ${colors[accent]}`}>{title}</h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">{children}</div>
    </section>
  )
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-sm text-gray-400">{children}</p>
}
