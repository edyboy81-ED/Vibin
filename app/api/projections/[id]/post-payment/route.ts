import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { datePmtReceived, amountReceived } = await req.json()

  if (!datePmtReceived || amountReceived == null) {
    return NextResponse.json({ error: 'datePmtReceived and amountReceived are required' }, { status: 400 })
  }

  const projection = await prisma.projectedPayment.findUnique({
    where: { id },
    select: { jobId: true },
  })

  if (!projection) {
    return NextResponse.json({ error: 'Projection not found' }, { status: 404 })
  }

  if (!projection.jobId) {
    return NextResponse.json({ error: 'This projection is not linked to a job. Link it to a job before posting a payment.' }, { status: 422 })
  }

  const receivedStatus = await prisma.projectionStatus.findFirst({
    where: { name: 'Received' },
  })

  if (!receivedStatus) {
    return NextResponse.json({ error: '"Received" status not found. Add it in Settings before posting payments.' }, { status: 422 })
  }

  const amountCents = Math.round(Number(amountReceived))

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
      data: { statusId: receivedStatus.id },
    }),
  ])

  return NextResponse.json({ ok: true })
}
