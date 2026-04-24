import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const receipts = await prisma.receipt.findMany({ orderBy: { date: 'desc' } })
  return NextResponse.json(receipts)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { jobNumber, company, amount, date, description } = body as Record<string, unknown>

  if (!jobNumber || !company || typeof amount !== 'number' || !date) {
    return NextResponse.json(
      { error: 'jobNumber, company, amount, and date are required' },
      { status: 400 },
    )
  }

  const receipt = await prisma.receipt.create({
    data: {
      jobNumber: String(jobNumber),
      company: company as never,
      amount: Math.round(Number(amount)),
      date: new Date(String(date)),
      description: description ? String(description) : null,
    },
  })
  return NextResponse.json(receipt, { status: 201 })
}
