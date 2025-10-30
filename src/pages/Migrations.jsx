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
    console.log('[MH-UI] Mount Migrations')
    ;(async () => {
      try {
        const data = await getMigrations()
        setItems(data)
      } catch (e) {
        console.error(e)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = items.map((r) => ({ ...r, id: r.MigrationID }))
    const searched = needle
      ? list.filter(
          (r) =>
            r.Customer.toLowerCase().includes(needle) ||
            String(r.MigrationID).toLowerCase().includes(needle),
        )
      : list
    // default sort by Customer asc
    return [...searched].sort((a, b) => a.Customer.localeCompare(b.Customer))
  }, [items, q])

  const columns = [
    { id: 'MigrationID', header: 'MigrationID', sortable: true },
    { id: 'Customer', header: 'Customer', sortable: true },
    { id: 'Stage', header: 'Stage', sortable: true },
    { id: 'Status', header: 'Status', sortable: true },
    { id: 'Owner', header: 'Owner', sortable: true },
    {
      id: 'GitHubLink',
      header: 'GitHub',
      sortable: false,
      cell: (v) => (
        <a className="text-sky-600 underline" href={v} target="_blank" rel="noreferrer">
          Link
        </a>
      ),
    },
    { id: 'Days', header: 'Days', sortable: true },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by Customer or MigrationID"
          className="w-full md:w-80 rounded-xl border-slate-300 text-sm"
        />
      </div>
      <Card className="p-4">
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(row) => navigate(`/details/${row.MigrationID}`)}
        />
      </Card>
    </div>
  )
}


