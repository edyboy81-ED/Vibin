import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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

const ALIASES: Record<string, string[]> = {
  jobNumber:             ['job', 'job #', 'job#', 'job number', 'jobnumber'],
  jobName:               ['job name', 'jobname', 'name'],
  company:               ['company'],
  estimateNumber:        ['estimate #', 'estimate#', 'estimate number', 'estimatenumber', 'est #', 'est#', 'est number'],
  billingPeriod:         ['billing period', 'billingperiod', 'billing', 'final billing period', 'finalbillingperiod', 'final billing'],
  monthYear:             ['month/year', 'month year', 'monthyear', 'month'],
  estimatedAmountOwed:   ['amount owed', 'estimated amount', 'estimated amount owed', 'amountowed', 'amount'],
  estimatedPaymentDate:  ['expected payment date', 'est payment date', 'estimated payment date', 'payment date', 'expected date', 'est date'],
  status:                ['status'],
  notes:                 ['notes', 'note', 'comments'],
}

function resolveColumns(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [field, aliases] of Object.entries(ALIASES)) {
    const match = headers.find(h => aliases.includes(h.toLowerCase().replace(/\s+/g, ' ')))
    if (match) map[field] = match
  }
  return map
}

function parseDate(s: string): Date | null {
  if (!s || s === '—' || s.toLowerCase() === 'n/a') return null
  const mdyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y)
    const dt = new Date(Date.UTC(year, parseInt(m) - 1, parseInt(d)))
    return isNaN(dt.getTime()) ? null : dt
  }
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    const dt = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d)))
    return isNaN(dt.getTime()) ? null : dt
  }
  return null
}

