import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id: projectionId } = await params
  const { content } = await req.json()

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Note content is required' }, { status: 400 })
  }

  const note = await prisma.projectionNote.create({
    data: { projectionId, content: String(content).trim() },
  })
  return NextResponse.json(note, { status: 201 })
}
