import type { ReconciliationResult } from './reconcile'

const COMPANY_LABELS: Record<string, string> = {
  PRESTIGE: 'Prestige Productions',
  HARMONY: 'Harmony Events',
  RHYTHM: 'Rhythm Records',
  MELODY: 'Melody Media',
  ENCORE: 'Encore Entertainment',
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function co(company: string): string {
  return COMPANY_LABELS[company] ?? company
}

function diffCell(diff: number): string {
  if (diff === 0) return '<td style="padding:8px 12px;text-align:right;color:#9ca3af">—</td>'
  const color = diff < 0 ? '#dc2626' : '#059669'
  const sign = diff < 0 ? '-' : '+'
  return `<td style="padding:8px 12px;text-align:right;color:${color};font-family:monospace">${sign}${dollars(Math.abs(diff))}</td>`
}

export function generateEmailHtml(
  result: ReconciliationResult,
  reportDate: Date = new Date(),
): string {
  const totalExpected =
    result.matched.reduce((s, m) => s + m.job.amount, 0) +
    result.unmatchedJobs.reduce((s, j) => s + j.amount, 0)
  const totalReceived =
    result.matched.reduce((s, m) => s + m.receipt.amount, 0) +
    result.unmatchedReceipts.reduce((s, r) => s + r.amount, 0)
  const netDiff = totalReceived - totalExpected
  const netColor = netDiff < 0 ? '#dc2626' : '#059669'

  const th = (label: string, align = 'left') =>
    `<th style="background:#f3f4f6;text-align:${align};padding:8px 12px;font-size:13px;font-weight:600">${label}</th>`
  const td = (val: string, align = 'left', mono = false) =>
    `<td style="padding:8px 12px;text-align:${align}${mono ? ';font-family:monospace' : ''}">${val}</td>`

  const matchedRows = result.matched
    .map(
      (m) => `<tr>
        ${td(m.job.jobNumber, 'left', true)}
        ${td(co(m.job.company))}
        ${td(m.job.name ?? m.job.jobNumber)}
        ${td(dollars(m.job.amount), 'right', true)}
        ${td(dollars(m.receipt.amount), 'right', true)}
        ${diffCell(m.amountDiff)}
      </tr>`,
    )
    .join('')

  const pendingRows = result.unmatchedJobs
    .map(
      (j) => `<tr>
        ${td(j.jobNumber, 'left', true)}
        ${td(co(j.company))}
        ${td(j.name ?? j.jobNumber)}
        ${td(fmtDate(j.date))}
        ${td(dollars(j.amount), 'right', true)}
      </tr>`,
    )
    .join('')

  const unmatchedRows = result.unmatchedReceipts
    .map(
      (r) => `<tr>
        ${td(r.jobNumber, 'left', true)}
        ${td(co(r.company))}
        ${td(fmtDate(r.date))}
        ${td(dollars(r.amount), 'right', true)}
        ${td(r.description ?? '—')}
      </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:720px;margin:0 auto;padding:24px">
  <h1 style="color:#4f46e5;margin-bottom:4px">Vibin — Reconciliation Report</h1>
  <p style="color:#6b7280;margin-top:0">Generated ${fmtDate(reportDate)}</p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:32px">
    <tr>
      <td style="padding:16px;background:#f9fafb;border-radius:8px;width:33%">
        <div style="font-size:12px;color:#6b7280">Total Expected</div>
        <div style="font-size:22px;font-weight:700;font-family:monospace">${dollars(totalExpected)}</div>
      </td>
      <td style="width:16px"></td>
      <td style="padding:16px;background:#f9fafb;border-radius:8px;width:33%">
        <div style="font-size:12px;color:#6b7280">Total Received</div>
        <div style="font-size:22px;font-weight:700;font-family:monospace">${dollars(totalReceived)}</div>
      </td>
      <td style="width:16px"></td>
      <td style="padding:16px;background:#f9fafb;border-radius:8px;width:33%">
        <div style="font-size:12px;color:#6b7280">Net Difference</div>
        <div style="font-size:22px;font-weight:700;font-family:monospace;color:${netColor}">${netDiff >= 0 ? '+' : ''}${dollars(netDiff)}</div>
      </td>
    </tr>
  </table>

  <h2 style="color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:6px">
    Matched Jobs (${result.matched.length})
  </h2>
  ${
    result.matched.length === 0
      ? '<p style="color:#9ca3af">No matched jobs.</p>'
      : `<table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead><tr>${th('Job #')}${th('Company')}${th('Name')}${th('Expected', 'right')}${th('Received', 'right')}${th('Diff', 'right')}</tr></thead>
      <tbody style="font-size:14px">${matchedRows}</tbody>
    </table>`
  }

  <h2 style="color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:6px">
    Pending Payment — No Receipt (${result.unmatchedJobs.length})
  </h2>
  ${
    result.unmatchedJobs.length === 0
      ? '<p style="color:#9ca3af">All jobs have matching receipts.</p>'
      : `<table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead><tr>${th('Job #')}${th('Company')}${th('Name')}${th('Date')}${th('Expected', 'right')}</tr></thead>
      <tbody style="font-size:14px">${pendingRows}</tbody>
    </table>`
  }

  <h2 style="color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:6px">
    Unmatched Receipts — No Job (${result.unmatchedReceipts.length})
  </h2>
  ${
    result.unmatchedReceipts.length === 0
      ? '<p style="color:#9ca3af">All receipts match jobs.</p>'
      : `<table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead><tr>${th('Job #')}${th('Company')}${th('Date')}${th('Amount', 'right')}${th('Description')}</tr></thead>
      <tbody style="font-size:14px">${unmatchedRows}</tbody>
    </table>`
  }

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
  <p style="color:#9ca3af;font-size:12px">Sent from Vibin • Job tracking &amp; reconciliation</p>
</body>
</html>`
}

export function generateEmailText(result: ReconciliationResult): string {
  const lines: string[] = ['Vibin — Reconciliation Report', '']

  lines.push(`MATCHED (${result.matched.length})`)
  for (const m of result.matched) {
    lines.push(
      `  [${m.job.jobNumber} / ${m.job.company}] ${m.job.name ?? m.job.jobNumber}` +
        `  expected: $${(m.job.amount / 100).toFixed(2)}` +
        `  received: $${(m.receipt.amount / 100).toFixed(2)}`,
    )
  }

  lines.push('', `PENDING PAYMENT (${result.unmatchedJobs.length})`)
  for (const j of result.unmatchedJobs) {
    lines.push(
      `  [${j.jobNumber} / ${j.company}] ${j.name ?? j.jobNumber}  $${(j.amount / 100).toFixed(2)}`,
    )
  }

  lines.push('', `UNMATCHED RECEIPTS (${result.unmatchedReceipts.length})`)
  for (const r of result.unmatchedReceipts) {
    lines.push(
      `  [${r.jobNumber} / ${r.company}]  $${(r.amount / 100).toFixed(2)}  ${r.description ?? ''}`,
    )
  }

  return lines.join('\n')
}
