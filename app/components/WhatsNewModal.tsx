'use client'

import { useState } from 'react'

const VERSION = 'v1.3.0'

const CHANGELOG = [
  {
    version: 'v1.3.0',
    date: 'May 2026',
    title: 'Projection Intelligence',
    changes: [
      'Received projections excluded from dashboard KPI cards and Friday Report totals even when payment date is in the future (early payment support)',
      'Dashboard Next Week and Future drill-through now matches KPI totals exactly',
    ],
  },
  {
    version: 'v1.2.0',
    date: 'May 2026',
    title: 'Import Improvements',
    changes: [
      'Excel date corruption detection — import pauses and prompts user to correct job numbers auto-formatted as dates by Excel (e.g. Oct-69 → 10-2369)',
      'Smart projection upsert — re-importing a CSV updates existing projections instead of creating duplicates',
      'Amount and payment date changes are auto-logged as notes during import',
      'Fixed timezone bug that caused duplicate projections when the same date was stored with different UTC offsets',
      'Unmatched jobs during projection import can now be created inline without leaving the import flow',
      'Import results show Projections Updated count separately from Projections Created',
    ],
  },
  {
    version: 'v1.1.0',
    date: 'April–May 2026',
    title: 'Reporting & Dashboard',
    changes: [
      'Friday Report — print support added',
      'Friday Report — email body reformatted for leadership readability',
      'Friday Report — week boundary and date display fixes',
      'Dashboard KPI cards are now clickable and drill into filtered views',
      'Dashboard cash receipts scoped to current work week (Mon–today)',
      'Date range filter added to Cash Receipts page',
      'Post Payment action added to projection detail page',
      'Follow-up projection creation from job detail page',
      'Move Date feature on projections with reason tracking and movement history',
      'Communication log with notes on each projection',
    ],
  },
  {
    version: 'v1.0.1',
    date: 'April 2026',
    title: 'Cash Receipts Enhancements',
    changes: [
      'Cash receipts view rebuilt to be payment-centric with correct totals',
      'Delete payments directly from job detail page',
      'Job number now editable on job detail page',
      'Customer field added to jobs across UI, import, and export',
      'CSV import for jobs and full payment history',
      'Projection status management added to Settings',
    ],
  },
  {
    version: 'v1.0.0',
    date: 'April 2026',
    title: 'Initial Release',
    changes: [
      'Dashboard with weekly cash receipt KPIs and projected payment summaries',
      'Cash Receipts — job and payment management',
      'Projections — projected payment tracking grouped by date and division',
      'Friday Report — automated leadership email report builder',
      'Settings — projection status configuration',
    ],
  },
]

export default function WhatsNewModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-slate-400 hover:text-white text-xs transition-colors"
      >
        What&apos;s New
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">What&apos;s New</h2>
                <p className="text-xs text-gray-400 mt-0.5">Vibin AR · {VERSION}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Changelog */}
            <div className="overflow-y-auto px-6 py-4 space-y-6">
              {CHANGELOG.map((release) => (
                <div key={release.version}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-slate-900 text-white text-xs font-mono px-2 py-0.5 rounded">
                      {release.version}
                    </span>
                    <span className="font-semibold text-gray-900 text-sm">{release.title}</span>
                    <span className="text-xs text-gray-400 ml-auto">{release.date}</span>
                  </div>
                  <ul className="space-y-1.5 pl-1">
                    {release.changes.map((change, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-600">
                        <span className="text-slate-400 mt-0.5 shrink-0">•</span>
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
