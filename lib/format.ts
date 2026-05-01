export function dollars(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export function fmtDateLong(d: Date | string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

// Returns YYYY-MM-DD for <input type="date"> value
export function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = new Date(d)
  return date.toISOString().split('T')[0]
}

export function daysSince(d: Date | string | null | undefined): number | null {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
}

// Returns the date of the next Friday on or after today
export function nextFriday(from: Date = new Date()): Date {
  const d = new Date(from)
  const day = d.getDay() // 0=Sun … 6=Sat
  const daysUntilFriday = day <= 5 ? 5 - day : 6 // if Sat, go to next Fri
  d.setDate(d.getDate() + daysUntilFriday)
  d.setHours(0, 0, 0, 0)
  return d
}

export function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

export function endOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
