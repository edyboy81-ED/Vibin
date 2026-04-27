import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const statuses = await prisma.projectionStatus.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json(statuses)
}

export async function POST(req: NextRequest) {
  const { name, color } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const maxOrder = await prisma.projectionStatus.aggregate({ _max: { sortOrder: true } })
  const status = await prisma.projectionStatus.create({
    data: {
      name: String(name).trim(),
      color: color ?? '#6b7280',
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  })
  return NextResponse.json(status, { status: 201 })
}
