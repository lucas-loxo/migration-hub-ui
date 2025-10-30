import React, { useEffect, useRef, useState } from 'react'
import Card from '../components/Card.jsx'
import KpiCard from '../components/KpiCard.jsx'
import { getKpis, getStagePerformance, getTeamWorkload, getRecentActivities } from '../lib/api.js'
import { useNavigate } from 'react-router-dom'
import Chart from 'chart.js/auto'

export default function Reports() {
  const navigate = useNavigate()
  const [kpis, setKpis] = useState(null)
  const [stagePerf, setStagePerf] = useState([])
  const [workload, setWorkload] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const barRef = useRef(null)
  const pieRef = useRef(null)
  const barInst = useRef(null)
  const pieInst = useRef(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [k, s, w, a] = await Promise.all([
          getKpis(),
          getStagePerformance(),
          getTeamWorkload(),
          getRecentActivities(6),
        ])
        if (!mounted) return
        setKpis(k)
        setStagePerf(s)
        setWorkload(w)
        setActivities(a)
      } catch (e) {
        setError('Failed to load reports.')
      } finally {
        setLoading(false)
      }
    })()
    return () => {
      mounted = false
      if (barInst.current) barInst.current.destroy()
      if (pieInst.current) pieInst.current.destroy()
    }
  }, [])

  useEffect(() => {
    if (!barRef.current) return
    if (barInst.current) barInst.current.destroy()
    const labels = stagePerf.map((s) => s.Stage || s.stage)
    const data = stagePerf.map((s) => s.Count ?? s.count)
    barInst.current = new Chart(barRef.current, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Migrations by Stage', data, backgroundColor: 'rgba(15,23,42,0.8)' }] },
      options: { responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.raw}` } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    })
  }, [stagePerf])

  useEffect(() => {
    if (!pieRef.current) return
    if (pieInst.current) pieInst.current.destroy()
    const labels = workload.map((w) => w.team)
    const data = workload.map((w) => w.pct)
    pieInst.current = new Chart(pieRef.current, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: ['#0f172a','#334155','#64748b','#94a3b8'] }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    })
  }, [workload])

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">Migration Management</h2>

      {/* KPI row */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-white rounded-xl shadow-sm p-4 md:p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
              <div className="h-6 bg-slate-200 rounded w-1/4" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Active Migrations" value={kpis?.activeMigrations} />
          <KpiCard title="Behind" value={kpis?.behind} onClick={() => navigate('/migrations?filter=behind')} icon="⬇️" />
          <KpiCard title="Due Today" value={kpis?.dueToday} onClick={() => navigate('/migrations?filter=dueToday')} icon="📅" />
          <KpiCard title="Average Days in Stage" value={kpis?.avgDaysInStage} icon="▮▮" />
        </div>
      )}

      {error && (
        <div className="text-rose-600 text-sm">{error} <button onClick={() => window.location.reload()} className="underline">Retry</button></div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-gray-900 font-medium">Migrations by Stage</div>
            <button onClick={() => navigate('/migrations')} className="text-sm text-slate-700 hover:underline">View Details</button>
          </div>
          <div className="h-[260px]">
            <canvas ref={barRef} height="240" />
          </div>
        </Card>
        <Card className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <div className="text-gray-900 font-medium mb-3">Team Workload</div>
          <div className="h-[260px]">
            <canvas ref={pieRef} height="240" />
          </div>
        </Card>
      </div>

      {/* Recent Activities */}
      <Card className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-gray-900 font-medium">Recent Activities</div>
          <button onClick={() => navigate('/migrations')} className="text-sm text-slate-700 hover:underline">View Details</button>
        </div>
        {activities.length ? (
          <ul className="text-sm">
            {activities.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-1">
                <span>• {a.text}</span>
                <span className="text-xs text-gray-500">{a.ts}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-gray-500">No recent activity</div>
        )}
      </Card>
    </div>
  )
}


