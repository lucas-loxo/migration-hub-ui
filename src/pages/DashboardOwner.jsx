import React, { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card.jsx'
import DataTable from '../components/DataTable.jsx'
import { getMigrations as getSheetMigrations } from '../lib/sheets.ts'
import { useNavigate } from 'react-router-dom'
import { computeNextUp } from '../lib/utils/nextUp.js'
import StageTimeline from '../components/StageTimeline.jsx'
import NewMigrationModal from '../components/NewMigrationModal.jsx'
import { useAuth } from '../state/AuthContext.tsx'

export default function DashboardOwner() {
  const navigate = useNavigate()
  const { authed, requestSignIn, userEmail } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [stagePerf, setStagePerf] = useState([])
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    console.log('[MH-UI] Owner Dashboard loaded')
    let active = true
    if (!authed) { setLoading(false); return }
    ;(async () => {
      try {
        const migs = await getSheetMigrations()
        if (!active) return
        let normalized = migs.map((m) => ({
          MigrationID: m.migrationId || m.MigrationID,
          CustomerID: m.customerId || m.CustomerID,
          Customer: m.customerName || m.Customer,
          Stage: m.stage || m.Stage,
          Status: m.status || m.Status || '—',
          Days: m.daysInStage ?? m.Days ?? '—',
          OwnerEmail: m.ownerEmail || m.OwnerEmail || '',
        }))
        if (userEmail) {
          const le = userEmail.toLowerCase()
          normalized = normalized.filter((r) => String(r.OwnerEmail || '').toLowerCase() === le)
        }
        setItems(normalized)
        const counts = normalized.reduce((acc, m) => { const s = (m.Stage || '').toString(); acc[s] = (acc[s] || 0) + 1; return acc }, {})
        setStagePerf(Object.entries(counts).map(([Stage, Count]) => ({ Stage, Count })))
      } catch (e) {
        console.error(e)
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [authed])

  const nextUp = useMemo(() => computeNextUp(items), [items])

  const columns = [
    { id: 'CustomerID', header: 'Customer ID', sortable: true, cell: (v, row) => (
      <a className="text-sky-700 hover:underline" href={`#/details/${row.MigrationID}`} onClick={(e) => { e.preventDefault(); navigate(`/details/${row.MigrationID}`) }}>{v}</a>
    ) },
    { id: 'Customer', header: 'Customer', sortable: true, cell: (v, row) => (
      <a className="text-sky-700 hover:underline" href={`#/details/${row.MigrationID}`} onClick={(e) => { e.preventDefault(); navigate(`/details/${row.MigrationID}`) }}>{v}</a>
    ) },
    { id: 'Stage', header: 'Stage', sortable: true },
    { id: 'Status', header: 'Status', sortable: true },
    { id: 'Days', header: 'Due', sortable: true, cell: (v) => (v != null ? `${v}d` : '-') },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Next Up</h2>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center rounded-xl bg-slate-900 text-white text-sm px-3 py-2 shadow hover:shadow-md transition"
        >
          + New Migration
        </button>
      </div>

      {error && <div className="text-rose-600 text-sm">{error}</div>}
      <Card>
        {!authed ? (
          <div className="p-6 text-center">
            <div className="mb-2 text-slate-600">Sign in to load data</div>
            <button onClick={requestSignIn} className="rounded-xl bg-slate-900 text-white px-3 py-2">Sign in with Google</button>
          </div>
        ) : loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
                <div className="h-4 bg-slate-200 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : nextUp.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No companies to contact today</div>
        ) : (
          <div className="p-4">
            <DataTable
              columns={columns}
              data={nextUp}
              onRowClick={(row) => navigate(`/details/${row.MigrationID}`)}
              rowAction={{ label: 'Draft email', onClick: (row) => console.log('[MH-UI] Draft email for', row) }}
              stickyHeader zebra
              rowKey={(r) => r.MigrationID}
            />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-slate-600 mb-3">Stage overview</h3>
          <StageTimeline counts={Object.fromEntries(stagePerf.map((s) => [s.Stage, s.Count]))} />
        </Card>
      </div>

      <NewMigrationModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}


