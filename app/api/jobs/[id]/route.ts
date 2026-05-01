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
  const { jobNumber, jobName, company, jobStatus, paidThruDate, billedThruDate, nextAmountDue, customer, notes } = body

  try {
  const job = await prisma.job.update({
    where: { id },
    data: {
      jobNumber: jobNumber ? String(jobNumber).trim() : undefined,
      jobName: jobName ? String(jobName).trim() : undefined,
      company: company ? String(company) : undefined,
      division: company ? getDivision(String(company)) : undefined,
      jobStatus: jobStatus ?? undefined,
      paidThruDate: paidThruDate !== undefined ? (paidThruDate ? new Date(paidThruDate) : null) : undefined,
      billedThruDate: billedThruDate !== undefined ? (billedThruDate ? new Date(billedThruDate) : null) : undefined,
      nextAmountDue: nextAmountDue !== undefined ? (nextAmountDue != null ? Math.round(Number(nextAmountDue)) : null) : undefined,
      customer: customer !== undefined ? (customer ? String(customer).trim() : null) : undefined,
      notes: notes !== undefined ? (notes || null) : undefined,
    },
  })
  return NextResponse.json(job)
  } catch (err: any) {
    if (err.code === 'P2002') return NextResponse.json({ error: 'A job with this number already exists' }, { status: 409 })
    throw err
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  await prisma.job.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
