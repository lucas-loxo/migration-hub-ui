import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import Card from '../components/Card.jsx'
import KPI from '../components/KPI.jsx'
import Toast from '../components/Toast.jsx'
import { getMigrations, updateMigrationStatus } from '../lib/api.js'

export default function Details() {
  const { migrationId } = useParams()
  const [items, setItems] = useState([])
  const [toast, setToast] = useState({ message: '', type: 'success' })

  useEffect(() => {
    console.log('[MH-UI] Mount Details')
    ;(async () => {
      try {
        const data = await getMigrations()
        setItems(data)
      } catch (e) {
        console.error(e)
      }
    })()
  }, [])

  const record = useMemo(() => items.find((m) => String(m.MigrationID) === String(migrationId)), [items, migrationId])

  if (!record) {
    return <div className="text-slate-500">Loading migration {migrationId}...</div>
  }

  async function onUpdateStage(e) {
    const value = e.target.value
    try {
      const res = await updateMigrationStatus(record.MigrationID, value)
      if (res.ok) setToast({ message: 'Stage updated', type: 'success' })
      else setToast({ message: 'Update failed', type: 'error' })
    } catch (err) {
      setToast({ message: 'Update failed', type: 'error' })
    }
  }

  return (
    <div className="space-y-6">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '' })} />
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-slate-900">{record.Customer}</h2>
        <div className="text-sm text-slate-500">MigrationID: {record.MigrationID}</div>
        <div className="text-sm text-slate-500">Current Stage: {record.Stage}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-4 lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPI label="Days" value={record.Days ?? '-'} />
            <KPI label="Status" value={record.Status} />
            <KPI label="Previous ATS" value={record.PreviousATS} />
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-slate-600 mb-2">Mini timeline</div>
          <ol className="text-sm text-slate-600 space-y-2">
            <li>🔍 Discovery</li>
            <li>📤 Data Export</li>
            <li>🧭 Mapping</li>
            <li>📥 Import</li>
            <li>✅ Validation</li>
            <li>🚀 Go-Live</li>
          </ol>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600">Update Stage</label>
          <select className="rounded-xl border-slate-300 text-sm" onChange={onUpdateStage} defaultValue="" >
            <option value="" disabled>
              Select stage
            </option>
            {['Discovery','Data Export','Mapping','Import','Validation','Go-Live'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </Card>
    </div>
  )
}


