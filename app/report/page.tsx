'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { dollars, fmtDate, nextFriday, toDateInput } from '@/lib/format'
import { formatSurety } from '@/lib/surety'
import type { ReportData, ReportSection, LastWeekStatusRow, UnplannedReceiptRow, MovedOutRow, DueNotReceivedRow, PartiallyReceivedRow, SuretyBreakdownRow } from '@/lib/reportBuilder'

interface ReportResponse extends Omit<ReportData, 'reportDate'> { reportDate: string }

const NAV_SECTIONS = [
  { id: 'perf', label: 'Performance' },
  { id: 'var',  label: 'Variance' },
  { id: 'sur',  label: 'Surety' },
  { id: 'nxt',  label: 'Next Week' },
  { id: 'fut',  label: 'Future' },
  { id: 'lst',  label: 'Last Week' },
]

export default function ReportPage() {
  const [date, setDate] = useState(() => toDateInput(nextFriday(new Date()).toISOString()))
  const [data, setData] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState('perf')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [emailHtml, setEmailHtml] = useState('')
  const [emailTab, setEmailTab] = useState<'preview' | 'source'>('preview')
  const [emailMode, setEmailMode] = useState<'standard' | 'ai'>('standard')

  const [copied, setCopied] = useState<'html' | 'text' | null>(null)
  const [sendState, setSendState] = useState<'idle' | 'copied'>(('idle'))
  const mainRef = useRef<HTMLDivElement>(null)

  const isFriday = (s: string) => { const [y,m,d] = s.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)).getUTCDay() === 5 }

  const loadReport = useCallback(async () => {
    setLoading(true)
    setData(null)
    setDrawerOpen(false)
    setEmailHtml('')
    const res = await fetch(`/api/report?date=${date}`)
    setData(await res.json())
    setLoading(false)
  }, [date])

  // Scrollspy
  useEffect(() => {
    const handler = () => {
      const y = window.scrollY + 120
      let active = NAV_SECTIONS[0].id
      for (const s of NAV_SECTIONS) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top + window.pageYOffset <= y) active = s.id
      }
      setActiveSection(active)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const jumpTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const top = el.getBoundingClientRect().top + window.pageYOffset - 80
    window.scrollTo({ top, behavior: 'smooth' })
  }

  const toggleCollapse = (id: string) => setCollapsed(p => ({ ...p, [id]: !p[id] }))

  // Generate an enhanced narrative intro/closing using the actual data
  const buildEnhancedNarrative = useCallback((d: ReportResponse): { intro: string; closing: string } => {
    const variance = d.combinedReceiptsTotal - d.thisWeekProjectedTotal
    const pct = d.thisWeekProjectedTotal > 0 ? Math.abs(variance / d.thisWeekProjectedTotal * 100) : null
    const positive = variance >= 0
    const nextTotal = d.nextWeekSections.reduce((s, sec) => s + sec.legacyTotal + sec.abTotal, 0)

    let intro = `<p>Hi Team,</p>`

    if (d.thisWeekProjectedTotal > 0) {
      const performance = positive
        ? `We had a <strong>strong finish</strong> — combined collections of <strong style="color:#0B7245">${dollars(d.combinedReceiptsTotal)}</strong> came in ${pct!.toFixed(1)}% above our ${dollars(d.thisWeekProjectedTotal)} target.`
        : `Combined collections landed at <strong>${dollars(d.combinedReceiptsTotal)}</strong> this week, ${pct!.toFixed(1)}% short of our ${dollars(d.thisWeekProjectedTotal)} target.`
      intro += `<p>${performance}</p>`
    } else {
      intro += `<p>Here's your AR summary for the week ending ${fmtDate(d.reportDate)}. Combined collections came in at <strong style="color:#0B7245">${dollars(d.combinedReceiptsTotal)}</strong>.</p>`
    }

    const callouts: string[] = []
    if (d.movedOut.length > 0) {
      const movedTotal = d.movedOut.reduce((s, r) => s + r.estimatedAmountOwed, 0)
      callouts.push(`${d.movedOut.length} projection${d.movedOut.length > 1 ? 's' : ''} totaling <strong>${dollars(movedTotal)}</strong> moved to a future date`)
    }
    if (d.dueNotReceived.length > 0) {
      const dueTotal = d.dueNotReceived.reduce((s, r) => s + r.estimatedAmountOwed, 0)
      callouts.push(`<strong>${dollars(dueTotal)}</strong> across ${d.dueNotReceived.length} job${d.dueNotReceived.length > 1 ? 's' : ''} is still expected this week`)
    }
    if (d.unplannedReceipts.length > 0) {
      const unplannedTotal = d.unplannedReceipts.reduce((s, r) => s + r.amountReceived, 0)
      callouts.push(`<strong>${dollars(unplannedTotal)}</strong> came in from ${d.unplannedReceipts.length} unplanned receipt${d.unplannedReceipts.length > 1 ? 's' : ''}`)
    }
    if (callouts.length > 0) {
      intro += `<p>A few items worth noting: ${callouts.join('; ')}.</p>`
    }

    const closing = nextTotal > 0
      ? `<p>Looking ahead, we have <strong>${dollars(nextTotal)}</strong> projected for next week. Details are in the tables below.</p><p>Have a great weekend!</p><p>— AR Team</p>`
      : `<p>Details are in the tables below. Have a great weekend!</p><p>— AR Team</p>`

    return { intro, closing }
  }, [])

  // Build static HTML email from report data
  const buildStaticEmail = useCallback((d: ReportResponse, opts?: { intro?: string; closing?: string }) => {
    const variance = d.combinedReceiptsTotal - d.thisWeekProjectedTotal
    const pct = d.thisWeekProjectedTotal > 0 ? (variance / d.thisWeekProjectedTotal * 100).toFixed(1) : '0'
    const positive = variance >= 0
    const th = (t: string, right?: boolean) =>
      `<th style="background-color:#1A1B2D;color:#fff;padding:8px 12px;text-align:${right?'right':'left'};font-size:11px;letter-spacing:.06em;text-transform:uppercase">${t}</th>`
    const tbl = (head: string, body: string) =>
      `<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px;margin:10px 0 18px"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
    const td = (t: string, right?: boolean, mono?: boolean) =>
      `<td style="padding:8px 12px;border-bottom:1px solid #E3E1D9${right?';text-align:right':''}${mono?";font-family:'Courier New',monospace":''}">${t}</td>`
    const pos = (v: string) => `<span style="color:#0B7245;font-weight:600">${v}</span>`
    const neg = (v: string) => `<span style="color:#B91C1C;font-weight:600">${v}</span>`
    const row = (cells: string, even?: boolean) =>
      `<tr style="background-color:${even?'#F9F8F5':'#fff'}">${cells}</tr>`

    const collectionsTable = tbl(
      th('Division') + th('Received', true) + th('Target', true) + th('Variance', true),
      row(td('Legacy') + td(dollars(d.legacyReceiptsTotal), true, true) + td('—', true) + td('—', true)) +
      row(td('AB') + td(dollars(d.abReceiptsTotal), true, true) + td('—', true) + td('—', true), true) +
      row(`<td style="padding:8px 12px;border-bottom:1px solid #E3E1D9;font-weight:600">Combined</td>` +
        td(pos(dollars(d.combinedReceiptsTotal)), true, true) +
        td(dollars(d.thisWeekProjectedTotal), true, true) +
        td(positive ? pos(`+${dollars(variance)}`) : neg(`(${dollars(Math.abs(variance))}) ${pct}%`), true, true))
    )

    const suretyTable = d.suretyBreakdown.length > 0 ? tbl(
      th('Surety') + th('Received This Week', true) + th('Next Week', true) + th('Future Pipeline', true),
      d.suretyBreakdown.map((r, i) =>
        row(td(r.label) + td(r.receiptsTotal > 0 ? dollars(r.receiptsTotal) : '—', true, true) +
          td(r.nextWeekTotal > 0 ? dollars(r.nextWeekTotal) : '—', true, true) +
          td(r.futureTotal > 0 ? dollars(r.futureTotal) : '—', true, true), i % 2 === 1)
      ).join('')
    ) : ''

    const nextTotal = d.nextWeekSections.reduce((s, sec) => s + sec.legacyTotal + sec.abTotal, 0)
    const nextTable = d.nextWeekSections.length > 0 ? tbl(
      th('Week') + th('Division') + th('Amount', true),
      d.nextWeekSections.flatMap((sec, si) => [
        ...(sec.legacyRows.length > 0 ? [row(td(`Week of ${sec.date}`) + td('Legacy') + td(dollars(sec.legacyTotal), true, true), si % 2 === 0)] : []),
        ...(sec.abRows.length > 0 ? [row(td(sec.legacyRows.length > 0 ? '' : `Week of ${sec.date}`) + td('AB') + td(dollars(sec.abTotal), true, true), si % 2 === 1)] : []),
      ]).join('') +
      `<tr style="background:#f0f0f0"><td style="padding:8px 12px;font-weight:600">Total</td><td></td><td style="padding:8px 12px;text-align:right;font-family:'Courier New',monospace;font-weight:600">${pos(dollars(nextTotal))}</td></tr>`
    ) : ''

    const defaultIntro = `<p>Hi Team,</p>
<p>Here's your AR summary for the week ending ${fmtDate(d.reportDate)}. We collected <strong>${pos(dollars(d.combinedReceiptsTotal))}</strong> combined${d.thisWeekProjectedTotal > 0 ? ` — ${positive ? `${pct}% above` : `${Math.abs(Number(pct))}% below`} our ${dollars(d.thisWeekProjectedTotal)} target` : ''}.</p>`
    const defaultClosing = `<p>Have a great weekend!</p>\n<p>— AR Team</p>`

    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1A1B2D;max-width:680px">
${opts?.intro ?? defaultIntro}
<p style="font-weight:600;margin:18px 0 4px">Collections Summary</p>
${collectionsTable}
${d.suretyBreakdown.length > 0 ? `<p style="font-weight:600;margin:18px 0 4px">Surety Breakdown</p>${suretyTable}` : ''}
${d.nextWeekSections.length > 0 ? `<p style="font-weight:600;margin:18px 0 4px">Next Week Projections — ${dollars(nextTotal)} total</p>${nextTable}` : ''}
${opts?.closing ?? defaultClosing}
</div>`
  }, [])

  const openDrawer = useCallback(() => {
    if (data && !emailHtml) setEmailHtml(buildStaticEmail(data))
    setEmailMode('standard')
    setEmailTab('preview')
    setDrawerOpen(true)
  }, [data, emailHtml, buildStaticEmail])

  const generateAiEmail = useCallback(() => {
    if (!data) return
    const { intro, closing } = buildEnhancedNarrative(data)
    setEmailHtml(buildStaticEmail(data, { intro, closing }))
    setEmailMode('ai')
    setEmailTab('preview')
  }, [data, buildEnhancedNarrative, buildStaticEmail])

  const resetToStandard = () => {
    if (data) setEmailHtml(buildStaticEmail(data))
    setEmailMode('standard')
    setEmailTab('preview')
  }

  const copyHtml = async () => {
    await navigator.clipboard.writeText(emailHtml)
    setCopied('html'); setTimeout(() => setCopied(null), 2200)
  }

  const copyText = async () => {
    const div = document.createElement('div')
    div.innerHTML = emailHtml
    await navigator.clipboard.writeText(div.innerText)
    setCopied('text'); setTimeout(() => setCopied(null), 2200)
  }

  const printEmail = () => {
    const win = window.open('', '_blank')!
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Friday AR Report</title><style>body{font-family:Arial,sans-serif;padding:32px;max-width:720px;margin:0 auto}@media print{body{padding:0}}</style></head><body>${emailHtml}</body></html>`)
    win.document.close(); win.focus(); setTimeout(() => win.print(), 400)
  }

  const sendEmail = async () => {
    const div = document.createElement('div'); div.innerHTML = emailHtml
    const subject = `Weekly AR Report — ${fmtDate(date)}`
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([emailHtml], { type: 'text/html' }),
          'text/plain': new Blob([div.innerText], { type: 'text/plain' }),
        }),
      ])
      setSendState('copied')
      setTimeout(() => setSendState('idle'), 4000)
    } catch {
      // ClipboardItem not supported — fall back to plain text
      await navigator.clipboard.writeText(div.innerText)
      setSendState('copied')
      setTimeout(() => setSendState('idle'), 4000)
    }
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}`, '_blank')
  }

  const nextWeekTotal = data?.nextWeekSections.reduce((s, sec) => s + sec.legacyTotal + sec.abTotal, 0) ?? 0
  const futureTotal   = data?.futureSections.reduce((s, sec) => s + sec.legacyTotal + sec.abTotal, 0) ?? 0
  const variance = data ? data.combinedReceiptsTotal - data.thisWeekProjectedTotal : 0
  const pct = data && data.thisWeekProjectedTotal > 0 ? (variance / data.thisWeekProjectedTotal * 100) : null
  const positive = variance >= 0

  return (
    <>
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 h-14 flex items-center gap-3 px-4 print:hidden -mx-4 sm:-mx-6 lg:-mx-8 mb-0">
        <span className="font-semibold text-gray-900 text-sm flex-none">Friday Report</span>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <input
            type="date"
            value={date}
            onChange={e => { const v = e.target.value; if (v && !isFriday(v)) return; setDate(v); setData(null); setEmailHtml('') }}
            className="text-sm bg-transparent border-none outline-none text-gray-700 cursor-pointer"
          />
        </div>
        <button
          onClick={loadReport}
          disabled={loading || !date || !isFriday(date)}
          className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Loading…' : 'Preview Report'}
        </button>
        <div className="flex-1" />
        {data && (
          <>
            <button onClick={() => window.print()} className="text-sm border border-gray-300 bg-white px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
              Print
            </button>
            <button onClick={openDrawer} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Email Draft
            </button>
          </>
        )}
      </div>

      {!data && !loading && (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
          {date && !isFriday(date)
            ? <span className="text-red-500">Please select a Friday.</span>
            : 'Select a Friday and click Preview Report to generate.'}
        </div>
      )}
      {loading && <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading report…</div>}

      {data && (
        <div className="flex gap-6 mt-4 print:block">
          {/* Left sticky nav */}
          <nav className="hidden lg:block w-44 flex-none print:hidden">
            <div className="sticky top-20 space-y-0.5">
              {NAV_SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => jumpTo(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeSection === s.id ? 'bg-slate-900 text-white font-medium' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Main content */}
          <div ref={mainRef} className="flex-1 min-w-0 space-y-4">

            {/* PERFORMANCE */}
            <ReportSection id="perf" title="Performance" collapsed={collapsed.perf} onToggle={() => toggleCollapse('perf')}>
              {/* Hero */}
              <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Combined Receipts</p>
                <div className={`text-4xl font-bold font-mono mb-1 ${positive || !data.thisWeekProjectedTotal ? 'text-green-700' : 'text-red-600'}`}>
                  {dollars(data.combinedReceiptsTotal)}
                </div>
                {data.thisWeekProjectedTotal > 0 && (
                  <>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-sm font-semibold font-mono ${positive ? 'text-green-600' : 'text-red-600'}`}>
                        {positive ? '+' : ''}{dollars(variance)} ({positive ? '+' : ''}{pct!.toFixed(1)}%)
                      </span>
                      <span className="text-xs text-gray-400">vs {dollars(data.thisWeekProjectedTotal)} target</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-700 ${positive ? 'bg-green-500' : 'bg-red-400'}`}
                        style={{ width: `${Math.min(100, (data.combinedReceiptsTotal / data.thisWeekProjectedTotal) * 100).toFixed(1)}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
              {/* Division cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <SummaryCard label="Legacy Receipts" value={dollars(data.legacyReceiptsTotal)} color="text-slate-700" />
                <SummaryCard label="AB Receipts" value={dollars(data.abReceiptsTotal)} color="text-blue-700" />
                <SummaryCard label="This Week Target" value={dollars(data.thisWeekProjectedTotal)} color="text-orange-700" />
              </div>
            </ReportSection>

            {/* VARIANCE */}
            {(data.movedOut.length > 0 || data.dueNotReceived.length > 0 || data.partiallyReceived.length > 0 || data.unplannedReceipts.length > 0) && (
              <ReportSection id="var" title="Variance from Target" collapsed={collapsed.var} onToggle={() => toggleCollapse('var')}>
                <VarianceInsights
                  movedOut={data.movedOut}
                  dueNotReceived={data.dueNotReceived}
                  partiallyReceived={data.partiallyReceived}
                  unplannedReceipts={data.unplannedReceipts}
                />
              </ReportSection>
            )}

            {/* SURETY */}
            {data.suretyBreakdown.length > 0 && (
              <ReportSection id="sur" title="Surety Breakdown" collapsed={collapsed.sur} onToggle={() => toggleCollapse('sur')}
                pill={<span className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">{data.suretyBreakdown.length} active</span>}>
                <SuretyBreakdownTable rows={data.suretyBreakdown} />
              </ReportSection>
            )}

            {/* NEXT WEEK */}
            {data.nextWeekSections.length > 0 && (
              <ReportSection id="nxt" title="Next Week's Projected Payments"
                collapsed={collapsed.nxt} onToggle={() => toggleCollapse('nxt')}
                pill={<span className="text-xs font-mono font-semibold text-gray-500">{dollars(nextWeekTotal)}</span>}>
                {data.nextWeekSections.map(sec => <PaymentDateGroup key={sec.date} section={sec} />)}
              </ReportSection>
            )}

            {/* FUTURE */}
            {data.futureSections.length > 0 && (
              <ReportSection id="fut" title="Future Projected Payments"
                collapsed={collapsed.fut} onToggle={() => toggleCollapse('fut')}
                pill={<span className="text-xs font-mono font-semibold text-gray-500">{dollars(futureTotal)}</span>}>
                {data.futureSections.map(sec => <PaymentDateGroup key={sec.date} section={sec} />)}
              </ReportSection>
            )}

            {/* LAST WEEK */}
            {(data.lastWeekStatus.length > 0 || data.unplannedReceipts.length > 0) && (
              <ReportSection id="lst" title="Status of Last Week's Projections"
                collapsed={collapsed.lst} onToggle={() => toggleCollapse('lst')}
                pill={<span className="text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{data.lastWeekStatus.length} items</span>}>
                {data.lastWeekStatus.length > 0 && <LastWeekTable rows={data.lastWeekStatus} />}
                {data.unplannedReceipts.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Received But Not Projected</p>
                    <UnplannedTable rows={data.unplannedReceipts} />
                  </div>
                )}
              </ReportSection>
            )}

          </div>
        </div>
      )}

      {/* EMAIL DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex print:hidden">
          <div className="flex-1 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="w-full max-w-2xl bg-white flex flex-col shadow-2xl">
            {/* Drawer header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-200 flex-none">
              <span className="font-semibold text-gray-900">Email Draft</span>
              {emailMode === 'ai' && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">AI Enhanced</span>
              )}
              <div className="flex-1" />
              <button onClick={() => setDrawerOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 flex-none">
              {(['preview', 'source'] as const).map(t => (
                <button key={t} onClick={() => setEmailTab(t)}
                  className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${emailTab === t ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  {t === 'source' ? 'HTML Source' : 'Preview'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {emailTab === 'preview' ? (
                <div className="p-6" dangerouslySetInnerHTML={{ __html: emailHtml }} />
              ) : (
                <pre className="p-6 text-xs font-mono text-gray-600 whitespace-pre-wrap break-all">{emailHtml}</pre>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-200 flex-none flex-wrap">
              {/* Left: AI controls */}
              {emailMode === 'standard' ? (
                <button onClick={generateAiEmail}
                  className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  Enhance with AI
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={resetToStandard} className="text-sm text-gray-500 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Use Standard</button>
                  <button onClick={generateAiEmail} className="text-sm text-gray-500 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                    Regenerate
                  </button>
                </div>
              )}
              <div className="flex-1" />
              {/* Right: export */}
              {[
                { label: 'Print', action: printEmail },
                { label: copied === 'html' ? '✓ Copied!' : 'Copy HTML', action: copyHtml },
                { label: copied === 'text' ? '✓ Copied!' : 'Copy Text', action: copyText },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action}
                  className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
                  {btn.label}
                </button>
              ))}
              <button
                onClick={sendEmail}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap font-medium ${sendState === 'copied' ? 'bg-green-600 text-white border border-green-600' : 'bg-slate-900 text-white hover:bg-slate-700 border border-slate-900'}`}
              >
                {sendState === 'copied' ? '✓ Copied — paste into Gmail' : 'Send via Gmail'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ReportSection({ id, title, collapsed, onToggle, pill, children }: {
  id: string; title: string; collapsed: boolean; onToggle: () => void
  pill?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div id={id} className="bg-white rounded-xl border border-gray-200 break-inside-avoid">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors rounded-t-xl">
        <svg className={`w-4 h-4 text-gray-400 transition-transform flex-none ${collapsed ? '-rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {pill && <span className="ml-1">{pill}</span>}
      </button>
      {!collapsed && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">{label}</p>
      <p className={`text-base font-mono font-semibold ${color}`}>{value}</p>
    </div>
  )
}

