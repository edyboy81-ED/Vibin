import { prisma } from './db'
import { dollars, fmtDate } from './format'

// UTC-safe helpers used only within this module
function utcStartOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}
function utcEndOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999))
}
function utcAddDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n))
}

export interface ReportSection {
  date: string           // display label e.g. "4/24/26"
  legacyTotal: number    // cents
  abTotal: number        // cents
  legacyRows: ProjectionRow[]
  abRows: ProjectionRow[]
}

export interface ProjectionRow {
  jobNumber: string
  jobName: string
  monthYear: string
  estimateNumber: string
  billingPeriod: string
  estimatedAmountOwed: number
  statusName: string
  notes: string
}

export interface LastWeekStatusRow {
  jobNumber: string
  jobName: string
  estimateNumber: string
  estimatedAmountOwed: number
  originalDate: string
  division: string
  statusName: string
  statusColor: string
  notes: string
}

export interface UnplannedReceiptRow {
  jobNumber: string
  jobName: string
  company: string
  division: string
  datePmtReceived: string
  amountReceived: number
}

export interface MovedOutRow {
  jobNumber: string
  jobName: string
  estimateNumber: string
  estimatedAmountOwed: number
  originalDate: string
  newDate: string
  reason: string
}

export interface DueNotReceivedRow {
  jobNumber: string
  jobName: string
  estimateNumber: string
  estimatedAmountOwed: number
  scheduledDate: string
  statusName: string
  notes: string
}

export interface PartiallyReceivedRow {
  jobNumber: string
  jobName: string
  estimateNumber: string
  estimatedAmountOwed: number
  scheduledDate: string
  notes: string
}

export interface ReportData {
  reportDate: Date
  // Cash receipts this week
  legacyReceiptsTotal: number
  abReceiptsTotal: number
  combinedReceiptsTotal: number
  // This week's projected target (projections due this week + moved-out projections)
  thisWeekProjectedTotal: number
  // Projections
  nextWeekSections: ReportSection[]
  futureSections: ReportSection[]
  // Last week projection status
  lastWeekStatus: LastWeekStatusRow[]
  // Unplanned receipts
  unplannedReceipts: UnplannedReceiptRow[]
  // Variance insight buckets
  movedOut: MovedOutRow[]
  dueNotReceived: DueNotReceivedRow[]
  partiallyReceived: PartiallyReceivedRow[]
}

