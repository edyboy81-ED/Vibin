import { NextRequest, NextResponse } from 'next/server'
import { buildReport } from '@/lib/reportBuilder'
import Anthropic from '@anthropic-ai/sdk'

export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get('date')
  const reportDate = dateParam ? new Date(dateParam) : new Date()
  const data = await buildReport(reportDate)
  return NextResponse.json({
    ...data,
    reportDate: data.reportDate.toISOString(),
  })
}

export async function POST(req: NextRequest) {
  const { date } = await req.json()
  const reportDate = date ? new Date(date) : new Date()
  const data = await buildReport(reportDate)

  // Collect all job-level notes from next week + future projections
  const notedJobs = [
    ...data.nextWeekSections.flatMap(s =>
      [...s.legacyRows, ...s.abRows].map(r => ({ ...r, weekDate: s.date }))
    ),
    ...data.futureSections.flatMap(s =>
      [...s.legacyRows, ...s.abRows].map(r => ({ ...r, weekDate: s.date }))
    ),
  ].filter(r => r.notes.trim())

  let keyNotes = ''

  if (notedJobs.length > 0 && process.env.ANTHROPIC_API_KEY) {
    const notesText = notedJobs
      .map(r => `${r.jobNumber} – ${r.jobName} (${r.weekDate}, $${(r.estimatedAmountOwed / 100).toFixed(2)}): ${r.notes}`)
      .join('\n')

    const client = new Anthropic()
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are writing the "Key Notes" section of a leadership weekly AR email.

Summarize the important context from these job-level notes for leadership. Rules:
- Summarize patterns across multiple jobs rather than listing every job one-by-one
- Call out specific jobs only when the amount is material, the risk is important, or the timing is uncertain
- Flag no-net-cash-inflow items, settlements, vendor/lien/owner dependencies, delayed payments, subcontractor disputes, joint venture timing, and unusually large items
- Do not create assumptions beyond what is stated
- Skip blank or trivial notes
- Write 3-6 concise bullet points using a • character
- Do not add a header or preamble — start directly with the first bullet

Notes:
${notesText}

Output only the bullet points.`,
      }],
    })
    keyNotes = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  } else if (notedJobs.length > 0) {
    // Fallback when no API key: list notes verbatim
    keyNotes = notedJobs
      .map(r => `• ${r.jobNumber} – ${r.jobName}: ${r.notes}`)
      .join('\n')
  }

  return NextResponse.json({
    keyNotes,
    reportDate: data.reportDate.toISOString(),
  })
}
