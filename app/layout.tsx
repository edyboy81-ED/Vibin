import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth'
import LogoutButton from './components/LogoutButton'
import WhatsNewModal from './components/WhatsNewModal'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Vibin AR',
  description: 'Accounts receivable cash flow management',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const isAuthenticated = token ? await verifySessionToken(token) : false

  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen flex flex-col`} suppressHydrationWarning>
        {isAuthenticated && (
          <nav className="bg-slate-900 text-white px-6 py-0 flex items-stretch gap-1 shadow-lg print:hidden">
            <span className="font-bold text-lg tracking-tight flex items-center pr-6 border-r border-slate-700 mr-2">
              Vibin AR
            </span>
            <NavLink href="/">Dashboard</NavLink>
            <NavLink href="/jobs">Cash Receipts</NavLink>
            <NavLink href="/projections">Projections</NavLink>
            <NavLink href="/report">Friday Report</NavLink>
            <NavLink href="/settings">Settings</NavLink>
            <div className="ml-auto flex items-center">
              <LogoutButton />
            </div>
          </nav>
        )}
        <main className="flex-1 p-6 max-w-screen-xl mx-auto w-full">{children}</main>
        <footer className="bg-slate-900 print:hidden">
          <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">Vibin AR · v1.4.0</span>
            <WhatsNewModal />
          </div>
        </footer>
      </body>
    </html>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm text-slate-300 hover:text-white hover:bg-slate-800 px-4 flex items-center transition-colors"
    >
      {children}
    </Link>
  )
}