export async function buildReport(reportDate: Date): Promise<ReportData> {
  // Parse as UTC-midnight regardless of how the Date was constructed
  const friday = utcStartOfDay(reportDate)

  // This week: Monday through report Friday
  const weekStart = utcStartOfDay(utcAddDays(friday, -4))
  const weekEnd = utcEndOfDay(friday)

  // Next week: following Monday through following Friday
  const nextWeekStart = utcStartOfDay(utcAddDays(friday, 3))
  const nextWeekEnd = utcEndOfDay(utcAddDays(friday, 7))

  // Beyond next week
  const futureStart = utcStartOfDay(utcAddDays(friday, 8))

  // Last week window: Mon–Fri of the previous week
  const lastWeekStart = utcStartOfDay(utcAddDays(friday, -11))
  const lastWeekEnd = utcEndOfDay(utcAddDays(friday, -7))

  // --- Cash receipts this week ---
  const [weekPayments, currentWeekProjections, weekMovements] = await Promise.all([
    prisma.payment.findMany({
      where: { datePmtReceived: { gte: weekStart, lte: weekEnd } },
      include: { job: { select: { division: true, jobNumber: true, jobName: true } } },
    }),
    prisma.projectedPayment.findMany({
      where: { estimatedPaymentDate: { gte: weekStart, lte: weekEnd }, isActive: true },
      include: {
        status: true,
        notes: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.projectionMovement.findMany({
      where: { fromDate: { gte: weekStart, lte: weekEnd } },
      include: {
        projection: {
          include: {
            status: true,
            notes: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const legacyReceiptsTotal = weekPayments
    .filter(p => p.job.division === 'LEGACY')
    .reduce((s, p) => s + p.amountReceived, 0)
  const abReceiptsTotal = weekPayments
    .filter(p => p.job.division === 'AB')
    .reduce((s, p) => s + p.amountReceived, 0)

  // --- Target calculation: current week projections + moved-out projections ---
  const currentWeekIdSet = new Set(currentWeekProjections.map(p => p.id))
  // Most recent movement per projection that moved it OUT of this week
  const movedOutByProjection = new Map<string, (typeof weekMovements)[0]>()
  for (const m of weekMovements) {
    if (!currentWeekIdSet.has(m.projectionId) && !movedOutByProjection.has(m.projectionId)) {
      movedOutByProjection.set(m.projectionId, m)
    }
  }
  const thisWeekProjectedTotal =
    currentWeekProjections.reduce((s, p) => s + p.estimatedAmountOwed, 0) +
    Array.from(movedOutByProjection.values()).reduce((s, m) => s + m.projection.estimatedAmountOwed, 0)

  // --- Variance insight buckets ---
  const movedOut: MovedOutRow[] = Array.from(movedOutByProjection.values()).map(m => ({
    jobNumber: m.projection.jobNumber,
    jobName: m.projection.jobName,
    estimateNumber: m.projection.estimateNumber,
    estimatedAmountOwed: m.projection.estimatedAmountOwed,
    originalDate: fmtDate(m.fromDate),
    newDate: fmtDate(m.toDate),
    reason: m.reason ?? '',
  }))

  const dueNotReceived: DueNotReceivedRow[] = currentWeekProjections
    .filter(p => !['received', 'partial'].includes(p.status.name.toLowerCase()))
    .map(p => ({
      jobNumber: p.jobNumber,
      jobName: p.jobName,
      estimateNumber: p.estimateNumber,
      estimatedAmountOwed: p.estimatedAmountOwed,
      scheduledDate: fmtDate(p.estimatedPaymentDate),
      statusName: p.status.name,
      notes: p.notes[0]?.content ?? '',
    }))

  const partiallyReceived: PartiallyReceivedRow[] = currentWeekProjections
    .filter(p => p.status.name.toLowerCase() === 'partial')
    .map(p => ({
      jobNumber: p.jobNumber,
      jobName: p.jobName,
      estimateNumber: p.estimateNumber,
      estimatedAmountOwed: p.estimatedAmountOwed,
      scheduledDate: fmtDate(p.estimatedPaymentDate),
      notes: p.notes[0]?.content ?? '',
    }))

  // --- Projections: next week ---
  const nextWeekProjections = await prisma.projectedPayment.findMany({
    where: { estimatedPaymentDate: { gte: nextWeekStart, lte: nextWeekEnd }, isActive: true, NOT: [{ status: { name: { equals: 'received', mode: 'insensitive' } } }] },
    include: {
      status: true,
      notes: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: [{ estimatedPaymentDate: 'asc' }, { division: 'asc' }, { jobNumber: 'asc' }],
  })

  // --- Projections: future ---
  const futureProjections = await prisma.projectedPayment.findMany({
    where: { estimatedPaymentDate: { gte: futureStart }, isActive: true, NOT: [{ status: { name: { equals: 'received', mode: 'insensitive' } } }] },
    include: {
      status: true,
      notes: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: [{ estimatedPaymentDate: 'asc' }, { division: 'asc' }, { jobNumber: 'asc' }],
  })

  // --- Last week projection status ---
  const lastWeekProjections = await prisma.projectedPayment.findMany({
    where: { estimatedPaymentDate: { gte: lastWeekStart, lte: lastWeekEnd } },
    include: {
      status: true,
      notes: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: [{ division: 'asc' }, { jobNumber: 'asc' }],
  })

  // --- Unplanned receipts: payments this week with no active projection ---
  const activeProjectionJobIds = new Set(
    (await prisma.projectedPayment.findMany({
      where: { isActive: true },
      select: { jobId: true },
    }))
      .map(p => p.jobId)
      .filter(Boolean) as string[]
  )

  const unplanned = weekPayments.filter(
    p => !activeProjectionJobIds.has(p.jobId)
  )

  return {
    reportDate: friday,
    legacyReceiptsTotal,
    abReceiptsTotal,
    combinedReceiptsTotal: legacyReceiptsTotal + abReceiptsTotal,
    thisWeekProjectedTotal,
    nextWeekSections: groupByDate(nextWeekProjections),
    futureSections: groupByDate(futureProjections),
    lastWeekStatus: lastWeekProjections.map(p => ({
      jobNumber: p.jobNumber,
      jobName: p.jobName,
      estimateNumber: p.estimateNumber,
      estimatedAmountOwed: p.estimatedAmountOwed,
      originalDate: fmtDate(p.estimatedPaymentDate),
      division: p.division,
      statusName: p.status.name,
      statusColor: p.status.color,
      notes: p.notes[0]?.content ?? '',
    })),
    unplannedReceipts: unplanned.map(p => ({
      jobNumber: p.job.jobNumber,
      jobName: p.job.jobName,
      company: '',
      division: p.job.division,
      datePmtReceived: fmtDate(p.datePmtReceived),
      amountReceived: p.amountReceived,
    })),
    movedOut,
    dueNotReceived,
    partiallyReceived,
  }
}

function groupByDate(projections: any[]): ReportSection[] {
  const map = new Map<string, ReportSection>()
  for (const p of projections) {
    const key = fmtDate(p.estimatedPaymentDate)
    if (!map.has(key)) {
      map.set(key, { date: key, legacyTotal: 0, abTotal: 0, legacyRows: [], abRows: [] })
    }
    const section = map.get(key)!
    const row: ProjectionRow = {
      jobNumber: p.jobNumber,
      jobName: p.jobName,
      monthYear: p.monthYear,
      estimateNumber: p.estimateNumber,
      billingPeriod: p.billingPeriod,
      estimatedAmountOwed: p.estimatedAmountOwed,
      statusName: p.status.name,
      notes: p.notes[0]?.content ?? '',
    }
    if (p.division === 'LEGACY') {
      section.legacyRows.push(row)
      section.legacyTotal += p.estimatedAmountOwed
    } else {
      section.abRows.push(row)
      section.abTotal += p.estimatedAmountOwed
    }
  }
  return Array.from(map.values())
}

export function generateEmailBody(data: ReportData): string {
  const lines: string[] = []
  const div = '─'.repeat(60)

  const allNextWeekRows = data.nextWeekSections.flatMap(s => [
    ...s.legacyRows.map(r => ({ ...r, division: 'Legacy', weekDate: s.date })),
    ...s.abRows.map(r => ({ ...r, division: 'AB', weekDate: s.date })),
  ])
  const allFutureRows = data.futureSections.flatMap(s => [
    ...s.legacyRows.map(r => ({ ...r, division: 'Legacy', weekDate: s.date })),
    ...s.abRows.map(r => ({ ...r, division: 'AB', weekDate: s.date })),
  ])
  const nextWeekGrandTotal = data.nextWeekSections.reduce((s, sec) => s + sec.legacyTotal + sec.abTotal, 0)
  const futureGrandTotal   = data.futureSections.reduce((s, sec) => s + sec.legacyTotal + sec.abTotal, 0)

  // ── Opening ──────────────────────────────────────────────
  lines.push('Hello Leadership Team,', '')
  lines.push('Attached are this week\'s cash receipts and projected payment updates.', '')

  // ── Weekly Cash Receipts ─────────────────────────────────
  lines.push(div)
  lines.push('WEEKLY CASH RECEIPTS')
  lines.push(div)
  const variance = data.combinedReceiptsTotal - data.thisWeekProjectedTotal
  const pct = data.thisWeekProjectedTotal > 0 ? (variance / data.thisWeekProjectedTotal) * 100 : null
  const varSign = variance >= 0 ? '+' : ''
  const varStr = data.thisWeekProjectedTotal > 0
    ? `${varSign}${dollars(Math.abs(variance))} / ${varSign}${pct!.toFixed(1)}%`
    : 'N/A (no projections for this week)'

  lines.push(`  Legacy:           ${dollars(data.legacyReceiptsTotal)}`)
  lines.push(`  AB:               ${dollars(data.abReceiptsTotal)}`)
  lines.push(`  Combined:         ${dollars(data.combinedReceiptsTotal)}`)
  lines.push(`  Target:           ${dollars(data.thisWeekProjectedTotal)}`)
  lines.push(`  Var. from Target: ${varStr}`)
  lines.push('')

  // ── Variance Breakdown ───────────────────────────────────
  const hasInsights =
    data.movedOut.length > 0 ||
    data.dueNotReceived.length > 0 ||
    data.partiallyReceived.length > 0 ||
    data.unplannedReceipts.length > 0
  if (hasInsights) {
    lines.push(div)
    lines.push('VARIANCE FROM TARGET — BREAKDOWN')
    lines.push(div)

    if (data.movedOut.length > 0) {
      const movedTotal = data.movedOut.reduce((s, r) => s + r.estimatedAmountOwed, 0)
      lines.push(`  Moved to a Future Date  (-${dollars(movedTotal)}):`)
      for (const r of data.movedOut) {
        const reason = r.reason.trim() ? r.reason : 'no reason given'
        lines.push(`    • ${r.jobNumber} – ${r.jobName}  |  Est #${r.estimateNumber}  |  ${dollars(r.estimatedAmountOwed)}  →  ${r.newDate} (${reason})`)
      }
      lines.push('')
    }

    if (data.dueNotReceived.length > 0) {
      const dueTotal = data.dueNotReceived.reduce((s, r) => s + r.estimatedAmountOwed, 0)
      lines.push(`  Still Expected This Week  (-${dollars(dueTotal)}):`)
      for (const r of data.dueNotReceived) {
        lines.push(`    • ${r.jobNumber} – ${r.jobName}  |  Est #${r.estimateNumber}  |  ${dollars(r.estimatedAmountOwed)}  (${r.statusName})`)
        if (r.notes.trim()) lines.push(`      ${r.notes}`)
      }
      lines.push('')
    }

    if (data.partiallyReceived.length > 0) {
      const partialTotal = data.partiallyReceived.reduce((s, r) => s + r.estimatedAmountOwed, 0)
      lines.push(`  Partial Payments Received  (-${dollars(partialTotal)} remaining):`)
      for (const r of data.partiallyReceived) {
        lines.push(`    • ${r.jobNumber} – ${r.jobName}  |  Est #${r.estimateNumber}  |  ${dollars(r.estimatedAmountOwed)} remaining`)
        if (r.notes.trim()) lines.push(`      ${r.notes}`)
      }
      lines.push('')
    }

    if (data.unplannedReceipts.length > 0) {
      const unplannedTotal = data.unplannedReceipts.reduce((s, r) => s + r.amountReceived, 0)
      lines.push(`  Unplanned Receipts  (+${dollars(unplannedTotal)}):`)
      for (const r of data.unplannedReceipts) {
        lines.push(`    • ${r.jobNumber} – ${r.jobName}  |  received ${r.datePmtReceived}  |  ${dollars(r.amountReceived)}`)
      }
      lines.push('')
    }
  }

  // ── Projected Payments Summary (table by week) ───────────
  lines.push(div)
  lines.push('PROJECTED PAYMENTS SUMMARY')
  lines.push(div)

  const allSections = [
    ...data.nextWeekSections.map(s => ({ ...s, label: 'Next Week' })),
    ...data.futureSections.map(s => ({ ...s, label: 'Future' })),
  ]

  if (allSections.length === 0) {
    lines.push('  No active projections.')
  } else {
    const col = (s: string, w: number) => s.padEnd(w)
    lines.push(
      '  ' + col('Week Ending', 14) + col('Legacy', 20) + col('AB', 20) + 'Combined'
    )
    lines.push('  ' + '─'.repeat(72))
    for (const sec of allSections) {
      const combined = sec.legacyTotal + sec.abTotal
      lines.push(
        '  ' +
        col(sec.date, 14) +
        col(dollars(sec.legacyTotal), 20) +
        col(dollars(sec.abTotal), 20) +
        dollars(combined)
      )
    }
    lines.push('  ' + '─'.repeat(72))
    lines.push(
      '  ' +
      col('Total', 14) +
      col(dollars(data.nextWeekSections.reduce((s, sec) => s + sec.legacyTotal, 0) + data.futureSections.reduce((s, sec) => s + sec.legacyTotal, 0)), 20) +
      col(dollars(data.nextWeekSections.reduce((s, sec) => s + sec.abTotal, 0) + data.futureSections.reduce((s, sec) => s + sec.abTotal, 0)), 20) +
      dollars(nextWeekGrandTotal + futureGrandTotal)
    )
  }
  lines.push('')

  // ── Key Notes ────────────────────────────────────────────
  const notedRows = [...allNextWeekRows, ...allFutureRows].filter(r => r.notes?.trim())
  if (notedRows.length > 0) {
    lines.push(div)
    lines.push('KEY NOTES')
    lines.push(div)

    if (allNextWeekRows.some(r => r.notes?.trim())) {
      lines.push('Next Week:')
      for (const r of allNextWeekRows.filter(r => r.notes?.trim())) {
        lines.push(`  • ${r.jobNumber} – ${r.jobName} (${r.division}, ${dollars(r.estimatedAmountOwed)})`)
        lines.push(`    ${r.notes}`)
      }
      lines.push('')
    }
    if (allFutureRows.some(r => r.notes?.trim())) {
      lines.push('Future:')
      for (const r of allFutureRows.filter(r => r.notes?.trim())) {
        lines.push(`  • ${r.jobNumber} – ${r.jobName} (${r.division}, ${r.weekDate}, ${dollars(r.estimatedAmountOwed)})`)
        lines.push(`    ${r.notes}`)
      }
      lines.push('')
    }
  }

  // ── Last Week Status ─────────────────────────────────────
  if (data.lastWeekStatus.length > 0) {
    lines.push(div)
    lines.push("STATUS OF LAST WEEK'S PROJECTIONS")
    lines.push(div)
    for (const division of ['Legacy', 'AB']) {
      const rows = data.lastWeekStatus.filter(r => r.division === (division === 'Legacy' ? 'LEGACY' : 'AB'))
      if (rows.length === 0) continue
      lines.push(`${division}:`)
      for (const r of rows) {
        lines.push(`  • ${r.jobNumber} – ${r.jobName}  |  Est #${r.estimateNumber}  |  ${dollars(r.estimatedAmountOwed)}  →  ${r.statusName}`)
        if (r.notes) lines.push(`    ${r.notes}`)
      }
      lines.push('')
    }
  }

  // ── Received But Not Projected ───────────────────────────
  if (data.unplannedReceipts.length > 0) {
    lines.push(div)
    lines.push('RECEIVED BUT NOT PROJECTED')
    lines.push(div)
    const col = (s: string, w: number) => s.padEnd(w)
    lines.push('  ' + col('Job #', 10) + col('Job Name', 32) + col('Date Received', 16) + 'Amount')
    lines.push('  ' + '─'.repeat(68))
    for (const r of data.unplannedReceipts) {
      lines.push(
        '  ' +
        col(r.jobNumber, 10) +
        col(r.jobName.slice(0, 30), 32) +
        col(r.datePmtReceived, 16) +
        dollars(r.amountReceived)
      )
    }
    lines.push('')
  }

  // ── Closing ───────────────────────────────────────────────
  lines.push('Please let me know if you have any questions.', '')
  lines.push('Thank you.')

  return lines.join('\n')
}

