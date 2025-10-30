import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Card from '../components/Card.jsx'
import Modal from '../components/Modal.jsx'
import Drawer from '../components/Drawer.jsx'
import { getMigrationById, getRemappingItems } from '../lib/api.js'
import Chart from 'chart.js/auto'

export default function Details() {
  const { migrationId } = useParams()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draftOpen, setDraftOpen] = useState(false)
  const [remapOpen, setRemapOpen] = useState(false)
  const [remap, setRemap] = useState([])
  const chartRef = useRef(null)
  const chartInst = useRef(null)

  useEffect(() => {
    console.log('[MH-UI] Details mounted', migrationId)
    ;(async () => {
      try {
        const data = await getMigrationById(migrationId)
        setRecord(data)
      } catch (e) {
        setError('Failed to load.');
      } finally {
        setLoading(false)
      }
    })()
    return () => {
      if (chartInst.current) chartInst.current.destroy()
    }
  }, [migrationId])

  useEffect(() => {
    if (!record || !record.stageCompletions) return
    if (!chartRef.current) return
    if (chartInst.current) chartInst.current.destroy()
    const labels = record.stageCompletions.map((d) => d.date)
    const data = record.stageCompletions.map((d) => d.count)
    chartInst.current = new Chart(chartRef.current, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Completions', data, backgroundColor: 'rgba(15,23,42,0.8)' }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    })
  }, [record])

  const draftSubject = useMemo(() => `Status Update: ${record?.customer} (${record?.stage})`, [record])
  const draftBody = useMemo(() => `Hi ${record?.owner || 'team'},\n\nQuick update on ${record?.customer}: we are currently at stage ${record?.stage}.\n\nThanks!`, [record])

  async function openRemapping() {
    try {
      const data = await getRemappingItems(migrationId)
      setRemap(data)
      setRemapOpen(true)
    } catch (e) {
      setRemap([])
      setRemapOpen(true)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse h-6 bg-slate-200 rounded w-1/3" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="bg-white rounded-xl shadow-sm p-4 md:p-6">
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 rounded w-1/2" />
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-4 bg-slate-200 rounded w-2/3" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-red-600">{error}</div>
        <button onClick={() => { setLoading(true); setError(''); }} className="rounded-xl border px-3 py-1.5">Retry</button>
      </div>
    )
  }

  if (!record) return null

  const statusPill = (status) => {
    const map = {
      'Open': 'bg-emerald-100 text-emerald-700',
      'Ready': 'bg-sky-100 text-sky-700',
      'In Progress': 'bg-amber-100 text-amber-700',
      '—': 'bg-slate-100 text-slate-600',
    }
    const cls = map[status] || map['—']
    return <span className={`rounded-full px-2.5 py-0.5 text-xs ${cls}`}>{status || '—'}</span>
  }

  const history = record.stageHistory || []
  const currentStage = record.stage

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-slate-900">{record.customer}</h2>
          <div className="text-sm text-slate-500">Migration ID: {record.migrationId}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDraftOpen(true)} className="rounded-xl bg-slate-900 text-white px-3 py-2 shadow hover:shadow-md">Create Draft Email</button>
          <button onClick={() => console.log('markIssueOrComplete', record.migrationId)} className="rounded-xl border border-slate-200 px-3 py-2">Mark Comp/Issue</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <div className="text-gray-900 font-medium mb-3">Current Stage: {currentStage}</div>
            <ol className="relative border-l border-slate-200 pl-4 space-y-4">
              {history.map((h, idx) => (
                <li key={idx} className="ml-2">
                  <div className={`w-2 h-2 rounded-full absolute -left-1.5 mt-1.5 ${idx < history.length - 1 ? 'bg-emerald-500' : 'bg-sky-500'}`} />
                  <div className="text-sm text-gray-900">{h.stage}</div>
                  <div className="text-xs text-gray-500">{h.date}</div>
                </li>
              ))}
            </ol>
            <div className="mt-4">
              <span className="rounded-full px-2.5 py-0.5 text-xs bg-slate-100 text-slate-700">📅 {record.daysInStage} Days in Stage</span>
            </div>
          </Card>

          <Card className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <div className="text-gray-900 font-medium mb-2">Notes</div>
            <ul className="list-disc pl-5 text-sm text-gray-900">
              {(record.notes && record.notes.length) ? record.notes.map((n, i) => <li key={i}>{n}</li>) : <li className="text-gray-500">No notes yet</li>}
            </ul>
          </Card>

          <Card id="linked-docs" className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-900 font-medium">Linked Documents</div>
              <button onClick={openRemapping} className="text-sm text-sky-700 hover:underline">Open Remapping</button>
            </div>
            <ul className="text-sm">
              {(record.documents && record.documents.length) ? (
                record.documents.map((d, i) => (
                  <li key={i} className="flex items-center gap-2 py-1">
                    <span>📄</span>
                    {d.url ? <a className="text-sky-700 hover:underline" href={d.url} target="_blank" rel="noreferrer">{d.title}</a> : <span>{d.title}</span>}
                  </li>
                ))
              ) : (
                <li className="text-gray-500">No documents</li>
              )}
            </ul>
            <div className="text-right mt-2">
              <a href="#linked-docs" className="text-sm text-sky-700 hover:underline">View Details</a>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <div className="text-gray-900 font-medium mb-3">Key Info</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 text-sm">
              <div className="text-gray-500">Customer</div><div className="text-gray-900">{record.customer}</div>
              <div className="text-gray-500">Owner</div><div className="text-gray-900">{record.owner}</div>
              <div className="text-gray-500">Start Date</div><div className="text-gray-900">{record.startDate || '—'}</div>
              <div className="text-gray-500">Estimated Go-Live</div><div className="text-gray-900">{record.estimatedGoLive || '—'}</div>
              <div className="text-gray-500">GitHub Status</div><div className="text-gray-900">{statusPill(record.githubStatus || '—')}</div>
            </div>
          </Card>

          <Card className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <div className="text-gray-900 font-medium mb-3">Stage Completion Dates</div>
            {record.stageCompletions && record.stageCompletions.length ? (
              <canvas ref={chartRef} height="120" />
            ) : (
              <div className="text-sm text-gray-500">No data</div>
            )}
          </Card>
        </div>
      </div>

      <Modal open={draftOpen} onClose={() => setDraftOpen(false)} title="Draft Email Preview">
        <div className="space-y-2 text-sm">
          <div><span className="font-medium">Subject:</span> {draftSubject}</div>
          <div>
            <div className="font-medium">Body:</div>
            <pre className="whitespace-pre-wrap rounded-md border border-slate-200 p-3">{draftBody}</pre>
          </div>
        </div>
      </Modal>

      <Drawer open={remapOpen} onClose={() => setRemapOpen(false)} title="Remapping">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left text-slate-600">
                <th className="px-3 py-2">Field</th>
                <th className="px-3 py-2">From</th>
                <th className="px-3 py-2">To</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {remap.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{r.field}</td>
                  <td className="px-3 py-2">{r.from}</td>
                  <td className="px-3 py-2">{r.to}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{r.createdAt}</td>
                </tr>
              ))}
              {remap.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-gray-500" colSpan="5">No items</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Drawer>
    </div>
  )
}


