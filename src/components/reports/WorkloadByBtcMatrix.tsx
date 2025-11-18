import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../Card.jsx'
import type { MigrationRow } from '../../lib/schema'
import { groupByOwnerAndStage, ownerTotals, columnTotals, isBehind, getSLAFor } from '../../lib/reportsMath'

type WorkloadByBtcMatrixProps = {
  rows: MigrationRow[]
  getSLA: (stage: string) => number
  slaOverrides?: Record<string, number>
  loading?: boolean
}

const STAGE_ORDER = [
  'Waiting on Data Upload',
  'Waiting on Eng Import Map',
  'Waiting on Customer Import Map',
  'Waiting on Data Import',
  'Waiting on Validation Requests',
  'Waiting on Eng Validation',
  'Waiting on Final Confirmation',
  'Waiting on Duplicate Merge',
] as const

const UI_TWO_LINE: Record<string, [string, string]> = {
  'Waiting on Data Upload': ['DATA', 'UPLOAD'],
  'Waiting on Eng Import Map': ['ENG', 'MAP'],
  'Waiting on Customer Import Map': ['CUST', 'MAP'],
  'Waiting on Data Import': ['DATA', 'IMPORT'],
  'Waiting on Validation Requests': ['VAL', 'REQS'],
  'Waiting on Eng Validation': ['ENG', 'VAL'],
  'Waiting on Final Confirmation': ['FINAL', 'CONFIRM'],
  'Waiting on Duplicate Merge': ['DUP', 'MERGE'],
}

// Generate color scale using pink
function getColorForCount(count: number, max: number): string {
  if (count === 0) return 'bg-white'
  if (max === 0) return 'bg-[#E01E73]/10'
  
  const intensity = count / max
  if (intensity <= 0.16) return 'bg-[#E01E73]/10'
  if (intensity <= 0.33) return 'bg-[#E01E73]/20'
  if (intensity <= 0.5) return 'bg-[#E01E73]/30'
  if (intensity <= 0.66) return 'bg-[#E01E73]/50'
  if (intensity <= 0.83) return 'bg-[#E01E73]/70'
  return 'bg-[#E01E73] text-white'
}

export default function WorkloadByBtcMatrix({
  rows,
  getSLA,
  slaOverrides,
  loading,
}: WorkloadByBtcMatrixProps) {
  const navigate = useNavigate()
  
  const { matrix, sortedOwners, totals } = useMemo(() => {
    if (loading || rows.length === 0) {
      return { matrix: new Map(), sortedOwners: [], totals: new Map() }
    }
    
    const ownerStageMap = groupByOwnerAndStage(rows)
    const colTotals = columnTotals(ownerStageMap)
    
    // Build matrix rows with totals
    const matrixRows = new Map<string, { stageCounts: Map<string, number>; totals: { active: number; behind: number; earlyMid: number } }>()
    
    for (const [owner, stageMap] of ownerStageMap.entries()) {
      const totals = ownerTotals(stageMap, owner, getSLA, rows)
      matrixRows.set(owner, { stageCounts: stageMap, totals })
    }
    
    // Sort owners: Behind desc, then Early+Mid sum desc, then Active desc
    const sortedOwners = Array.from(matrixRows.entries()).sort((a, b) => {
      const aTotals = a[1].totals
      const bTotals = b[1].totals
      
      if (bTotals.behind !== aTotals.behind) {
        return bTotals.behind - aTotals.behind
      }
      if (bTotals.earlyMid !== aTotals.earlyMid) {
        return bTotals.earlyMid - aTotals.earlyMid
      }
      return bTotals.active - aTotals.active
    })
    
    return { matrix: matrixRows, sortedOwners, totals: colTotals }
  }, [rows, getSLA, loading])
  
  const maxCount = useMemo(() => {
    let max = 0
    for (const row of matrix.values()) {
      for (const count of row.stageCounts.values()) {
        if (count > max) max = count
      }
    }
    return max
  }, [matrix])
  
  if (loading) {
    return (
      <Card className="p-4 md:p-6">
        <div className="h-6 bg-[#E3D7E8] rounded w-1/4 mb-4 animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-[#E3D7E8] rounded animate-pulse" />
          ))}
        </div>
      </Card>
    )
  }
  
  return (
    <Card className="p-4 md:p-6">
      <h2 className="text-lg font-semibold text-[#1B1630] mb-4">Workload by BTC</h2>
      {sortedOwners.length === 0 ? (
        <div className="p-6 text-center text-[#6B647E]">No data</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="mh-workload-heatmap-table w-full table-fixed border-collapse">
            <thead>
              <tr>
                <th 
                  className="sticky left-0 z-10 bg-white border-b border-[#E3D7E8] px-3 py-2 text-left text-xs font-medium text-[#6B647E]"
                  style={{ width: '20%' }}
                >
                  BTC
                </th>
                {STAGE_ORDER.map((stage) => {
                  const [line1, line2] = UI_TWO_LINE[stage] || [stage, '']
                  return (
                    <th 
                      key={stage} 
                      className="border-b border-[#E3D7E8] px-3 py-2 text-center text-xs font-medium text-[#6B647E]"
                      style={{ width: '8.75%' }}
                    >
                      <div className="flex flex-col leading-tight">
                        <div>{line1}</div>
                        {line2 && <div>{line2}</div>}
                      </div>
                      <div className="text-xs text-[#6B647E] font-normal mt-1">
                        {totals.get(stage) || 0}
                      </div>
                    </th>
                  )
                })}
                <th 
                  className="border-b border-[#E3D7E8] px-3 py-2 text-center text-xs font-medium text-[#6B647E]"
                  style={{ width: '10%' }}
                >
                  Active
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedOwners.map(([owner, { stageCounts, totals }]) => (
                <tr key={owner} className="border-b border-[#E3D7E8] hover:bg-[#E01E73]/5">
                  <td 
                    className="sticky left-0 z-10 bg-white border-r border-[#E3D7E8] px-3 py-2 text-sm text-[#1B1630]"
                    style={{ width: '20%' }}
                  >
                    <span className="truncate block">{owner}</span>
                  </td>
                  {STAGE_ORDER.map((stage) => {
                    const count = stageCounts.get(stage) || 0
                    const color = getColorForCount(count, maxCount)
                    return (
                      <td
                        key={stage}
                        className={`px-3 py-2 text-center text-sm font-medium cursor-pointer hover:ring-2 hover:ring-[#E01E73] transition ${color}`}
                        style={{ width: '8.75%' }}
                        onClick={() => navigate(`/migrations?owner=${encodeURIComponent(owner)}&stage=${encodeURIComponent(stage)}`)}
                        title={`${owner} • ${stage} — ${count} migrations`}
                      >
                        {count > 0 ? count : '—'}
                      </td>
                    )
                  })}
                  <td 
                    className="px-3 py-2 text-center text-sm font-medium text-[#1B1630] border-l border-[#E3D7E8]"
                    style={{ width: '10%' }}
                  >
                    {totals.active}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-[#E3D7E8]">
        <div className="flex items-center gap-2 text-xs text-[#6B647E]">
          <span>Legend:</span>
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const intensity = i / 5
              const max = maxCount || 1
              const count = Math.round(max * intensity)
              const color = getColorForCount(count, maxCount || 1)
              return (
                <div key={i} className="flex items-center gap-1">
                  <div className={`w-4 h-4 rounded ${color} border border-[#E3D7E8]`} />
                  <span>{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}

