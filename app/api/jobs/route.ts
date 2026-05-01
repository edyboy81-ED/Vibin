import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDivision } from '@/lib/companies'

export async function GET() {
  const jobs = await prisma.job.findMany({
    orderBy: { jobNumber: 'asc' },
    include: {
      payments: { orderBy: { datePmtReceived: 'desc' }, take: 1 },
      _count: { select: { projections: true } },
    },
  })
  return NextResponse.json(jobs)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { jobNumber, jobName, company, jobStatus, paidThruDate, billedThruDate, nextAmountDue, customer, notes } = body

  if (!jobNumber || !jobName || !company) {
    return NextResponse.json({ error: 'jobNumber, jobName, and company are required' }, { status: 400 })
  }

  try {
    const job = await prisma.job.create({
      data: {
        jobNumber: String(jobNumber).trim(),
        jobName: String(jobName).trim(),
        company: String(company),
        division: getDivision(String(company)),
        jobStatus: jobStatus ?? 'IN_PROGRESS',
        paidThruDate: paidThruDate ? new Date(paidThruDate) : null,
        billedThruDate: billedThruDate ? new Date(billedThruDate) : null,
        nextAmountDue: nextAmountDue != null ? Math.round(Number(nextAmountDue)) : null,
        customer: customer ? String(customer).trim() : null,
        notes: notes ? String(notes) : null,
      },
    })
    return NextResponse.json(job, { status: 201 })
  } catch (err: any) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'A job with this number already exists' }, { status: 409 })
    }
    throw err
  }
}
