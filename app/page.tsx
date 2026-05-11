import { prisma } from '@/lib/db'
import DashboardView from './components/DashboardView'

export default async function DashboardPage() {
  const today = new Date()

  const dayOfWeekForFriday = today.getUTCDay()
  const daysUntilFriday = dayOfWeekForFriday === 5 ? 7 : (5 - dayOfWeekForFriday + 7) % 7
  const friday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysUntilFriday))

  const startOfWeek = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() - (today.getUTCDay() === 0 ? 6 : today.getUTCDay() - 1)
  ))
  const endOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999))

  const dayOfWeek = today.getUTCDay()
  const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const nextWeekMon = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysUntilNextMonday))
  const nextWeekFri = new Date(Date.UTC(nextWeekMon.getUTCFullYear(), nextWeekMon.getUTCMonth(), nextWeekMon.getUTCDate() + 4))
  const nextWeekFriEnd = new Date(Date.UTC(nextWeekFri.getUTCFullYear(), nextWeekFri.getUTCMonth(), nextWeekFri.getUTCDate(), 23, 59, 59, 999))

  const weekWindow = { gte: startOfWeek, lte: endOfToday }

  const [jobs, weekJobs, allActive, nextWeekProjections, futureProjections] = await Promise.all([
    prisma.job.count(),
    prisma.job.findMany({
      where: { payments: { some: { datePmtReceived: weekWindow } } },
      include: { payments: { where: { datePmtReceived: weekWindow } } },
    }),
    prisma.projectedPayment.findMany({
      where: { isActive: true },
      select: { status: { select: { name: true } } },
    }),
    prisma.projectedPayment.findMany({
      where: { isActive: true, estimatedPaymentDate: { gte: nextWeekMon, lte: nextWeekFriEnd }, NOT: [{ status: { name: { equals: 'received', mode: 'insensitive' } } }] },
      select: { estimatedAmountOwed: true },
    }),
    prisma.projectedPayment.findMany({
      where: { isActive: true, estimatedPaymentDate: { gt: nextWeekFriEnd }, NOT: [{ status: { name: { equals: 'received', mode: 'insensitive' } } }] },
      select: { estimatedAmountOwed: true },
    }),
  ])

  const weekLegacyJobs = weekJobs.filter(j => j.division === 'LEGACY')
  const weekABJobs = weekJobs.filter(j => j.division === 'AB')
  const weekLegacy = weekLegacyJobs.reduce((s, j) => s + j.payments.reduce((ps, p) => ps + p.amountReceived, 0), 0)
  const weekAB = weekABJobs.reduce((s, j) => s + j.payments.reduce((ps, p) => ps + p.amountReceived, 0), 0)

  return (
    <DashboardView data={{
      friday: friday.toISOString(),
      weekLegacy,
      weekAB,
      weekLegacyCount: weekLegacyJobs.length,
      weekABCount: weekABJobs.length,
      weekTotalCount: weekJobs.length,
      nextWeekTotal: nextWeekProjections.reduce((s, p) => s + p.estimatedAmountOwed, 0),
      nextWeekCount: nextWeekProjections.length,
      futureTotal: futureProjections.reduce((s, p) => s + p.estimatedAmountOwed, 0),
      futureCount: futureProjections.length,
      projectedCount: allActive.filter(p => p.status.name === 'Projected').length,
      partialCount: allActive.filter(p => p.status.name === 'Partial').length,
      allActiveCount: allActive.length,
      jobsCount: jobs,
      dateFrom: startOfWeek.toISOString().slice(0, 10),
      dateTo: today.toISOString().slice(0, 10),
      nextWeekMonStr: nextWeekMon.toISOString().slice(0, 10),
      nextWeekFriStr: nextWeekFri.toISOString().slice(0, 10),
      afterNextWeekFriStr: new Date(nextWeekFri.getTime() + 86_400_000).toISOString().slice(0, 10),
    }} />
  )
}
