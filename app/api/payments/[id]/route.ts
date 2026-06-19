import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

function fmtMoney(cents: number) {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(d: Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit', timeZone: 'UTC' })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { datePmtReceived, amountReceived, paidThruDate, notes } = await req.json()

  const old = await prisma.payment.findUnique({ where: { id } })
  if (!old) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

  const newAmount = amountReceived != null ? Math.round(Number(amountReceived)) : old.amountReceived
  const newDate = datePmtReceived ? new Date(datePmtReceived) : old.datePmtReceived
  const newPaidThru = paidThruDate ? new Date(paidThruDate) : (paidThruDate === null ? null : old.paidThruDate)
  const newNotes = notes !== undefined ? (notes || null) : old.notes

  const diffs: string[] = []
  if (newAmount !== old.amountReceived)
    diffs.push(`Amount: ${fmtMoney(old.amountReceived)} → ${fmtMoney(newAmount)}`)
  if (newDate.toISOString() !== old.datePmtReceived.toISOString())
    diffs.push(`Date Received: ${fmtDate(old.datePmtReceived)} → ${fmtDate(newDate)}`)
  if ((newPaidThru?.toISOString() ?? null) !== (old.paidThruDate?.toISOString() ?? null))
    diffs.push(`Paid Thru: ${fmtDate(old.paidThruDate)} → ${fmtDate(newPaidThru)}`)
  if (newNotes !== old.notes)
    diffs.push(`Notes: "${old.notes ?? ''}" → "${newNotes ?? ''}"`)

  const [payment] = await prisma.$transaction([
    prisma.payment.update({
      where: { id },
      data: { datePmtReceived: newDate, amountReceived: newAmount, paidThruDate: newPaidThru, notes: newNotes },
    }),
    ...(diffs.length > 0 ? [prisma.paymentAuditLog.create({
      data: { paymentId: id, changes: diffs.join(' · ') },
    })] : []),
  ])

  return NextResponse.json(payment)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const payment = await prisma.payment.findUnique({ where: { id } })
  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  await prisma.payment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
