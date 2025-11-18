import React, { useMemo } from 'react'
import Card from '../Card.jsx'
import type { StagePerformanceRow } from '../../lib/schema'

type StagePerformanceSidebarProps = {
  stagePerf: StagePerformanceRow[]
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

// Use full stage names

export default function StagePerformanceSidebar({
  stagePerf,
  loading,
}: StagePerformanceSidebarProps) {
  const ordered = useMemo(() => {
    const byStage = new Map<string, StagePerformanceRow>()
    for (const row of stagePerf) {
      if (row.Stage) {
        byStage.set(row.Stage, row)
      }
    }

    const result: StagePerformanceRow[] = []
    for (const stage of STAGE_ORDER) {
      const row = byStage.get(stage)
      // Include row if it exists (even if AvgDaysInStage is 0 or null)
      if (row) {
        result.push(row)
      } else {
        console.warn(`[Reports] StagePerformance: missing ${stage}`)
      }
    }

    return result
  }, [stagePerf])

  if (loading) {
    return (
      <Card className="p-4 md:p-6">
        <div className="h-6 bg-[#E3D7E8] rounded w-1/2 mb-4 animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 bg-[#E3D7E8] rounded animate-pulse" />
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#1B1630]">Avg Days per Stage</h2>
      </div>
      {ordered.length === 0 ? (
        <div className="text-sm text-[#6B647E]">No data</div>
      ) : (
        <div className="space-y-3">
          {ordered.map((row) => {
            // AvgDaysInStage is already an integer from the sheet
            const avgDays = row.AvgDaysInStage != null ? Math.round(row.AvgDaysInStage) : 0
            return (
              <div
                key={row.Stage}
                className="flex items-center justify-between py-2 border-b border-[#E3D7E8] last:border-0"
              >
                <div className="text-sm text-[#1B1630] flex-1">{row.Stage}</div>
                <div className="text-sm font-medium text-[#1B1630] text-right">
                  {avgDays}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

