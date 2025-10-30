import React from 'react'

const CANONICAL_STAGES = ['Discovery','Data Export','Mapping','Import','Validation','Go-Live']

export default function StageTimeline({ counts = {}, stages = CANONICAL_STAGES }) {
  const hasAny = stages.some((s) => (counts[s] || 0) > 0)
  if (!hasAny) {
    return <div className="text-slate-500 text-sm">No migrations found for your stages.</div>
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {stages.map((s, i) => (
        <React.Fragment key={s}>
          <div className="rounded-xl border border-slate-200 bg-white hover:shadow-md shadow-sm px-4 py-3">
            <div className="text-xs text-slate-500">{s}</div>
            <div className="text-2xl font-semibold text-slate-900">{counts[s] || 0}</div>
          </div>
          {i < stages.length - 1 && (
            <span className="hidden sm:inline text-slate-400">→</span>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}


