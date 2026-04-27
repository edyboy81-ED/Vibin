import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Lightweight search endpoint used by the Add Projection auto-fill
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json([])

  const jobs = await prisma.job.findMany({
    where: {
      OR: [
        { jobNumber: { contains: q, mode: 'insensitive' } },
        { jobName: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, jobNumber: true, jobName: true, company: true, division: true },
    orderBy: { jobNumber: 'asc' },
    take: 10,
  })
  return NextResponse.json(jobs)
}
