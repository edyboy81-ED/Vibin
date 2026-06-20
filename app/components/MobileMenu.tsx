'use client'

import { useState } from 'react'
import Link from 'next/link'

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/jobs', label: 'Cash Receipts' },
  { href: '/projections', label: 'Projections' },
  { href: '/report', label: 'Friday Report' },
  { href: '/settings', label: 'Settings' },
]

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

export default function MobileMenu() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className="flex flex-col justify-center gap-1.5 p-2 -mr-2"
        onClick={() => setOpen(o => !o)}
        aria-label="Open menu"
      >
        <span className="w-5 h-0.5 bg-white block" />
        <span className="w-5 h-0.5 bg-white block" />
        <span className="w-5 h-0.5 bg-white block" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute top-0 left-0 bottom-0 w-64 bg-slate-900 flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <span className="font-bold text-white text-lg">Vibin AR</span>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <nav className="flex-1 py-2">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-6 py-3.5 text-slate-300 hover:text-white hover:bg-slate-800 text-sm transition-colors"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="border-t border-slate-700 px-6 py-4">
              <button
                onClick={handleLogout}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
