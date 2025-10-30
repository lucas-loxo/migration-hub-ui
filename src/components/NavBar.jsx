import React from 'react'

export default function NavBar({ title, onToggleSidebar }) {
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
      <div />
    </header>
  )
}