function formatMoney(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dt: Date): string {
  return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}/${dt.getUTCFullYear()}`
}

function isExcelDateCorrupted(jobNumber: string): boolean {
  return /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d+$/i.test(jobNumber)
}

function parseMoney(s: string): number | null {
  if (!s || s === '—') return null
  const clean = s.replace(/[$,\s]/g, '')
  const n = parseFloat(clean)
  return isNaN(n) ? null : Math.round(n * 100)
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const corrections: Record<string, string> = JSON.parse(formData.get('corrections') as string || '{}')
  const partialResolutions: Record<string, 'update' | 'keep'> = JSON.parse(formData.get('partialResolutions') as string || '{}')

  const text = await file.text()
  const rows = parseCSV(text)
  if (rows.length === 0) return NextResponse.json({ error: 'CSV is empty or unreadable' }, { status: 400 })

  const headers = Object.keys(rows[0])
  const colMap = resolveColumns(headers)

  if (!colMap.jobNumber) {
    return NextResponse.json({
      error: 'Could not find a "Job #" or "Job" column.',
      detectedColumns: headers,
    }, { status: 400 })
  }
  if (!colMap.estimatedPaymentDate) {
    return NextResponse.json({
      error: 'Could not find an "Expected Payment Date" column.',
      detectedColumns: headers,
    }, { status: 400 })
  }
  if (!colMap.estimatedAmountOwed) {
    return NextResponse.json({
      error: 'Could not find an "Amount Owed" column.',
      detectedColumns: headers,
    }, { status: 400 })
  }

  // Scan for corrupted job numbers before doing any DB writes
  const corruptedMap = new Map<string, { count: number; sampleJobName: string }>()
  for (const row of rows) {
    const jobNumber = (colMap.jobNumber ? row[colMap.jobNumber] ?? '' : '').trim()
    if (!jobNumber || !isExcelDateCorrupted(jobNumber)) continue
    if (corrections[jobNumber]) continue
    const existing = corruptedMap.get(jobNumber)
    const sampleJobName = (colMap.jobName ? row[colMap.jobName] ?? '' : '').trim() || jobNumber
    corruptedMap.set(jobNumber, { count: (existing?.count ?? 0) + 1, sampleJobName: existing?.sampleJobName ?? sampleJobName })
  }

  if (corruptedMap.size > 0) {
    return NextResponse.json({
      needsCorrection: true,
      corruptedValues: Array.from(corruptedMap.entries()).map(([value, { count, sampleJobName }]) => ({ value, count, sampleJobName })),
    })
  }

  const [allJobs, allStatuses] = await Promise.all([
    prisma.job.findMany({ select: { id: true, jobNumber: true, jobName: true, company: true, division: true } }),
    prisma.projectionStatus.findMany(),
  ])
  const jobMap = new Map(allJobs.map(j => [j.jobNumber, j]))
  const statusMap = new Map(allStatuses.map(s => [s.name.toLowerCase(), s]))
  const defaultStatus = statusMap.get('projected') ?? allStatuses[0]

  // Pre-scan for partial projection conflicts
  const partialProjections = await prisma.projectedPayment.findMany({
    where: { status: { name: 'Partial' }, isActive: true },
    select: { id: true, jobId: true, estimateNumber: true, estimatedAmountOwed: true, jobNumber: true, jobName: true },
  })
  const partialMap = new Map(partialProjections.map(p => [`${p.jobId}:${p.estimateNumber}`, p]))

  const partialConflicts: { id: string; jobNumber: string; estimateNumber: string; currentBalance: number; csvAmount: number }[] = []
  for (const row of rows) {
    const get = (field: string) => colMap[field] ? row[colMap[field]] ?? '' : ''
    let jn = get('jobNumber').trim()
    if (corrections[jn]) jn = corrections[jn].trim()
    const job = jobMap.get(jn)
    if (!job) continue
    const en = get('estimateNumber') || '—'
    const csvAmount = parseMoney(get('estimatedAmountOwed'))
    const partial = partialMap.get(`${job.id}:${en}`)
    if (partial && csvAmount !== null && partial.estimatedAmountOwed !== csvAmount && !partialResolutions[partial.id]) {
      if (!partialConflicts.find(c => c.id === partial.id)) {
        partialConflicts.push({ id: partial.id, jobNumber: partial.jobNumber, estimateNumber: partial.estimateNumber, currentBalance: partial.estimatedAmountOwed, csvAmount })
      }
    }
  }

  if (partialConflicts.length > 0) {
    return NextResponse.json({ needsPartialReview: true, partialConflicts })
  }

  const stats = { created: 0, updated: 0, skipped: 0, rowsSkipped: 0 }
  const errors: string[] = []
  const unmatched: object[] = []

  for (const [rowIndex, row] of rows.entries()) {
    const get = (field: string) => colMap[field] ? row[colMap[field]] ?? '' : ''

    let jobNumber = get('jobNumber').trim()
    if (!jobNumber) { stats.rowsSkipped++; continue }

    // Apply user-provided corrections
    if (corrections[jobNumber]) jobNumber = corrections[jobNumber].trim()

    const estimatedPaymentDate = parseDate(get('estimatedPaymentDate'))
    if (!estimatedPaymentDate) {
      errors.push(`Row ${rowIndex + 2}: Invalid or missing payment date for job ${jobNumber}`)
      stats.rowsSkipped++
      continue
    }

    const estimatedAmountOwed = parseMoney(get('estimatedAmountOwed'))
    if (estimatedAmountOwed == null || estimatedAmountOwed <= 0) {
      errors.push(`Row ${rowIndex + 2}: Invalid or missing amount for job ${jobNumber}`)
      stats.rowsSkipped++
      continue
    }

    const estimateNumber = get('estimateNumber') || '—'
    const billingPeriod = get('billingPeriod') || '—'
    const monthYear = get('monthYear') || `${estimatedPaymentDate.getMonth() + 1}/${estimatedPaymentDate.getFullYear()}`
    const notes = get('notes') || null

    const statusName = get('status').toLowerCase()
    const status = (statusName && statusMap.get(statusName)) ? statusMap.get(statusName)! : defaultStatus

    if (!status) {
      errors.push(`Row ${rowIndex + 2}: No projection statuses configured`)
      stats.rowsSkipped++
      continue
    }

    const job = jobMap.get(jobNumber)

    if (!job) {
      // Collect for the user to review and create jobs manually
      unmatched.push({
        rowIndex: rowIndex + 2,
        jobNumber,
        jobName: get('jobName') || '',
        company: get('company') || '',
        estimateNumber,
        billingPeriod,
        monthYear,
        estimatedAmountOwed,
        estimatedPaymentDate: estimatedPaymentDate.toISOString(),
        statusId: status.id,
        statusName: status.name,
        notes,
      })
      continue
    }

    const existing = await prisma.projectedPayment.findFirst({
      where: { jobId: job.id, estimateNumber },
      include: { status: true, notes: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })

    if (existing) {
      const updateData: Record<string, unknown> = {}
      const noteLines: string[] = []

      const existingDateStr = existing.estimatedPaymentDate.toISOString().split('T')[0]
      const csvDateStr = estimatedPaymentDate.toISOString().split('T')[0]
      if (existingDateStr !== csvDateStr) {
        updateData.estimatedPaymentDate = estimatedPaymentDate
        noteLines.push(`Import update: Payment date changed from ${formatDate(existing.estimatedPaymentDate)} to ${formatDate(estimatedPaymentDate)}`)
      }

      const isPartial = existing.status?.name?.toLowerCase() === 'partial'
      if (existing.estimatedAmountOwed !== estimatedAmountOwed) {
        if (isPartial) {
          if (partialResolutions[existing.id] === 'update') {
            updateData.estimatedAmountOwed = estimatedAmountOwed
            noteLines.push(`[System] Import update: Amount updated to ${formatMoney(estimatedAmountOwed)} per CSV.`)
          }
          // if 'keep', skip amount update silently
        } else {
          updateData.estimatedAmountOwed = estimatedAmountOwed
          noteLines.push(`Import update: Amount changed from ${formatMoney(existing.estimatedAmountOwed)} to ${formatMoney(estimatedAmountOwed)}`)
        }
      }

      if (billingPeriod !== '—' && existing.billingPeriod !== billingPeriod) {
        updateData.billingPeriod = billingPeriod
      }

      if (notes) {
        noteLines.push(notes)
      }

      if (Object.keys(updateData).length > 0 || noteLines.length > 0) {
        await prisma.projectedPayment.update({
          where: { id: existing.id },
          data: {
            ...updateData,
            ...(noteLines.length > 0 ? { notes: { create: [{ content: noteLines.join('\n') }] } } : {}),
          },
        })
        stats.updated++
      } else {
        stats.skipped++
      }
      continue
    }

    await prisma.projectedPayment.create({
      data: {
        jobId: job.id,
        jobNumber: job.jobNumber,
        jobName: job.jobName,
        company: job.company,
        division: job.division,
        monthYear,
        estimateNumber,
        billingPeriod,
        estimatedAmountOwed,
        estimatedPaymentDate,
        statusId: status.id,
        isActive: true,
        notes: notes ? { create: [{ content: notes }] } : undefined,
      },
    })
    stats.created++
  }

  return NextResponse.json({ stats, errors, unmatched, totalRows: rows.length, detectedColumns: Object.keys(colMap) })
}
