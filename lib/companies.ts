export const LEGACY_COMPANIES = [
  'Johnson Bros Corporation',
  'Oscar Renda Contracting',
  'Southland Contracting',
  'Heritage Materials',
  'Southland Renda JV',
  'Southland Technicore Mole JV',
  'Southland Mole of Canada - Astaldi JV',
  'Oscar Renda Contracting - Canada',
] as const

export const ALL_COMPANIES = [...LEGACY_COMPANIES, 'AB'] as const

export type Division = 'LEGACY' | 'AB'

export function getDivision(company: string): Division {
  return (LEGACY_COMPANIES as readonly string[]).includes(company) ? 'LEGACY' : 'AB'
}
