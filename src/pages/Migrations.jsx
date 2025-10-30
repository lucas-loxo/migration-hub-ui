import React, { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card.jsx'
import DataTable from '../components/DataTable.jsx'
import { getMigrations } from '../lib/api.js'
import { useNavigate } from 'react-router-dom'

export default function Migrations() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')

  useEffect(() => {
    console.log('[MH-UI] All Migrations loaded')
    ;(async () => {
      try {
        const data = await getMigrations()
        setItems(data)
      } catch (e) {
        console.error(e)
      }
    })()
  }, [])

  const normalized = useMemo(() => {
    return items.map((m) => ({
      id: m.MigrationID || m.migrationId || m.CustomerID || m.customerId || Math.random().toString(36).slice(2),
      migrationId: m.migrationId ?? m.MigrationID ?? '—',
      customerId: m.customerId ?? m.CustomerID ?? '—',
      customer: m.customer ?? m.Customer ?? '—',
      stage: m.stage ?? m.Stage ?? '—',
      daysInStage: m.daysInStage ?? m.Days ?? '—',
      status: m.status ?? m.Status ?? '—',
      owner: m.owner ?? m.Owner ?? '—',
      githubStatus: m.githubStatus ?? '—',
      _raw: m,
    }))
  }, [items])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = normalized
    const searched = needle
      ? list.filter(
          (r) =>
            String(r.customer).toLowerCase().includes(needle) ||
            String(r.migrationId).toLowerCase().includes(needle),
        )
      : list
    // default sort by Customer asc
    return [...searched].sort((a, b) => String(a.customer).localeCompare(String(b.customer)))
  }, [normalized, q])

  const columns = [
    { id: 'migrationId', header: 'Migration ID', sortable: true, cell: (v, row) => (
      <a className="text-sky-700 hover:underline" href={`#/details/${row.migrationId}`} onClick={(e) => { e.preventDefault(); navigate(`/details/${row.migrationId}`) }}>{v}</a>
    ) },
    { id: 'customerId', header: 'Customer ID', sortable: true },
    { id: 'customer', header: 'Customer', sortable: true, cell: (v, row) => (
      <a className="text-sky-700 hover:underline" href={`#/details/${row.migrationId}`} onClick={(e) => { e.preventDefault(); navigate(`/details/${row.migrationId}`) }}>{v}</a>
    ) },
    { id: 'stage', header: 'Stage', sortable: true },
    { id: 'daysInStage', header: 'Days in Stage', sortable: true },
    { id: 'status', header: 'Status', sortable: true },
    { id: 'owner', header: 'Owner', sortable: true },
    { id: 'githubStatus', header: 'GitHub Status', sortable: false },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by Customer or Migration ID"
          className="w-full md:w-96 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800 placeholder:text-gray-400"
        />
      </div>
      <Card className="p-4">
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(row) => navigate(`/details/${row.migrationId || row._raw?.MigrationID}`)}
          stickyHeader
          zebra
        />
      </Card>
    </div>
  )
}


