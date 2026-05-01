import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDivision } from '@/lib/companies'

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

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

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, ' '))
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim() })
    return row
  }).filter(row => Object.values(row).some(v => v !== ''))
}

// ---------------------------------------------------------------------------
// Column resolution — handles our export format + common spreadsheet variants
// ---------------------------------------------------------------------------

const ALIASES: Record<string, string[]> = {
  jobNumber:        ['job', 'job #', 'job#', 'job number', 'jobnumber'],
  jobName:          ['job name', 'jobname', 'name'],
  company:          ['company'],
  customer:         ['customer', 'customer name', 'customername'],
  jobStatus:        ['job status', 'jobstatus', 'status'],
  paidThruDate:     ['paid thru date', 'paidthrudate', 'paid thru', 'paid through date', 'paid through'],
  billedThruDate:   ['billed thru date', 'billedthrudate', 'billed thru', 'billed through date', 'billed through'],
  datePmtReceived:  ['date pmt received', 'date pmt', 'date received', 'datepmt', 'datepmt received', 'payment date', 'date payment received'],
  amountReceived:   ['amount received', 'amountreceived', 'amount', 'payment amount'],
  nextAmountDue:    ['next amount due', 'nextamountdue', 'next due', 'next amount'],
  notes:            ['notes', 'note', 'comments'],
}

function resolveColumns(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [field, aliases] of Object.entries(ALIASES)) {
    const match = headers.find(h => aliases.includes(h.toLowerCase().replace(/\s+/g, ' ')))
    if (match) map[field] = match
  }
  return map
}

// ---------------------------------------------------------------------------
// Value parsers
// ---------------------------------------------------------------------------

function parseDate(s: string): Date | null {
  if (!s || s === '—' || s.toLowerCase() === 'n/a') return null
  // M/D/YYYY or M/D/YY
  const mdyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y)
    const dt = new Date(year, parseInt(m) - 1, parseInt(d))
    return isNaN(dt.getTime()) ? null : dt
  }
  // YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const dt = new Date(s)
    return isNaN(dt.getTime()) ? null : dt
  }
  return null
}

function parseMoney(s: string): number | null {
  if (!s || s === '—') return null
  const clean = s.replace(/[$,\s]/g, '')
  const n = parseFloat(clean)
  return isNaN(n) ? null : Math.round(n * 100)
}

function parseJobStatus(s: string): 'IN_PROGRESS' | 'CLOSED' {
  const lower = s.toLowerCase()
  if (lower.includes('close') || lower === 'closed') return 'CLOSED'
  return 'IN_PROGRESS'
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const text = await file.text()
  const rows = parseCSV(text)
  if (rows.length === 0) return NextResponse.json({ error: 'CSV is empty or unreadable' }, { status: 400 })

  const headers = Object.keys(rows[0])
  const colMap = resolveColumns(headers)

  if (!colMap.jobNumber) {
    return NextResponse.json({
      error: 'Could not find a "Job #" or "Job" column. Make sure your CSV has a job number column.',
      detectedColumns: headers,
    }, { status: 400 })
  }

  const stats = { jobsCreated: 0, jobsUpdated: 0, paymentsCreated: 0, paymentsSkipped: 0, rowsSkipped: 0 }
  const errors: string[] = []

  for (const [rowIndex, row] of rows.entries()) {
    const get = (field: string) => colMap[field] ? row[colMap[field]] ?? '' : ''

    const jobNumber = get('jobNumber').trim()
    if (!jobNumber) { stats.rowsSkipped++; continue }

    const jobName = get('jobName') || jobNumber
    const company = get('company') || 'Johnson Bros Corporation'
    const division = getDivision(company)
    const customer = get('customer') || null
    const jobStatus = parseJobStatus(get('jobStatus'))
    const paidThruDate = parseDate(get('paidThruDate'))
    const billedThruDate = parseDate(get('billedThruDate'))
    const nextAmountDue = parseMoney(get('nextAmountDue'))
    const notes = get('notes') || null

    // Upsert job
    try {
      const existing = await prisma.job.findUnique({ where: { jobNumber } })
      if (existing) {
        await prisma.job.update({
          where: { jobNumber },
          data: { jobName, company, division, customer, jobStatus, paidThruDate, billedThruDate, nextAmountDue, notes },
        })
        stats.jobsUpdated++
      } else {
        await prisma.job.create({
          data: { jobNumber, jobName, company, division, customer, jobStatus, paidThruDate, billedThruDate, nextAmountDue, notes },
        })
        stats.jobsCreated++
      }
    } catch (e) {
      errors.push(`Row ${rowIndex + 2}: Failed to upsert job ${jobNumber}`)
      stats.rowsSkipped++
      continue
    }

    // Create payment if data present
    const datePmtReceived = parseDate(get('datePmtReceived'))
    const amountReceived = parseMoney(get('amountReceived'))

    if (datePmtReceived && amountReceived != null && amountReceived > 0) {
      const job = await prisma.job.findUnique({ where: { jobNumber } })
      if (job) {
        // Check for duplicate (same job + same date)
        const duplicate = await prisma.payment.findFirst({
          where: { jobId: job.id, datePmtReceived },
        })
        if (duplicate) {
          stats.paymentsSkipped++
        } else {
          await prisma.payment.create({
            data: { jobId: job.id, datePmtReceived, amountReceived },
          })
          stats.paymentsCreated++
        }
      }
    }
  }

  return NextResponse.json({ stats, errors, totalRows: rows.length, detectedColumns: Object.keys(colMap) })
}
