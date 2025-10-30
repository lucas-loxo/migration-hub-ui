export default function KPI({ label, value }) {
  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-slate-500 text-sm">{label}</div>
    </div>
  )
}


