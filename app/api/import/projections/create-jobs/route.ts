import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDivision } from '@/lib/companies'

interface ConfirmedRow {
  jobNumber: string
  jobName: string
  company: string
  estimateNumber: string
  billingPeriod: string
  monthYear: string
  estimatedAmountOwed: number  // cents
  estimatedPaymentDate: string // ISO string
  statusId: string
  notes: string | null
}

export async function POST(req: NextRequest) {
  const { rows }: { rows: ConfirmedRow[] } = await req.json()

  if (!rows?.length) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  const stats = { jobsCreated: 0, projectionsCreated: 0, skipped: 0 }
  const errors: string[] = []

  for (const row of rows) {
    const { jobNumber, jobName, company, estimateNumber, billingPeriod, monthYear,
            estimatedAmountOwed, estimatedPaymentDate, statusId, notes } = row

    if (!jobNumber || !jobName || !company) {
      errors.push(`${jobNumber || '(no job #)'}: Job #, Job Name, and Company are required`)
      continue
    }

    const division = getDivision(company)
    const paymentDate = new Date(estimatedPaymentDate)

    let jobId: string
    try {
      const existing = await prisma.job.findUnique({ where: { jobNumber } })
      if (existing) {
        jobId = existing.id
      } else {
        const created = await prisma.job.create({
          data: { jobNumber, jobName, company, division },
        })
        jobId = created.id
        stats.jobsCreated++
      }
    } catch {
      errors.push(`${jobNumber}: Failed to create job`)
      continue
    }

    const duplicate = await prisma.projectedPayment.findFirst({
      where: { jobId, estimateNumber, estimatedPaymentDate: paymentDate },
    })
    if (duplicate) { stats.skipped++; continue }

    await prisma.projectedPayment.create({
      data: {
        jobId,
        jobNumber,
        jobName,
        company,
        division,
        monthYear,
        estimateNumber,
        billingPeriod,
        estimatedAmountOwed,
        estimatedPaymentDate: paymentDate,
        statusId,
        isActive: true,
        notes: notes ? { create: [{ content: notes }] } : undefined,
      },
    })
    stats.projectionsCreated++
  }

  return NextResponse.json({ stats, errors })
}
