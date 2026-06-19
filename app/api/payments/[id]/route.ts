import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { datePmtReceived, amountReceived, paidThruDate, notes } = await req.json()
  const payment = await prisma.payment.update({
    where: { id },
    data: {
      datePmtReceived: datePmtReceived ? new Date(datePmtReceived) : undefined,
      amountReceived: amountReceived != null ? Math.round(Number(amountReceived)) : undefined,
      paidThruDate: paidThruDate ? new Date(paidThruDate) : null,
      notes: notes ?? null,
    },
  })
  return NextResponse.json(payment)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const payment = await prisma.payment.findUnique({ where: { id } })
  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  await prisma.payment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
