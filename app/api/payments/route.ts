import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const jobSelect = {
  id: true,
  jobNumber: true,
  jobName: true,
  company: true,
  division: true,
  customer: true,
  jobStatus: true,
  _count: { select: { projections: true } },
} as const

export async function GET() {
  // Try with projection link first; fall back if the migration hasn't run yet
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { datePmtReceived: 'desc' },
      include: {
        job: { select: jobSelect },
        projection: { select: { estimateNumber: true } },
      },
    })
    return NextResponse.json(payments)
  } catch {
    const payments = await prisma.payment.findMany({
      orderBy: { datePmtReceived: 'desc' },
      include: { job: { select: jobSelect } },
    })
    return NextResponse.json(payments.map(p => ({ ...p, projection: null })))
  }
}
