import React from 'react'
import { useLocation } from 'react-router-dom'
import { useSchemaGuard } from '../state/useSchemaGuard.tsx'
import { hasSheetsId } from '../config/env.ts'
import DebugOverlay from './DebugOverlay.jsx'

function useQuery() {
  const loc = useLocation()
  return new URLSearchParams(loc.search)
}

export default function SchemaGate({ children }) {
  const q = useQuery()
  const safe = q.get('safe') === '1'
  if (safe) {
    return children
  }
  if (!hasSheetsId()) {
    return (
      <div className="m-4 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700">
        Sheets ID not configured. Set VITE_SHEETS_ID.
      </div>
    )
  }
  const { loading, ok, errors, sourceTabName, schemaVersionFound } = useSchemaGuard()
  if (loading) return <div className="p-6 text-center text-slate-500">Loading…</div>
  if (!ok) {
    return (
      <div className="m-4 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700">
        <div className="font-medium mb-2">Schema check failed</div>
        <ul className="list-disc pl-5 text-sm">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
        <div className="text-sm mt-2">Fix sheets to match expected schema; refresh.</div>
      </div>
    )
  }
  return (
    <>
      <DebugOverlay info={{ sourceTabName, schemaVersionFound }} />
      {children}
    </>
  )
}


