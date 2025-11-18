import React, { useMemo } from 'react'
import Card from '../Card.jsx'
import DataTable from '../DataTable.jsx'
import type { MigrationRow } from '../../lib/schema'
import { groupByBTC } from '../../lib/reportsMath'

type WorkloadByBtcTableProps = {
  rows: MigrationRow[]
  getSLA: (stage: string) => number
  onRowClick?: (btc: string) => void
  loading?: boolean
}

export default function WorkloadByBtcTable({
  rows,
  getSLA,
  onRowClick,
  loading,
}: WorkloadByBtcTableProps) {
  const workload = useMemo(() => {
    if (loading || rows.length === 0) return []
    return groupByBTC(rows, getSLA)
  }, [rows, getSLA, loading])

  const columns = [
    {
      id: 'BTC',
      header: 'BTC',
      sortable: true,
      cell: (v: string) => <span className="text-slate-900">{v}</span>,
    },
    {
      id: 'Active',
      header: 'Active',
      sortable: true,
      cell: (v: number) => <span className="text-right block">{v}</span>,
    },
    {
      id: 'Behind',
      header: 'Behind',
      sortable: true,
      cell: (v: number) => <span className="text-right block">{v}</span>,
    },
    {
      id: 'BehindPct',
      header: 'Behind %',
      sortable: true,
      cell: (v: number) => <span className="text-right block">{v.toFixed(1)}%</span>,
    },
    {
      id: 'AvgDaysInStage',
      header: 'Avg Days in Stage',
      sortable: true,
      cell: (v: number) => <span className="text-right block">{v.toFixed(1)}</span>,
    },
    {
      id: 'DueSoon',
      header: 'Due Soon ≤7d',
      sortable: true,
      cell: (v: number) => <span className="text-right block">{v}</span>,
    },
  ]

  if (loading) {
    return (
      <Card className="p-4 md:p-6">
        <div className="h-6 bg-slate-200 rounded w-1/4 mb-4 animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-200 rounded animate-pulse" />
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 md:p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Workload by BTC</h2>
      {workload.length === 0 ? (
        <div className="p-6 text-center text-slate-500">No data</div>
      ) : (
        <DataTable
          columns={columns as any}
          data={workload as any}
          defaultSort={{ id: 'BehindPct', dir: 'desc' }}
          onRowClick={onRowClick ? (row: any) => onRowClick(row.BTC) : undefined}
          rowAction={undefined}
          stickyHeader
          zebra
          rowKey={(r: any) => r.BTC || Math.random().toString(36).slice(2)}
        />
      )}
    </Card>
  )
}

