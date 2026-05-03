import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const payments = await prisma.payment.findMany({
    orderBy: { datePmtReceived: 'desc' },
    include: {
      job: {
        select: {
          id: true,
          jobNumber: true,
          jobName: true,
          company: true,
          division: true,
          customer: true,
          jobStatus: true,
          _count: { select: { projections: true } },
        },
      },
    },
  })
  return NextResponse.json(payments)
}
