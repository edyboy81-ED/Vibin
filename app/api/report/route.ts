import { NextRequest, NextResponse } from 'next/server'
import { buildReport } from '@/lib/reportBuilder'
import { dollars, fmtDate } from '@/lib/format'
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

  const variance = data.combinedReceiptsTotal - data.thisWeekProjectedTotal
  const pct = data.thisWeekProjectedTotal > 0
    ? (variance / data.thisWeekProjectedTotal * 100).toFixed(1)
    : null

  // Collect all job-level notes from projected + last week status
  const projNotes = [
    ...data.nextWeekSections.flatMap(s =>
      [...s.legacyRows, ...s.abRows].map(r => ({ ...r, weekDate: s.date }))
    ),
    ...data.futureSections.flatMap(s =>
      [...s.legacyRows, ...s.abRows].map(r => ({ ...r, weekDate: s.date }))
    ),
  ].filter(r => r.notes.trim())

  const lastWeekNotes = data.lastWeekStatus.filter(r => r.notes.trim())

  if (!process.env.ANTHROPIC_API_KEY) {
    // Fallback: list notes verbatim as bullets
    const bullets: string[] = []
    if (pct !== null) {
      bullets.push(`• Collections came in ${pct}% ${variance >= 0 ? 'above' : 'below'} target (${variance >= 0 ? '+' : ''}${dollars(variance)}).`)
    }
    for (const r of projNotes) {
      bullets.push(`• ${r.jobNumber} – ${r.jobName} (${r.weekDate}): ${r.notes}`)
    }
    for (const r of lastWeekNotes) {
      bullets.push(`• ${r.jobNumber} – ${r.jobName} (last week): ${r.notes}`)
    }
    return NextResponse.json({ keyNotes: bullets.join('\n') })
  }

  // Build context block for Claude
  const contextParts: string[] = []

  contextParts.push(`Report date: ${fmtDate(data.reportDate.toISOString())}`)
  contextParts.push(`Collections this week: Legacy ${dollars(data.legacyReceiptsTotal)}, AB ${dollars(data.abReceiptsTotal)}, Combined ${dollars(data.combinedReceiptsTotal)}`)
  if (data.thisWeekProjectedTotal > 0) {
    contextParts.push(`Target: ${dollars(data.thisWeekProjectedTotal)}, Variance: ${variance >= 0 ? '+' : ''}${dollars(variance)} (${pct}%)`)
  }

  if (data.suretyBreakdown.length > 0) {
    contextParts.push('\nSurety breakdown:')
    for (const r of data.suretyBreakdown) {
      contextParts.push(`  ${r.label}: received ${dollars(r.receiptsTotal)}, next week ${dollars(r.nextWeekTotal)}, future ${dollars(r.futureTotal)}`)
    }
  }

  const allSections = [
    ...data.nextWeekSections.map(s => ({ ...s, period: 'Next Week' })),
    ...data.futureSections.map(s => ({ ...s, period: 'Future' })),
  ]
  if (allSections.length > 0) {
    contextParts.push('\nProjected payment periods:')
    for (const s of allSections) {
      const combined = s.legacyTotal + s.abTotal
      contextParts.push(`  Week of ${s.date} (${s.period}): Legacy ${dollars(s.legacyTotal)}, AB ${dollars(s.abTotal)}, Combined ${dollars(combined)}`)
    }
  }

  if (projNotes.length > 0) {
    contextParts.push('\nProjection notes:')
    for (const r of projNotes) {
      contextParts.push(`  ${r.jobNumber} – ${r.jobName} (${r.weekDate}, ${dollars(r.estimatedAmountOwed)}): ${r.notes}`)
    }
  }

  if (lastWeekNotes.length > 0) {
    contextParts.push('\nLast week notes:')
    for (const r of lastWeekNotes) {
      contextParts.push(`  ${r.jobNumber} – ${r.jobName} (${r.statusName}, ${dollars(r.estimatedAmountOwed)}): ${r.notes}`)
    }
  }

  if (data.movedOut.length > 0) {
    contextParts.push('\nMoved to future date:')
    for (const r of data.movedOut) {
      const reason = r.reason.trim() || 'no reason given'
      contextParts.push(`  ${r.jobNumber} – ${r.jobName}: ${dollars(r.estimatedAmountOwed)} moved to ${r.newDate} (${reason})`)
    }
  }

  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are writing the "Key Notes" section of a leadership weekly AR email.

Source data:
${contextParts.join('\n')}

Rules:
- Summarize patterns across multiple jobs rather than listing every job individually
- Lead with whether collections were above or below target (if applicable)
- Call out the largest projected period and largest surety concentration
- Flag material next-week projected payments
- Flag no-net-cash-inflow items, settlements, vendor/lien/owner dependencies, delayed or uncertain payments, subcontractor disputes, joint venture timing, and material amount or date changes
- Do not create assumptions beyond what is stated in the source data
- Skip blank or trivial notes
- Write 4-7 concise bullet points using a • character
- Do not add a header or preamble — start directly with the first bullet

Output only the bullet points.`,
    }],
  })

  const keyNotes = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  return NextResponse.json({ keyNotes })
}
