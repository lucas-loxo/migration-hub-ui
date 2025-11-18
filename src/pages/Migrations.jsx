import React, { useEffect, useState } from 'react'
import { getMigrations } from '../lib/sheets.ts'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.tsx'

export default function Migrations() {
  const navigate = useNavigate()
  const { authed, requestSignIn } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    
    ;(async () => {
      try {
        console.info('[MH-UI] Migrations Page loading…')
        const data = await getMigrations()
        if (!cancelled) {
          console.info('[MH-UI] Migrations Page loaded, rows:', data.length)
          // Map getMigrations format to table format
          // Migrations are uniquely identified by MigrationID (M-XXXX). CustomerID is not unique because a customer may have multiple migrations (e.g., second passes).
          const mapped = (data || []).map((r) => ({
            migration_id: r.MigrationID || '',
            customer_id: r.CustomerID || '',
            customer_name: r.Customer || '',
            stage: r.Stage || '',
            days_in_stage: r.DaysInStage || '',
            status: r.Status || '',
            owner_email: r.OwnerEmail || '',
          }))
          setRows(mapped)
        }
      } catch (err) {
        console.error('[MH-UI] Migrations load error', err)
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    
    return () => {
      cancelled = true
    }
  }, [])

  if (!authed) {
    return (
      <div className="p-6 text-center">
        <div className="mb-2 text-slate-600">Sign in to load data</div>
        <button onClick={requestSignIn} className="rounded-xl bg-slate-900 text-white px-3 py-2">Sign in with Google</button>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Migrations table */}
      <div className="mt-6 overflow-x-auto bg-white rounded-xl border min-h-[120px]">
        {loading ? (
          <div className="p-4 text-sm text-slate-500">Loading migrations…</div>
        ) : !rows.length ? (
          <div className="p-4 text-sm text-slate-500">
            No migrations found in MH_View_Migrations.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Migration ID</th>
                <th className="px-4 py-2 text-left">Customer ID</th>
                <th className="px-4 py-2 text-left">Customer Name</th>
                <th className="px-4 py-2 text-left">Stage</th>
                <th className="px-4 py-2 text-left">Days in Stage</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Owner Email</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.migration_id || idx}
                  className="border-t hover:bg-slate-50 cursor-pointer"
                  onClick={() => {
                    if (row.migration_id) navigate(`/migrations/${row.migration_id}`)
                  }}
                >
                  <td className="px-4 py-2">{row.migration_id}</td>
                  <td className="px-4 py-2">{row.customer_id}</td>
                  <td className="px-4 py-2">{row.customer_name}</td>
                  <td className="px-4 py-2">{row.stage}</td>
                  <td className="px-4 py-2">{row.days_in_stage}</td>
                  <td className="px-4 py-2">{row.status}</td>
                  <td className="px-4 py-2">{row.owner_email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}


