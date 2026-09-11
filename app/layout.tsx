import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth'
import WhatsNewModal from './components/WhatsNewModal'
import MobileMenu from './components/MobileMenu'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Vibin AR',
  description: 'Accounts receivable cash flow management',
}

type ThemeId = 'slate-emerald' | 'white-indigo' | 'dark-mode' | 'warm-neutral'

const THEME_NAV: Record<ThemeId, string> = {
  'slate-emerald': 'bg-slate-900',
  'white-indigo':  'bg-indigo-950',
  'dark-mode':     'bg-slate-950',
  'warm-neutral':  'bg-stone-900',
}
const THEME_BODY: Record<ThemeId, string> = {
  'slate-emerald': 'bg-gray-50',
  'white-indigo':  'bg-gray-50',
  'dark-mode':     'bg-slate-950',
  'warm-neutral':  'bg-stone-50',
}
const VALID_THEMES: ThemeId[] = ['slate-emerald', 'white-indigo', 'dark-mode', 'warm-neutral']

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const isAuthenticated = token ? await verifySessionToken(token) : false

  const themeCookie = cookieStore.get('vibin-dashboard-theme')?.value as ThemeId | undefined
  const theme: ThemeId = themeCookie && VALID_THEMES.includes(themeCookie) ? themeCookie : 'slate-emerald'
  const navBg = THEME_NAV[theme]
  const bodyBg = THEME_BODY[theme]

  return (
    <html lang="en">
      <body className={`${inter.className} ${bodyBg} min-h-screen flex flex-col`} suppressHydrationWarning>
        {isAuthenticated && (
          <nav className={`${navBg} text-white px-4 sm:px-6 py-0 flex items-stretch gap-1 shadow-lg print:hidden`}>
            <span className="font-bold text-lg tracking-tight flex items-center pr-4 sm:pr-6 border-r border-slate-700 mr-2">
              Vibin AR
            </span>
            {/* Desktop nav links */}
            <div className="hidden md:flex items-stretch gap-1">
              <NavLink href="/">Dashboard</NavLink>
              <NavLink href="/jobs">Cash Receipts</NavLink>
              <NavLink href="/projections">Projections</NavLink>
              <NavLink href="/report">Friday Report</NavLink>
              <NavLink href="/settings">Settings</NavLink>
            </div>
            <div className="ml-auto flex items-center">
              <MobileMenu />
            </div>
          </nav>
        )}
        <main className="flex-1 p-4 sm:p-6 max-w-screen-xl mx-auto w-full">{children}</main>
        <footer className="bg-slate-900 print:hidden">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">Vibin AR · v1.7.0</span>
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
