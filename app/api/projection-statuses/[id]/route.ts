import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { name, color } = await req.json()
  const status = await prisma.projectionStatus.update({
    where: { id },
    data: {
      name: name ? String(name).trim() : undefined,
      color: color ?? undefined,
    },
  })
  return NextResponse.json(status)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const status = await prisma.projectionStatus.findUnique({ where: { id } })
  if (status?.isSystem) {
    return NextResponse.json({ error: 'System statuses cannot be deleted' }, { status: 403 })
  }
  await prisma.projectionStatus.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
