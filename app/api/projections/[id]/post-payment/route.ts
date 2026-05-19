import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

function formatMoney(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { datePmtReceived, amountReceived } = await req.json()

    if (!datePmtReceived || amountReceived == null) {
      return NextResponse.json({ error: 'datePmtReceived and amountReceived are required' }, { status: 400 })
    }

    const projection = await prisma.projectedPayment.findUnique({
      where: { id },
      include: { status: true },
    })

    if (!projection) return NextResponse.json({ error: 'Projection not found' }, { status: 404 })
    if (!projection.jobId) return NextResponse.json({ error: 'This projection is not linked to a job.' }, { status: 422 })

    const [receivedStatus, partialStatus] = await Promise.all([
      prisma.projectionStatus.findFirst({ where: { name: { equals: 'Received', mode: 'insensitive' } } }),
      prisma.projectionStatus.findFirst({ where: { name: { equals: 'Partial', mode: 'insensitive' } } }),
    ])

    if (!receivedStatus) return NextResponse.json({ error: '"Received" status not found. Add it in Settings.' }, { status: 422 })

    const amountCents = Math.round(Number(amountReceived))
    const currentBalance = projection.estimatedAmountOwed
    const isFullyPaid = amountCents >= currentBalance
    const remainingBalance = isFullyPaid ? 0 : currentBalance - amountCents

    const noteContent = isFullyPaid
      ? `[System] Payment of ${formatMoney(amountCents)} received. Projection fully paid.`
      : `[System] Partial payment of ${formatMoney(amountCents)} received. Balance reduced from ${formatMoney(currentBalance)} to ${formatMoney(remainingBalance)}.`

    // Try with projectionId link first; fall back if migration not yet applied
    try {
      await prisma.$transaction([
        prisma.payment.create({
          data: {
            jobId: projection.jobId,
            projectionId: id,
            datePmtReceived: new Date(datePmtReceived),
            amountReceived: amountCents,
          },
        }),
        prisma.projectedPayment.update({
          where: { id },
          data: {
            statusId: isFullyPaid ? receivedStatus.id : (partialStatus?.id ?? receivedStatus.id),
            estimatedAmountOwed: isFullyPaid ? currentBalance : remainingBalance,
            notes: { create: [{ content: noteContent }] },
          },
        }),
      ])
    } catch {
      await prisma.$transaction([
        prisma.payment.create({
          data: {
            jobId: projection.jobId,
            datePmtReceived: new Date(datePmtReceived),
            amountReceived: amountCents,
          },
        }),
        prisma.projectedPayment.update({
          where: { id },
          data: {
            statusId: isFullyPaid ? receivedStatus.id : (partialStatus?.id ?? receivedStatus.id),
            estimatedAmountOwed: isFullyPaid ? currentBalance : remainingBalance,
            notes: { create: [{ content: noteContent }] },
          },
        }),
      ])
    }

    return NextResponse.json({ ok: true, isFullyPaid, remainingBalance })
  } catch (err) {
    console.error('post-payment error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
