import { useEffect, useMemo, useRef, useState } from 'react'
import Card from '../components/Card.jsx'
import DataTable from '../components/DataTable.jsx'
import { getMigrations, getStagePerformance } from '../lib/api.js'
import { useNavigate } from 'react-router-dom'
import Chart from 'chart.js/auto'

export default function DashboardOwner() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [stageFilter, setStageFilter] = useState([])
  const [stagePerf, setStagePerf] = useState([])
  const chartRef = useRef(null)
  const chartInstance = useRef(null)

  useEffect(() => {
    console.log('[MH-UI] Mount DashboardOwner')
    let active = true
    ;(async () => {
      try {
        const [migs, perf] = await Promise.all([getMigrations(), getStagePerformance()])
        if (!active) return
        // Fake "to-do" subset: behind status or due soon (Days <= 3)
        const todo = migs.filter((m) => m.Status === 'Behind' || (m.Days != null && m.Days <= 3))
        setItems(todo)
        setStagePerf(perf)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
    return () => {
      active = false
      if (chartInstance.current) {
        chartInstance.current.destroy()
      }
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    if (chartInstance.current) chartInstance.current.destroy()
    const labels = stagePerf.map((s) => s.Stage)
    const data = stagePerf.map((s) => s.Count)
    chartInstance.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'By Stage',
            data,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    })
  }, [stagePerf])

  const allStages = useMemo(
    () => Array.from(new Set(items.map((i) => i.Stage).filter(Boolean))),
    [items],
  )

  const filtered = useMemo(() => {
    if (!stageFilter.length) return items
    return items.filter((i) => stageFilter.includes(i.Stage))
  }, [items, stageFilter])

  const columns = [
    { id: 'Customer', header: 'Customer', sortable: true },
    { id: 'Stage', header: 'Stage', sortable: true },
    { id: 'Status', header: 'Status', sortable: true },
    { id: 'Days', header: 'Due', sortable: true, cell: (v) => (v != null ? `${v}d` : '-') },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">To-do today</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Stage</label>
          <select
            multiple
            value={stageFilter}
            onChange={(e) =>
              setStageFilter(Array.from(e.target.selectedOptions).map((o) => o.value))
            }
            className="min-w-40 rounded-xl border-slate-300 text-sm"
          >
            {allStages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
                <div className="h-4 bg-slate-200 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No companies to contact today</div>
        ) : (
          <div className="p-4">
            <DataTable
              columns={columns}
              data={filtered.map((r) => ({ ...r, id: r.MigrationID }))}
              onRowClick={(row) => navigate(`/details/${row.MigrationID}`)}
              rowAction={{ label: 'Draft email', onClick: (row) => console.log('[MH-UI] Draft email for', row) }}
            />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-slate-600 mb-2">Stage timeline</h3>
          <div className="relative">
            <canvas ref={chartRef} height="140" />
          </div>
        </Card>
      </div>

      <button
        type="button"
        onClick={() => console.log('[MH-UI] New Migration')}
        className="fixed right-6 top-20 z-10 rounded-full bg-slate-900 text-white shadow-lg hover:shadow-xl px-4 py-2"
      >
        + New Migration
      </button>
    </div>
  )
}


