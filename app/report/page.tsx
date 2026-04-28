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
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Friday Report</h1>
          <p className="text-sm text-gray-400 mt-1">Generate the weekly leadership email</p>
        </div>
      </div>

      {/* Date selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5 flex items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Report Date (Friday)</label>
          <input
            type="date"
            value={date}
            onChange={e => { setDate(e.target.value); setData(null); setEmailBody('') }}
            className="input"
          />
        </div>
        <button
          onClick={loadReport}
          disabled={loading || !date}
          className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Preview Report'}
        </button>
      </div>

      {data && (
        <>
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

          {/* Generate email */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mt-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Email Body</h2>
              <div className="flex gap-2">
                <button
                  onClick={generateEmail}
                  disabled={generating}
                  className="text-sm bg-slate-900 text-white px-4 py-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-50"
                >
                  {generating ? 'Generating…' : 'Generate Email'}
                </button>
                {emailBody && (
                  <button
                    onClick={copyToClipboard}
                    className={`text-sm px-4 py-1.5 rounded-lg border transition-colors ${copied ? 'bg-green-50 border-green-300 text-green-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
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
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
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
    <table className="w-full table-fixed text-xs border border-t-0 border-gray-200 rounded-b-lg overflow-hidden">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-[9%]">Job #</th>
          <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-[18%]">Job Name</th>
          <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-[8%]">Est #</th>
          <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-[14%]">Billing Period</th>
          <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-[12%]">Amount</th>
          <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-[10%]">Status</th>
          <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-[29%]">Notes</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map((r, i) => (
          <tr key={i} className="hover:bg-gray-50">
            <td className="px-3 py-2 font-mono">{r.jobNumber}</td>
            <td className="px-3 py-2 text-gray-700 truncate">{r.jobName}</td>
            <td className="px-3 py-2 text-gray-500">{r.estimateNumber}</td>
            <td className="px-3 py-2 text-gray-400 truncate">{r.billingPeriod}</td>
            <td className="px-3 py-2 font-mono">{dollars(r.estimatedAmountOwed)}</td>
            <td className="px-3 py-2 text-gray-500">{r.statusName}</td>
            <td className="px-3 py-2 text-gray-400 truncate">{r.notes || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function LastWeekTable({ rows }: { rows: LastWeekStatusRow[] }) {
  return (
    <table className="w-full table-fixed text-xs">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide w-[12%]">Job #</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide w-[28%]">Job Name</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide w-[10%]">Est #</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide w-[15%]">Amount</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide w-[10%]">Division</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide w-[25%]">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="py-2 px-3 font-mono">{r.jobNumber}</td>
            <td className="py-2 px-3 text-gray-700 truncate">{r.jobName}</td>
            <td className="py-2 px-3 text-gray-500">{r.estimateNumber}</td>
            <td className="py-2 px-3 font-mono">{dollars(r.estimatedAmountOwed)}</td>
            <td className="py-2 px-3 text-gray-500">{r.division}</td>
            <td className="py-2 px-3">
              <span className="px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: r.statusColor + '22', color: r.statusColor }}>
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
    <table className="w-full table-fixed text-xs">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide w-[12%]">Job #</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide w-[35%]">Job Name</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide w-[10%]">Division</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide w-[13%]">Date</th>
          <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide w-[15%]">Amount</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="py-2 px-3 font-mono">{r.jobNumber}</td>
            <td className="py-2 px-3 text-gray-700 truncate">{r.jobName}</td>
            <td className="py-2 px-3 text-gray-500">{r.division}</td>
            <td className="py-2 px-3 text-gray-500">{r.datePmtReceived}</td>
            <td className="py-2 px-3 font-mono">{dollars(r.amountReceived)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
