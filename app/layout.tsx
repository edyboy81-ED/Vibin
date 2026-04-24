import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth'
import LogoutButton from './components/LogoutButton'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Vibin',
  description: 'Job tracking & reconciliation',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const isAuthenticated = token ? await verifySessionToken(token) : false

  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        {isAuthenticated && (
          <nav className="bg-indigo-700 text-white px-6 py-3 flex items-center gap-6 shadow">
            <span className="font-bold text-lg tracking-tight">Vibin</span>
            <Link href="/" className="text-sm hover:text-indigo-200 transition-colors">
              Dashboard
            </Link>
            <Link href="/jobs" className="text-sm hover:text-indigo-200 transition-colors">
              Jobs
            </Link>
            <Link href="/receipts" className="text-sm hover:text-indigo-200 transition-colors">
              Receipts
            </Link>
            <Link href="/reconciliation" className="text-sm hover:text-indigo-200 transition-colors">
              Reconciliation
            </Link>
            <div className="ml-auto">
              <LogoutButton />
            </div>
          </nav>
        )}
        <main className="p-6">{children}</main>
      </body>
    </html>
  )
}
