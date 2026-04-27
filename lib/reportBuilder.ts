import { prisma } from './db'
import { startOfDay, endOfDay, addDays, dollars, fmtDate, fmtDateLong } from './format'

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

export interface ReportData {
  reportDate: Date
  // Cash receipts this week
  legacyReceiptsTotal: number
  abReceiptsTotal: number
  combinedReceiptsTotal: number
  // Projections
  nextWeekSections: ReportSection[]
  futureSections: ReportSection[]
  // Last week projection status
  lastWeekStatus: LastWeekStatusRow[]
  // Unplanned receipts
  unplannedReceipts: UnplannedReceiptRow[]
}

export async function buildReport(reportDate: Date): Promise<ReportData> {
  const friday = startOfDay(reportDate)

  // This week: last 7 days through reportDate
  const weekStart = startOfDay(addDays(friday, -6))
  const weekEnd = endOfDay(friday)

  // Next week window
  const nextWeekStart = startOfDay(addDays(friday, 1))
  const nextWeekEnd = endOfDay(addDays(friday, 7))

  // Beyond next week
  const futureStart = startOfDay(addDays(friday, 8))

  // Last week window (for status report)
  const lastWeekStart = startOfDay(addDays(friday, -13))
  const lastWeekEnd = endOfDay(addDays(friday, -7))

  // --- Cash receipts this week ---
  const weekPayments = await prisma.payment.findMany({
    where: { datePmtReceived: { gte: weekStart, lte: weekEnd } },
    include: { job: { select: { division: true, jobNumber: true, jobName: true } } },
  })

  const legacyReceiptsTotal = weekPayments
    .filter(p => p.job.division === 'LEGACY')
    .reduce((s, p) => s + p.amountReceived, 0)
  const abReceiptsTotal = weekPayments
    .filter(p => p.job.division === 'AB')
    .reduce((s, p) => s + p.amountReceived, 0)

  // --- Projections: next week ---
  const nextWeekProjections = await prisma.projectedPayment.findMany({
    where: { estimatedPaymentDate: { gte: nextWeekStart, lte: nextWeekEnd }, isActive: true },
    include: {
      status: true,
      notes: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: [{ estimatedPaymentDate: 'asc' }, { division: 'asc' }, { jobNumber: 'asc' }],
  })

  // --- Projections: future ---
  const futureProjections = await prisma.projectedPayment.findMany({
    where: { estimatedPaymentDate: { gte: futureStart }, isActive: true },
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

  lines.push('Hello Leadership Team,', '')
  lines.push(
    `Attached are this week's cash receipts… ` +
    `Legacy ${dollars(data.legacyReceiptsTotal)} and AB ${dollars(data.abReceiptsTotal)} ` +
    `for a combined total of ${dollars(data.combinedReceiptsTotal)}.`,
    ''
  )

  const renderSection = (label: string, rows: ProjectionRow[], total: number) => {
    if (rows.length === 0) {
      lines.push(`${label} - Zero`, '')
      return
    }
    lines.push(`${label} – ${dollars(total)}`, '')
    lines.push(
      ['Job #', 'Job Name', 'Month/Year', 'Est #', 'Final Billing Period', 'Est. Amount Owed', 'Est. Payment Date', 'Notes']
        .join('\t')
    )
    for (const r of rows) {
      lines.push(
        [r.jobNumber, r.jobName, r.monthYear, r.estimateNumber, r.billingPeriod,
          dollars(r.estimatedAmountOwed), '', r.notes].join('\t')
      )
    }
    lines.push('')
  }

  // Next week
  for (const section of data.nextWeekSections) {
    renderSection(`Legacy Projected Payments for ${section.date}`, section.legacyRows, section.legacyTotal)
    renderSection(`AB Projected Payments for ${section.date}`, section.abRows, section.abTotal)
    lines.push(`Combined Projected Payments for ${section.date} are ${dollars(section.legacyTotal + section.abTotal)}`, '')
  }

  // Future
  for (const section of data.futureSections) {
    renderSection(`Legacy Projected Payments for ${section.date}`, section.legacyRows, section.legacyTotal)
    renderSection(`AB Projected Payments for ${section.date}`, section.abRows, section.abTotal)
    lines.push(`Combined Projected Payments for ${section.date} are ${dollars(section.legacyTotal + section.abTotal)}`, '')
  }

  // Last week status
  if (data.lastWeekStatus.length > 0) {
    lines.push('─── Status of Last Week\'s Projections ───', '')
    const legacy = data.lastWeekStatus.filter(r => r.division === 'LEGACY')
    const ab = data.lastWeekStatus.filter(r => r.division === 'AB')

    if (legacy.length > 0) {
      lines.push('Legacy:', '')
      for (const r of legacy) {
        lines.push(`  ${r.jobNumber}  ${r.jobName}  Est #${r.estimateNumber}  ${dollars(r.estimatedAmountOwed)}  → ${r.statusName}`)
      }
      lines.push('')
    }
    if (ab.length > 0) {
      lines.push('AB:', '')
      for (const r of ab) {
        lines.push(`  ${r.jobNumber}  ${r.jobName}  Est #${r.estimateNumber}  ${dollars(r.estimatedAmountOwed)}  → ${r.statusName}`)
      }
      lines.push('')
    }
  }

  // Unplanned
  if (data.unplannedReceipts.length > 0) {
    lines.push('─── Received But Not Projected ───', '')
    for (const r of data.unplannedReceipts) {
      lines.push(`  ${r.jobNumber}  ${r.jobName}  ${r.datePmtReceived}  ${dollars(r.amountReceived)}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
