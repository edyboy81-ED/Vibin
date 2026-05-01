'use client'

import { useState, useCallback } from 'react'
import { dollars, fmtDate, nextFriday, toDateInput } from '@/lib/format'
import type { ReportData, ReportSection, LastWeekStatusRow, UnplannedReceiptRow } from '@/lib/reportBuilder'

interface ReportResponse extends Omit<ReportData, 'reportDate'> {
  reportDate: string
}

export default function ReportPage() {
  const [date, setDate] = useState(() => toDateInput(nextFriday(new Date()).toISOString()))
  const [data, setData] = useState<ReportResponse | null>(null)
  const [emailBody, setEmailBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const isFriday = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 5
  }

  const loadReport = useCallback(async () => {
    setLoading(true)
    setEmailBody('')
    const res = await fetch(`/api/report?date=${date}`)
    setData(await res.json())
    setLoading(false)
  }, [date])

  const generateEmail = async () => {
    setGenerating(true)
    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    })
    const d = await res.json()
    setEmailBody(d.emailBody)
    setGenerating(false)
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(emailBody)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const nextWeekTotal = data
    ? data.nextWeekSections.reduce((s, sec) => s + sec.legacyTotal + sec.abTotal, 0)
    : 0
  const futureTotal = data
    ? data.futureSections.reduce((s, sec) => s + sec.legacyTotal + sec.abTotal, 0)
    : 0

  return (
    <div className="max-w-5xl">
      {/* Page header — hidden when printing */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Friday Report</h1>
          <p className="text-sm text-gray-400 mt-1">Generate the weekly leadership email</p>
        </div>
      </div>

      {/* Date selector — hidden when printing */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5 flex items-end gap-4 print:hidden">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Report Date (Friday)</label>
          <input
            type="date"
            value={date}
            onChange={e => {
              const val = e.target.value
              if (val && !isFriday(val)) return
              setDate(val)
              setData(null)
              setEmailBody('')
            }}
            className="input"
          />
          {date && !isFriday(date) && (
            <p className="text-xs text-red-500 mt-1">Please select a Friday.</p>
          )}
        </div>
        <button
          onClick={loadReport}
          disabled={loading || !date || !isFriday(date)}
          className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Preview Report'}
        </button>
      </div>

      {data && (
        <>
          {/* Print header — only visible when printing */}
          <div className="hidden print:block mb-6">
            <h1 className="text-xl font-bold text-gray-900">Friday Report — {fmtDate(data.reportDate)}</h1>
          </div>

          {/* Action bar — hidden when printing */}
          <div className="flex justify-end gap-2 mb-4 print:hidden">
            <button
              onClick={() => window.print()}
              className="text-sm border border-gray-300 bg-white px-4 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              Print Report
            </button>
            <button
              onClick={generateEmail}
              disabled={generating}
              className="text-sm bg-slate-900 text-white px-4 py-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              {generating ? 'Generating…' : 'Generate Email'}
            </button>
          </div>

          {/* Summary totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <SummaryCard label="Legacy Receipts" value={dollars(data.legacyReceiptsTotal)} color="text-slate-700" />
            <SummaryCard label="AB Receipts" value={dollars(data.abReceiptsTotal)} color="text-blue-700" />
            <SummaryCard label="Combined Receipts" value={dollars(data.combinedReceiptsTotal)} color="text-green-700" bold />
            <SummaryCard label="Next Week Projected" value={dollars(nextWeekTotal)} color="text-orange-700" />
          </div>

          {/* Next week projections */}
          {data.nextWeekSections.length > 0 && (
            <Section title="Next Week's Projected Payments">
              {data.nextWeekSections.map(sec => (
                <PaymentDateGroup key={sec.date} section={sec} />
              ))}
            </Section>
          )}

          {/* Future projections */}
          {data.futureSections.length > 0 && (
            <Section title={`Future Projected Payments (${dollars(futureTotal)} total)`}>
              {data.futureSections.map(sec => (
                <PaymentDateGroup key={sec.date} section={sec} />
              ))}
            </Section>
          )}

          {/* Last week status */}
          {data.lastWeekStatus.length > 0 && (
            <Section title="Status of Last Week's Projections">
              <LastWeekTable rows={data.lastWeekStatus} />
            </Section>
          )}

          {/* Unplanned receipts */}
          {data.unplannedReceipts.length > 0 && (
            <Section title="Received But Not Projected">
              <UnplannedTable rows={data.unplannedReceipts} />
            </Section>
          )}

          {/* Email body — hidden when printing */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mt-5 print:hidden">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Email Body</h2>
              {emailBody && (
                <button
                  onClick={copyToClipboard}
                  className={`text-sm px-4 py-1.5 rounded-lg border transition-colors ${copied ? 'bg-green-50 border-green-300 text-green-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
            {emailBody ? (
              <pre className="text-xs font-mono bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-gray-700 border border-gray-100 max-h-96 overflow-y-auto">
                {emailBody}
              </pre>
            ) : (
              <p className="text-sm text-gray-400">Click "Generate Email" to create the formatted email body ready to paste into Outlook.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">{label}</p>
      <p className={`text-lg font-mono ${bold ? 'font-bold' : 'font-medium'} ${color}`}>{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 break-inside-avoid">
      <h2 className="font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  )
}

function PaymentDateGroup({ section }: { section: ReportSection }) {
  const combined = section.legacyTotal + section.abTotal
  return (
    <div className="mb-5 last:mb-0">
      <div className="flex items-center gap-3 mb-2">
        <span className="font-medium text-gray-700">Week of {section.date}</span>
        <span className="text-sm text-gray-400 font-mono">{dollars(combined)}</span>
      </div>
      {section.legacyRows.length > 0 && (
        <div className="mb-3">
          <div className="px-3 py-1.5 bg-slate-50 rounded-t-lg border border-gray-200 flex justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Legacy</span>
            <span className="text-xs font-mono text-slate-600">{dollars(section.legacyTotal)}</span>
          </div>
          <ProjectionMiniTable rows={section.legacyRows} />
        </div>
      )}
      {section.abRows.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-blue-50 rounded-t-lg border border-gray-200 flex justify-between">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">AB</span>
            <span className="text-xs font-mono text-blue-600">{dollars(section.abTotal)}</span>
          </div>
          <ProjectionMiniTable rows={section.abRows} />
        </div>
      )}
    </div>
  )
}

function ProjectionMiniTable({ rows }: { rows: ReportSection['legacyRows'] }) {
  return (
    <table className="w-full text-xs border border-t-0 border-gray-200 rounded-b-lg overflow-hidden">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="px-3 py-1.5 text-left font-medium text-gray-500 whitespace-nowrap">Job #</th>
          <th className="px-3 py-1.5 text-left font-medium text-gray-500">Job Name</th>
          <th className="px-3 py-1.5 text-left font-medium text-gray-500 whitespace-nowrap">Est #</th>
          <th className="px-3 py-1.5 text-left font-medium text-gray-500 whitespace-nowrap">Billing Period</th>
          <th className="px-3 py-1.5 text-left font-medium text-gray-500 whitespace-nowrap">Amount</th>
          <th className="px-3 py-1.5 text-left font-medium text-gray-500 whitespace-nowrap">Status</th>
          <th className="px-3 py-1.5 text-left font-medium text-gray-500">Notes</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map((r, i) => (
          <tr key={i} className="hover:bg-gray-50">
            <td className="px-3 py-2 font-mono whitespace-nowrap">{r.jobNumber}</td>
            <td className="px-3 py-2 text-gray-700">{r.jobName}</td>
            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.estimateNumber}</td>
            <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{r.billingPeriod}</td>
            <td className="px-3 py-2 font-mono whitespace-nowrap">{dollars(r.estimatedAmountOwed)}</td>
            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.statusName}</td>
            <td className="px-3 py-2 text-gray-400">{r.notes || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function LastWeekTable({ rows }: { rows: LastWeekStatusRow[] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Job #</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide">Job Name</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Est #</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Amount</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Division</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="py-2 px-3 font-mono whitespace-nowrap">{r.jobNumber}</td>
            <td className="py-2 px-3 text-gray-700">{r.jobName}</td>
            <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{r.estimateNumber}</td>
            <td className="py-2 px-3 font-mono whitespace-nowrap">{dollars(r.estimatedAmountOwed)}</td>
            <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{r.division}</td>
            <td className="py-2 px-3">
              <span className="px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: r.statusColor + '22', color: r.statusColor }}>
                {r.statusName}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function UnplannedTable({ rows }: { rows: UnplannedReceiptRow[] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Job #</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide">Job Name</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Division</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Date</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Amount</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="py-2 px-3 font-mono whitespace-nowrap">{r.jobNumber}</td>
            <td className="py-2 px-3 text-gray-700">{r.jobName}</td>
            <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{r.division}</td>
            <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{r.datePmtReceived}</td>
            <td className="py-2 px-3 font-mono whitespace-nowrap">{dollars(r.amountReceived)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