function SuretyBreakdownTable({ rows }: { rows: SuretyBreakdownRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Surety</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">This Week Received</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Next Week Projected</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Future Projected</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map(r => (
            <tr key={r.surety} className="hover:bg-slate-50">
              <td className="px-3 py-2.5 font-medium text-gray-800">{r.label}</td>
              <td className="px-3 py-2.5 text-right font-mono text-slate-700">{r.receiptsTotal > 0 ? dollars(r.receiptsTotal) : <span className="text-gray-300">—</span>}</td>
              <td className="px-3 py-2.5 text-right font-mono text-amber-700">{r.nextWeekTotal > 0 ? dollars(r.nextWeekTotal) : <span className="text-gray-300">—</span>}</td>
              <td className="px-3 py-2.5 text-right font-mono text-gray-600">{r.futureTotal > 0 ? dollars(r.futureTotal) : <span className="text-gray-300">—</span>}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50">
            <td className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</td>
            <td className="px-3 py-2 text-right font-mono font-semibold text-slate-700">{dollars(rows.reduce((s, r) => s + r.receiptsTotal, 0))}</td>
            <td className="px-3 py-2 text-right font-mono font-semibold text-amber-700">{dollars(rows.reduce((s, r) => s + r.nextWeekTotal, 0))}</td>
            <td className="px-3 py-2 text-right font-mono font-semibold text-gray-600">{dollars(rows.reduce((s, r) => s + r.futureTotal, 0))}</td>
          </tr>
        </tfoot>
      </table>
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
          <div className={`px-3 py-1.5 bg-blue-50 rounded-t-lg border border-gray-200 flex justify-between ${section.legacyRows.length > 0 ? 'border-t-0' : ''}`}>
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
    <div className="hidden sm:block overflow-x-auto">
      <table className="w-full text-xs border border-t-0 border-gray-200 rounded-b-lg overflow-hidden min-w-[520px]">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium text-gray-500 whitespace-nowrap">Job #</th>
            <th className="px-3 py-1.5 text-left font-medium text-gray-500">Job Name</th>
            <th className="px-3 py-1.5 text-left font-medium text-gray-500 whitespace-nowrap">Surety</th>
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
              <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{formatSurety(r.surety)}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.estimateNumber}</td>
              <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{r.billingPeriod}</td>
              <td className="px-3 py-2 font-mono whitespace-nowrap">{dollars(r.estimatedAmountOwed)}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.statusName}</td>
              <td className="px-3 py-2 text-gray-400">{r.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Mobile fallback */}
      <div className="sm:hidden border border-t-0 border-gray-200 rounded-b-lg divide-y divide-gray-100">
        {rows.map((r, i) => (
          <div key={i} className="px-3 py-2.5">
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <span className="font-mono text-xs text-gray-500">{r.jobNumber}</span>
              <span className="text-xs text-gray-400 whitespace-nowrap">{r.statusName}</span>
            </div>
            <div className="text-xs text-gray-700 mb-1">{r.jobName}</div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold">{dollars(r.estimatedAmountOwed)}</span>
              <span className="text-xs text-gray-400">{r.billingPeriod}</span>
            </div>
            {r.notes && <div className="text-xs text-gray-400 mt-1 line-clamp-2">{r.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function LastWeekTable({ rows }: { rows: LastWeekStatusRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[460px]">
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
    </div>
  )
}

function UnplannedTable({ rows }: { rows: UnplannedReceiptRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[380px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="pb-2 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Job #</th>
            <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide">Job Name</th>
            <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Division</th>
            <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Date</th>
            <th className="pb-2 px-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="py-2 font-mono whitespace-nowrap">{r.jobNumber}</td>
              <td className="py-2 px-3 text-gray-700">{r.jobName}</td>
              <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{r.division}</td>
              <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{r.datePmtReceived}</td>
              <td className="py-2 px-3 font-mono whitespace-nowrap text-green-600">{dollars(r.amountReceived)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VarianceInsights({ movedOut, dueNotReceived, partiallyReceived, unplannedReceipts }: {
  movedOut: MovedOutRow[]; dueNotReceived: DueNotReceivedRow[]
  partiallyReceived: PartiallyReceivedRow[]; unplannedReceipts: UnplannedReceiptRow[]
}) {
  const movedTotal = movedOut.reduce((s, r) => s + r.estimatedAmountOwed, 0)
  const dueTotal = dueNotReceived.reduce((s, r) => s + r.estimatedAmountOwed, 0)
  const partialTotal = partiallyReceived.reduce((s, r) => s + r.estimatedAmountOwed, 0)
  const unplannedTotal = unplannedReceipts.reduce((s, r) => s + r.amountReceived, 0)

  return (
    <div className="space-y-3">
      {movedOut.length > 0 && (
        <InsightBucket title="Moved to a Future Date" amount={-movedTotal} color="red">
          <table className="w-full text-xs mt-2 min-w-[480px]">
            <thead><tr className="border-b border-gray-100">
              <th className="pb-1 pr-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Job #</th>
              <th className="pb-1 pr-3 text-left font-medium text-gray-400 uppercase tracking-wide">Job Name</th>
              <th className="pb-1 pr-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Amount</th>
              <th className="pb-1 pr-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Moved To</th>
              <th className="pb-1 text-left font-medium text-gray-400 uppercase tracking-wide">Reason</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {movedOut.map((r, i) => (
                <tr key={i}>
                  <td className="py-1.5 pr-3 font-mono whitespace-nowrap">{r.jobNumber}</td>
                  <td className="py-1.5 pr-3 text-gray-700">{r.jobName}</td>
                  <td className="py-1.5 pr-3 font-mono whitespace-nowrap text-red-600">{dollars(r.estimatedAmountOwed)}</td>
                  <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{r.newDate}</td>
                  <td className="py-1.5 text-gray-400 italic">{r.reason.trim() || 'no reason given'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </InsightBucket>
      )}
      {dueNotReceived.length > 0 && (
        <InsightBucket title="Still Expected This Week" amount={-dueTotal} color="orange">
          <table className="w-full text-xs mt-2 min-w-[420px]">
            <thead><tr className="border-b border-gray-100">
              <th className="pb-1 pr-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Job #</th>
              <th className="pb-1 pr-3 text-left font-medium text-gray-400 uppercase tracking-wide">Job Name</th>
              <th className="pb-1 pr-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Amount</th>
              <th className="pb-1 pr-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Scheduled</th>
              <th className="pb-1 text-left font-medium text-gray-400 uppercase tracking-wide">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {dueNotReceived.map((r, i) => (
                <tr key={i}>
                  <td className="py-1.5 pr-3 font-mono whitespace-nowrap">{r.jobNumber}</td>
                  <td className="py-1.5 pr-3 text-gray-700">{r.jobName}</td>
                  <td className="py-1.5 pr-3 font-mono whitespace-nowrap text-orange-600">{dollars(r.estimatedAmountOwed)}</td>
                  <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{r.scheduledDate}</td>
                  <td className="py-1.5 text-gray-500">{r.statusName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </InsightBucket>
      )}
      {partiallyReceived.length > 0 && (
        <InsightBucket title="Partial Payments Received" amount={-partialTotal} color="orange" amountLabel="remaining">
          <table className="w-full text-xs mt-2 min-w-[360px]">
            <thead><tr className="border-b border-gray-100">
              <th className="pb-1 pr-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Job #</th>
              <th className="pb-1 pr-3 text-left font-medium text-gray-400 uppercase tracking-wide">Job Name</th>
              <th className="pb-1 pr-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Remaining</th>
              <th className="pb-1 text-left font-medium text-gray-400 uppercase tracking-wide">Notes</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {partiallyReceived.map((r, i) => (
                <tr key={i}>
                  <td className="py-1.5 pr-3 font-mono whitespace-nowrap">{r.jobNumber}</td>
                  <td className="py-1.5 pr-3 text-gray-700">{r.jobName}</td>
                  <td className="py-1.5 pr-3 font-mono whitespace-nowrap text-orange-600">{dollars(r.estimatedAmountOwed)}</td>
                  <td className="py-1.5 text-gray-400">{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </InsightBucket>
      )}
      {unplannedReceipts.length > 0 && (
        <InsightBucket title="Unplanned Receipts" amount={unplannedTotal} color="green">
          <table className="w-full text-xs mt-2 min-w-[380px]">
            <thead><tr className="border-b border-gray-100">
              <th className="pb-1 pr-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Job #</th>
              <th className="pb-1 pr-3 text-left font-medium text-gray-400 uppercase tracking-wide">Job Name</th>
              <th className="pb-1 pr-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Division</th>
              <th className="pb-1 pr-3 text-left font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">Date</th>
              <th className="pb-1 text-left font-medium text-gray-400 uppercase tracking-wide">Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {unplannedReceipts.map((r, i) => (
                <tr key={i}>
                  <td className="py-1.5 pr-3 font-mono whitespace-nowrap">{r.jobNumber}</td>
                  <td className="py-1.5 pr-3 text-gray-700">{r.jobName}</td>
                  <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{r.division}</td>
                  <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{r.datePmtReceived}</td>
                  <td className="py-1.5 font-mono whitespace-nowrap text-green-600">{dollars(r.amountReceived)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </InsightBucket>
      )}
    </div>
  )
}

function InsightBucket({ title, amount, color, amountLabel, children }: {
  title: string; amount: number; color: 'red' | 'orange' | 'green'
  amountLabel?: string; children: React.ReactNode
}) {
  const colorMap = {
    red:    { badge: 'bg-red-50 text-red-700 border-red-200',       bar: 'bg-red-400' },
    orange: { badge: 'bg-orange-50 text-orange-700 border-orange-200', bar: 'bg-orange-400' },
    green:  { badge: 'bg-green-50 text-green-700 border-green-200',  bar: 'bg-green-400' },
  }
  const c = colorMap[color]
  const sign = amount > 0 ? '+' : ''
  const amtStr = `${sign}${dollars(Math.abs(amount))}${amountLabel ? ' ' + amountLabel : ''}`
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-4 rounded-full ${c.bar}`} />
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</span>
        </div>
        <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border ${c.badge}`}>{amtStr}</span>
      </div>
      <div className="px-3 pb-3 overflow-x-auto">{children}</div>
    </div>
  )
}
