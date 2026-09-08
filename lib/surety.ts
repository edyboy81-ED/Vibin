export const SURETY_OPTIONS = ['ZURICH', 'BERKSHIRE', 'MARKEL', 'UNBONDED'] as const
export type Surety = typeof SURETY_OPTIONS[number]

export const SURETY_LABELS: Record<string, string> = {
  ZURICH: 'Zurich',
  BERKSHIRE: 'Berkshire',
  MARKEL: 'Markel',
  UNBONDED: 'Unbonded',
}

export function normalizeSurety(s: string): string {
  const v = s.trim().toUpperCase()
  if (v === 'ZURICH') return 'ZURICH'
  if (v === 'BERKSHIRE') return 'BERKSHIRE'
  if (v === 'MARKEL') return 'MARKEL'
  return 'UNBONDED'
}

export function formatSurety(s: string | null | undefined): string {
  if (!s) return 'Unbonded'
  return SURETY_LABELS[s] ?? s
}
