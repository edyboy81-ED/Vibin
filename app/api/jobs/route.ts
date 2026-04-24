import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET() {
  const jobs = await prisma.job.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(jobs)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { jobNumber, company, name, date, amount, notes } = body as Record<string, unknown>

  if (!jobNumber || !company || typeof amount !== 'number') {
    return NextResponse.json({ error: 'jobNumber, company, and amount are required' }, { status: 400 })
  }

  try {
    const job = await prisma.job.create({
      data: {
        jobNumber: String(jobNumber),
        company: company as never, // validated by Prisma enum; bad values throw P2009
        name: name ? String(name) : null,
        date: date ? new Date(String(date)) : null,
        amount: Math.round(Number(amount)),
        notes: notes ? String(notes) : null,
      },
    })
    return NextResponse.json(job, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { error: 'A job with this number and company already exists' },
        { status: 409 },
      )
    }
    throw err
  }
}
