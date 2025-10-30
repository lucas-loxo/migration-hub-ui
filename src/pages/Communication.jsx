import { useEffect } from 'react'
import Card from '../components/Card.jsx'

export default function Communication() {
  useEffect(() => console.log('[MH-UI] Mount Communication'), [])
  const rows = [
    { id: 1, Date: '2025-10-01', Channel: 'Email', Notes: 'Intro message sent' },
    { id: 2, Date: '2025-10-03', Channel: 'Call', Notes: 'Kickoff scheduled' },
  ]
  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium text-slate-600 mb-3">Communication Log (scaffold)</h3>
      <table className="min-w-full">
        <thead>
          <tr className="text-left text-sm text-slate-600">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Channel</th>
            <th className="px-3 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-3 py-2 text-sm">{r.Date}</td>
              <td className="px-3 py-2 text-sm">{r.Channel}</td>
              <td className="px-3 py-2 text-sm">{r.Notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}


