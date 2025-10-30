import React, { useEffect } from 'react'
import Card from '../components/Card.jsx'

export default function Remapping() {
  useEffect(() => console.log('[MH-UI] Mount Remapping'), [])
  const rows = [
    { id: 1, Field: 'CandidateName', MappedTo: 'full_name' },
    { id: 2, Field: 'Email', MappedTo: 'email' },
    { id: 3, Field: 'Phone', MappedTo: 'phone' },
  ]
  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium text-slate-600 mb-3">Remapping (scaffold)</h3>
      <table className="min-w-full">
        <thead>
          <tr className="text-left text-sm text-slate-600">
            <th className="px-3 py-2">Field</th>
            <th className="px-3 py-2">Mapped To</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-3 py-2 text-sm">{r.Field}</td>
              <td className="px-3 py-2 text-sm">{r.MappedTo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}


