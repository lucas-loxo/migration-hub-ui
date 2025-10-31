import React from 'react'
import { useAuth } from '../state/AuthContext.tsx'

export default function NavBar({ title, onToggleSidebar }) {
  const { authed, requestSignIn, requestSignOut } = useAuth()
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Toggle sidebar"
          onClick={onToggleSidebar}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          ☰
        </button>
        <h1 className="text-lg sm:text-xl font-semibold text-slate-900">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs rounded-full px-2 py-1 ${authed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
          Google: {authed ? 'Connected' : 'Disconnected'}
        </span>
        {authed ? (
          <button onClick={requestSignOut} className="text-sm rounded-lg border border-slate-200 px-2 py-1">Sign out</button>
        ) : (
          <button onClick={requestSignIn} className="text-sm rounded-lg bg-slate-900 text-white px-2 py-1">Sign in</button>
        )}
      </div>
    </header>
  )
}


