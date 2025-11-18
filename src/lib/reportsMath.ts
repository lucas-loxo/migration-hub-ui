import type { MigrationRow } from './schema'
import { getSLA } from './stageThresholds'

export const isActive = (r: MigrationRow): boolean => r.Stage !== "Complete"

export const getSLAFor = (stage: string, overrides?: Record<string, number>): number =>
  getSLA(stage, overrides)

export const isBehind = (r: MigrationRow, sla: (s: string) => number): boolean =>
  isActive(r) && r.DaysInStage > sla(r.Stage)

export const daysRemaining = (r: MigrationRow, sla: (s: string) => number): number =>
  sla(r.Stage) - r.DaysInStage

export const isDueSoon = (r: MigrationRow, sla: (s: string) => number): boolean => {
  const s = sla(r.Stage)
  const rem = s - r.DaysInStage
  return isActive(r) && rem <= 7 && r.DaysInStage <= s
}

export function bucket(stage: string): 'EARLY' | 'MID' | 'LATE' | 'OTHER' {
  const early = ['Waiting on Data Upload', 'Waiting on Eng Import Map', 'Waiting on Customer Import Map']
  const mid = ['Waiting on Validation Requests', 'Waiting on Eng Validation']
  const late = ['Waiting on Final Confirmation', 'Waiting on Duplicate Merge']
  
  if (early.includes(stage)) return 'EARLY'
  if (mid.includes(stage)) return 'MID'
  if (late.includes(stage)) return 'LATE'
  return 'OTHER'
}

export function isValidOwner(owner: string | null | undefined): boolean {
  if (!owner) return false
  const trimmed = owner.trim()
  return trimmed.length > 0 && trimmed !== '#VALUE!'
}

export function groupByOwnerAndStage(
  rows: MigrationRow[]
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>()
  
  for (const row of rows) {
    if (!isActive(row)) continue
    if (!isValidOwner(row.OwnerEmail)) continue
    
    const owner = row.OwnerEmail.trim()
    const stage = row.Stage
    
    if (!result.has(owner)) {
      result.set(owner, new Map())
    }
    
    const stageMap = result.get(owner)!
    stageMap.set(stage, (stageMap.get(stage) || 0) + 1)
  }
  
  return result
}

export function ownerTotals(
  ownerMap: Map<string, number>,
  owner: string,
  getSLAFn: (stage: string) => number,
  allRows: MigrationRow[]
): { active: number; behind: number; earlyMid: number } {
  const ownerRows = allRows.filter((r) => r.OwnerEmail?.trim() === owner && isActive(r))
  
  const active = ownerRows.length
  const behind = ownerRows.filter((r) => isBehind(r, getSLAFn)).length
  
  let earlyMid = 0
  for (const [stage, count] of ownerMap.entries()) {
    const b = bucket(stage)
    if (b === 'EARLY' || b === 'MID') {
      earlyMid += count
    }
  }
  
  return { active, behind, earlyMid }
}

export function columnTotals(
  ownerStageMap: Map<string, Map<string, number>>
): Map<string, number> {
  const totals = new Map<string, number>()
  
  for (const stageMap of ownerStageMap.values()) {
    for (const [stage, count] of stageMap.entries()) {
      totals.set(stage, (totals.get(stage) || 0) + count)
    }
  }
  
  return totals
}

export function mean(numbers: number[]): number {
  if (numbers.length === 0) return 0
  const sum = numbers.reduce((acc, n) => acc + n, 0)
  return sum / numbers.length
}

export function computeKPIs(
  rows: MigrationRow[],
  getSLAFn: (stage: string) => number
): { Active: number; Behind: number; BehindPct: number; AvgDaysPerMigration: number } {
  const active = rows.filter(isActive)
  const activeCount = active.length

  if (activeCount === 0) {
    return { Active: 0, Behind: 0, BehindPct: 0, AvgDaysPerMigration: 0 }
  }

  const behind = active.filter((r) => isBehind(r, getSLAFn))
  const behindCount = behind.length
  const behindPct = (behindCount / activeCount) * 100

  const avgDays =
    activeCount > 0
      ? active.reduce((sum, r) => sum + r.DaysInStage, 0) / activeCount
      : 0

  return {
    Active: activeCount,
    Behind: behindCount,
    BehindPct: behindPct,
    AvgDaysPerMigration: avgDays,
  }
}

export function groupByBTC(
  rows: MigrationRow[],
  getSLAFn: (stage: string) => number
): Array<{
  BTC: string
  Active: number
  Behind: number
  BehindPct: number
  AvgDaysInStage: number
  DueSoon: number
}> {
  const byBTC = new Map<string, MigrationRow[]>()
  for (const row of rows) {
    const btc = row.OwnerEmail || '—'
    if (!byBTC.has(btc)) {
      byBTC.set(btc, [])
    }
    byBTC.get(btc)!.push(row)
  }

  const results: Array<{
    BTC: string
    Active: number
    Behind: number
    BehindPct: number
    AvgDaysInStage: number
    DueSoon: number
  }> = []

  for (const [btc, btcRows] of byBTC.entries()) {
    const active = btcRows.filter(isActive)
    const activeCount = active.length

    if (activeCount === 0) {
      results.push({
        BTC: btc,
        Active: 0,
        Behind: 0,
        BehindPct: 0,
        AvgDaysInStage: 0,
        DueSoon: 0,
      })
      continue
    }

    const behind = active.filter((r) => isBehind(r, getSLAFn))
    const behindCount = behind.length
    const behindPct = (behindCount / activeCount) * 100
    const avgDaysInStage = active.reduce((sum, r) => sum + r.DaysInStage, 0) / activeCount
    const dueSoon = active.filter((r) => isDueSoon(r, getSLAFn)).length

    results.push({
      BTC: btc,
      Active: activeCount,
      Behind: behindCount,
      BehindPct: behindPct,
      AvgDaysInStage: avgDaysInStage,
      DueSoon: dueSoon,
    })
  }

  // Sort by Behind % desc, then Active desc
  results.sort((a, b) => {
    if (b.BehindPct !== a.BehindPct) {
      return b.BehindPct - a.BehindPct
    }
    return b.Active - a.Active
  })

  return results
}

