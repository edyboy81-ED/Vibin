import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDivision } from '@/lib/companies'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const division = sp.get('division')
  const statusId = sp.get('statusId')
  const company = sp.get('company')
  const surety = sp.get('surety')
  const dateFrom = sp.get('dateFrom')
  const dateTo = sp.get('dateTo')
  const active = sp.get('active')

  const projections = await prisma.projectedPayment.findMany({
    where: {
      ...(division ? { division } : {}),
      ...(statusId ? { statusId } : {}),
      ...(company ? { company } : {}),
      ...(surety ? { surety } : {}),
      ...(active === 'true' ? { isActive: true } : {}),
      ...(active === 'false' ? { isActive: false } : {}),
      ...(dateFrom || dateTo
        ? {
            estimatedPaymentDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    },
    include: {
      status: true,
      notes: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: [{ estimatedPaymentDate: 'asc' }, { division: 'asc' }, { jobNumber: 'asc' }],
  })
  return NextResponse.json(projections)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    jobId, jobNumber, jobName, company,
    monthYear, estimateNumber, billingPeriod,
    estimatedAmountOwed, estimatedPaymentDate,
    statusId, initialNote,
  } = body

  if (!jobNumber || !jobName || !company || !estimatedAmountOwed || !estimatedPaymentDate || !statusId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Pull surety from linked job if available
  let surety = 'UNBONDED'
  if (jobId) {
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { surety: true } })
    if (job) surety = job.surety
  }

  const projection = await prisma.projectedPayment.create({
    data: {
      jobId: jobId || null,
      jobNumber: String(jobNumber).trim(),
      jobName: String(jobName).trim(),
      company: String(company),
      division: getDivision(String(company)),
      surety,
      monthYear: String(monthYear ?? ''),
      estimateNumber: String(estimateNumber ?? ''),
      billingPeriod: String(billingPeriod ?? ''),
      estimatedAmountOwed: Math.round(Number(estimatedAmountOwed)),
      estimatedPaymentDate: new Date(estimatedPaymentDate),
      statusId: String(statusId),
      notes: initialNote
        ? { create: { content: String(initialNote) } }
        : undefined,
    },
    include: { status: true },
  })
  return NextResponse.json(projection, { status: 201 })
}
