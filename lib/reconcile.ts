export interface ReconcileJob {
  id: string
  jobNumber: string
  company: string
  name: string | null
  date: Date | null
  amount: number // cents
  notes: string | null
}

export interface ReconcileReceipt {
  id: string
  jobNumber: string
  company: string
  amount: number // cents
  date: Date
  description: string | null
}

export interface MatchedPair {
  job: ReconcileJob
  receipt: ReconcileReceipt
  /** receipt.amount - job.amount (cents). Negative = underpaid, positive = overpaid. */
  amountDiff: number
}

export interface ReconciliationResult {
  matched: MatchedPair[]
  unmatchedJobs: ReconcileJob[]
  unmatchedReceipts: ReconcileReceipt[]
}

/**
 * Pure function — no side effects, easy to unit-test.
 * Matches each job to at most one receipt using exact jobNumber + company.
 * First match wins when multiple receipts share the same key.
 */
export function reconcile(
  jobs: ReconcileJob[],
  receipts: ReconcileReceipt[],
): ReconciliationResult {
  const usedReceiptIds = new Set<string>()
  const usedJobIds = new Set<string>()
  const matched: MatchedPair[] = []

  for (const job of jobs) {
    const receipt = receipts.find(
      (r) =>
        r.jobNumber === job.jobNumber &&
        r.company === job.company &&
        !usedReceiptIds.has(r.id),
    )
    if (receipt) {
      matched.push({ job, receipt, amountDiff: receipt.amount - job.amount })
      usedJobIds.add(job.id)
      usedReceiptIds.add(receipt.id)
    }
  }

  return {
    matched,
    unmatchedJobs: jobs.filter((j) => !usedJobIds.has(j.id)),
    unmatchedReceipts: receipts.filter((r) => !usedReceiptIds.has(r.id)),
  }
}
