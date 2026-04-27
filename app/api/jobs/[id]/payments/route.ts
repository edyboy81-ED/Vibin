import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const payments = await prisma.payment.findMany({
    where: { jobId: id },
    orderBy: { datePmtReceived: 'desc' },
  })
  return NextResponse.json(payments)
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id: jobId } = await params
  const body = await req.json()
  const { datePmtReceived, amountReceived, paidThruDate, notes } = body

  if (!datePmtReceived || amountReceived == null) {
    return NextResponse.json({ error: 'datePmtReceived and amountReceived are required' }, { status: 400 })
  }

  const amountCents = Math.round(Number(amountReceived))

  // Create payment
  const payment = await prisma.payment.create({
    data: {
      jobId,
      datePmtReceived: new Date(datePmtReceived),
      amountReceived: amountCents,
      paidThruDate: paidThruDate ? new Date(paidThruDate) : null,
      notes: notes || null,
    },
  })

  // Update the job's paidThruDate if provided
  if (paidThruDate) {
    await prisma.job.update({
      where: { id: jobId },
      data: { paidThruDate: new Date(paidThruDate) },
    })
  }

  // Find active projections for this job to surface in UI
  const activeProjections = await prisma.projectedPayment.findMany({
    where: { jobId, isActive: true },
    include: { status: true },
    orderBy: { estimatedPaymentDate: 'asc' },
  })

  return NextResponse.json({ payment, activeProjections }, { status: 201 })
}
