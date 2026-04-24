/*
 * Seed script — uncomment and adapt to load example data.
 *
 * Example data shape:
 *
 * Jobs (amounts in cents):
 * { jobNumber: 'J001', company: 'PRESTIGE', name: 'Spring Gala',      date: new Date('2024-03-15'), amount: 150000 } // $1,500.00
 * { jobNumber: 'J002', company: 'HARMONY',  name: 'Summer Festival',  date: new Date('2024-06-20'), amount: 200000 } // $2,000.00
 * { jobNumber: 'J003', company: 'RHYTHM',   name: null,               date: new Date('2024-09-01'), amount:  75000 } // $750.00 — manual entry, display jobNumber
 *
 * Receipts (amounts in cents):
 * { jobNumber: 'J001', company: 'PRESTIGE', amount: 150000, date: new Date('2024-03-22') }             // exact match
 * { jobNumber: 'J002', company: 'HARMONY',  amount: 180000, date: new Date('2024-06-25') }             // underpaid by $200
 * { jobNumber: 'J999', company: 'ENCORE',   amount:  50000, date: new Date('2024-10-10'), description: 'Walk-on fee' } // no matching job
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // await prisma.job.createMany({ data: [ ... ] })
  // await prisma.receipt.createMany({ data: [ ... ] })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
