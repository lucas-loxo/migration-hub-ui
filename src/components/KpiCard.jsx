import React from 'react'

export default function KpiCard({ title, value, onClick, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left w-full bg-white rounded-xl shadow-sm p-4 md:p-6 hover:ring-2 hover:ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
    {
      ...(onClick ? {} : { disabled: true })
    }
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-gray-900 font-medium">{title}</div>
        {icon ? <span className="text-slate-500">{icon}</span> : null}
      </div>
      <div className="text-2xl font-semibold text-gray-900">{value ?? '—'}</div>
    </button>
  )
}


