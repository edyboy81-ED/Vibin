import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { toDate, reason } = await req.json()

  if (!toDate) {
    return NextResponse.json({ error: 'toDate is required' }, { status: 400 })
  }

  const current = await prisma.projectedPayment.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const movedStatus = await prisma.projectionStatus.findFirst({ where: { name: 'Moved' } })

  const [projection] = await prisma.$transaction([
    prisma.projectedPayment.update({
      where: { id },
      data: {
        estimatedPaymentDate: new Date(toDate),
        statusId: movedStatus?.id ?? current.statusId,
      },
      include: { status: true },
    }),
    prisma.projectionMovement.create({
      data: {
        projectionId: id,
        fromDate: current.estimatedPaymentDate,
        toDate: new Date(toDate),
        reason: reason || null,
      },
    }),
  ])

  return NextResponse.json(projection)
}
