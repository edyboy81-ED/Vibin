import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { reconcile } from '@/lib/reconcile'
import { generateEmailHtml, generateEmailText } from '@/lib/emailTemplate'
import { sendEmail } from '@/lib/sendEmail'

export async function POST(req: NextRequest) {
  let to: string
  try {
    const body = await req.json()
    to = body.to ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!to) {
    return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 })
  }

  const [jobs, receipts] = await Promise.all([
    prisma.job.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.receipt.findMany({ orderBy: { date: 'asc' } }),
  ])

  const result = reconcile(jobs, receipts)
  const now = new Date()

  try {
    await sendEmail({
      to,
      subject: `Vibin Reconciliation Report — ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      html: generateEmailHtml(result, now),
      text: generateEmailText(result),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send email'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
