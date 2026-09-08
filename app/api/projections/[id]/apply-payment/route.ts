import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

function formatMoney(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Applies an already-recorded payment to a projection (no payment creation).
// Used from the Job Detail page banner after a payment has been logged.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { amountReceived } = await req.json()

  if (amountReceived == null) {
    return NextResponse.json({ error: 'amountReceived is required' }, { status: 400 })
  }

  const projection = await prisma.projectedPayment.findUnique({
    where: { id },
    include: { status: true },
  })

  if (!projection) return NextResponse.json({ error: 'Projection not found' }, { status: 404 })

  const [archivedStatus, partialStatus] = await Promise.all([
    prisma.projectionStatus.findFirst({ where: { name: { equals: 'Archived', mode: 'insensitive' } } }),
    prisma.projectionStatus.findFirst({ where: { name: { equals: 'Partial', mode: 'insensitive' } } }),
  ])

  // Fall back to Received if Archived status hasn't been seeded yet
  const fullyPaidStatus = archivedStatus
    ?? await prisma.projectionStatus.findFirst({ where: { name: { equals: 'Received', mode: 'insensitive' } } })

  if (!fullyPaidStatus) return NextResponse.json({ error: '"Archived" status not found. Run the pending migration.' }, { status: 422 })

  const amountCents = Math.round(Number(amountReceived))
  const currentBalance = projection.estimatedAmountOwed
  const isFullyPaid = amountCents >= currentBalance
  const remainingBalance = isFullyPaid ? 0 : currentBalance - amountCents

  const noteContent = isFullyPaid
    ? `[System] Payment of ${formatMoney(amountCents)} applied. Projection fully paid and archived.`
    : `[System] Partial payment of ${formatMoney(amountCents)} applied. Balance reduced from ${formatMoney(currentBalance)} to ${formatMoney(remainingBalance)}.`

  await prisma.projectedPayment.update({
    where: { id },
    data: {
      statusId: isFullyPaid ? fullyPaidStatus.id : (partialStatus?.id ?? fullyPaidStatus.id),
      estimatedAmountOwed: isFullyPaid ? currentBalance : remainingBalance,
      notes: { create: [{ content: noteContent }] },
    },
  })

  return NextResponse.json({ ok: true, isFullyPaid, remainingBalance })
}
