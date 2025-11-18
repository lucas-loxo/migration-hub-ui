import React from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.tsx'
import { SCHEMA_VERSION } from '../config/constants.ts'

export default function DebugOverlay({ info }) {
  const loc = useLocation()
  const q = new URLSearchParams(loc.search)
  const show = q.get('debug') === '1'
  const { loading, authed } = useAuth()
  if (!show) return null
  return (
    <div className="fixed bottom-2 right-2 z-50 text-xs bg-black/80 text-white rounded-md px-2 py-1">
      <div>auth.loading: {String(loading)}</div>
      <div>hasUser: {String(authed)}</div>
      {info?.sourceTabName && <div>sourceTabName: {info.sourceTabName}</div>}
      {info?.schemaVersionFound && <div>schemaVersionFound: {String(info.schemaVersionFound)}</div>}
      <div>SCHEMA_VERSION: {SCHEMA_VERSION}</div>
    </div>
  )
}


