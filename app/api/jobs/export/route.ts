import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fmtDate, daysSince } from '@/lib/format'

export async function GET() {
  const jobs = await prisma.job.findMany({
    orderBy: [{ company: 'asc' }, { jobNumber: 'asc' }],
    include: {
      payments: { orderBy: { datePmtReceived: 'desc' }, take: 2 },
    },
  })

  const header = [
    'Job', 'Job Name', 'Job Status', 'Paid Thru Date',
    'Date Pmt Received', 'Days Last Paid', 'Amount Received',
    'Next Amount Due', 'Billed Thru Date', 'Company',
  ]

  const rows = jobs.map(job => {
    const latest = job.payments[0] ?? null
    const prev = job.payments[1] ?? null
    const daysLastPaid = latest
      ? (prev
          ? Math.floor((new Date(latest.datePmtReceived).getTime() - new Date(prev.datePmtReceived).getTime()) / 86_400_000)
          : daysSince(latest.datePmtReceived) ?? '')
      : ''

    return [
      job.jobNumber,
      job.jobName,
      job.jobStatus === 'IN_PROGRESS' ? 'In progress' : 'Closed',
      fmtDate(job.paidThruDate),
      latest ? fmtDate(latest.datePmtReceived) : '',
      daysLastPaid,
      latest ? (latest.amountReceived / 100).toFixed(2) : '',
      job.nextAmountDue != null ? (job.nextAmountDue / 100).toFixed(2) : '',
      fmtDate(job.billedThruDate),
      job.company,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  })

  const csv = [header.join(','), ...rows].join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="cash-receipts-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
