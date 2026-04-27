import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDivision } from '@/lib/companies'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      payments: { orderBy: { datePmtReceived: 'desc' } },
      projections: {
        where: { isActive: true },
        include: { status: true },
        orderBy: { estimatedPaymentDate: 'asc' },
      },
    },
  })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(job)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await req.json()
  const { jobName, company, jobStatus, paidThruDate, billedThruDate, nextAmountDue, notes } = body

  const job = await prisma.job.update({
    where: { id },
    data: {
      jobName: jobName ? String(jobName).trim() : undefined,
      company: company ? String(company) : undefined,
      division: company ? getDivision(String(company)) : undefined,
      jobStatus: jobStatus ?? undefined,
      paidThruDate: paidThruDate !== undefined ? (paidThruDate ? new Date(paidThruDate) : null) : undefined,
      billedThruDate: billedThruDate !== undefined ? (billedThruDate ? new Date(billedThruDate) : null) : undefined,
      nextAmountDue: nextAmountDue !== undefined ? (nextAmountDue != null ? Math.round(Number(nextAmountDue)) : null) : undefined,
      notes: notes !== undefined ? (notes || null) : undefined,
    },
  })
  return NextResponse.json(job)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  await prisma.job.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
