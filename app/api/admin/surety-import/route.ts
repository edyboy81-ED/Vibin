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

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, ' '))

  const jobNumCol = headers.findIndex(h => ['job', 'job #', 'job#', 'job number', 'jobnumber'].includes(h))
  const suretyCol = headers.findIndex(h => ['surety', 'surety type', 'bond', 'bond type', 'surety bond'].includes(h))

  if (jobNumCol === -1) return NextResponse.json({ error: 'Could not find a Job # column' }, { status: 400 })
  if (suretyCol === -1) return NextResponse.json({ error: 'Could not find a Surety column' }, { status: 400 })

  const rows = lines.slice(1).map(line => {
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
