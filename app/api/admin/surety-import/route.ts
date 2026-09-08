import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { normalizeSurety } from '@/lib/surety'

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// Bulk-assign surety to existing jobs via CSV (job #, surety).
// Also updates all active projections linked to those jobs.
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const text = await file.text()
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 })

  const JOB_ALIASES = ['job', 'job #', 'job#', 'job number', 'jobnumber']
  const SURETY_ALIASES = ['surety', 'surety type', 'bond', 'bond type', 'surety bond']

  // Find the first row that looks like a header (contains a job # and surety column)
  let headerRowIndex = -1
  let jobNumCol = -1
  let suretyCol = -1
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = parseCSVLine(lines[i]).map(h => h.trim().toLowerCase().replace(/\s+/g, ' '))
    const j = cols.findIndex(h => JOB_ALIASES.includes(h))
    const s = cols.findIndex(h => SURETY_ALIASES.includes(h))
    if (j !== -1 && s !== -1) { headerRowIndex = i; jobNumCol = j; suretyCol = s; break }
  }

  if (headerRowIndex === -1) return NextResponse.json({ error: 'Could not find a Job # column' }, { status: 400 })

  const rows = lines.slice(headerRowIndex + 1).map(line => {
    const vals = parseCSVLine(line)
    return { jobNumber: (vals[jobNumCol] ?? '').trim(), surety: (vals[suretyCol] ?? '').trim() }
  }).filter(r => r.jobNumber)

  const stats = { updated: 0, notFound: 0, projectionsUpdated: 0 }
  const notFound: string[] = []

  for (const row of rows) {
    const surety = normalizeSurety(row.surety)
    const job = await prisma.job.findUnique({ where: { jobNumber: row.jobNumber } })
    if (!job) { stats.notFound++; notFound.push(row.jobNumber); continue }

    await prisma.job.update({ where: { id: job.id }, data: { surety } })
    stats.updated++

    // Update all active projections for this job
    const result = await prisma.projectedPayment.updateMany({
      where: { jobId: job.id, isActive: true },
      data: { surety },
    })
    stats.projectionsUpdated += result.count
  }

  return NextResponse.json({ stats, notFound, totalRows: rows.length })
}
