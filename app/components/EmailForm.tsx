'use client'

import { useState } from 'react'

export default function EmailForm() {
  const [to, setTo] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSend = async () => {
    if (!to) return
    setStatus('sending')
    setErrorMsg('')
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      })
      if (res.ok) {
        setStatus('sent')
      } else {
        const d = await res.json()
        setErrorMsg(d.error ?? 'Failed to send email')
        setStatus('error')
      }
    } catch {
      setErrorMsg('Network error')
      setStatus('error')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mt-8">
      <h2 className="text-lg font-semibold mb-1">Email Reconciliation Report</h2>
      <p className="text-sm text-gray-500 mb-4">Sends the current report as an HTML email via Gmail.</p>
      <div className="flex gap-3 items-center">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="recipient@example.com"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={status === 'sending'}
        />
        <button
          onClick={handleSend}
          disabled={status === 'sending' || !to}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm transition-colors"
        >
          {status === 'sending' ? 'Sending…' : 'Send Report'}
        </button>
      </div>
      {status === 'sent' && (
        <p className="text-green-600 text-sm mt-3">Report sent to {to}.</p>
      )}
      {status === 'error' && (
        <p className="text-red-600 text-sm mt-3">{errorMsg}</p>
      )}
    </div>
  )
}
