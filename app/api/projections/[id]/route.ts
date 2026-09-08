import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDivision } from '@/lib/companies'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const projection = await prisma.projectedPayment.findUnique({
    where: { id },
    include: {
      status: true,
      notes: { orderBy: { createdAt: 'desc' } },
      movements: { orderBy: { createdAt: 'desc' } },
      job: { select: { id: true, jobNumber: true, jobName: true, company: true, surety: true } },
    },
  })
  if (!projection) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(projection)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await req.json()
  const {
    monthYear, estimateNumber, billingPeriod, surety,
    estimatedAmountOwed, estimatedPaymentDate, statusId, isActive, jobId,
  } = body

  const projection = await prisma.projectedPayment.update({
    where: { id },
    data: {
      monthYear: monthYear !== undefined ? String(monthYear) : undefined,
      estimateNumber: estimateNumber !== undefined ? String(estimateNumber) : undefined,
      billingPeriod: billingPeriod !== undefined ? String(billingPeriod) : undefined,
      surety: surety !== undefined ? String(surety) : undefined,
      estimatedAmountOwed: estimatedAmountOwed != null ? Math.round(Number(estimatedAmountOwed)) : undefined,
      estimatedPaymentDate: estimatedPaymentDate ? new Date(estimatedPaymentDate) : undefined,
      statusId: statusId ? String(statusId) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      jobId: jobId !== undefined ? (jobId || null) : undefined,
    },
    include: { status: true },
  })
  return NextResponse.json(projection)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  await prisma.projectedPayment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
