import React, { useMemo, useState } from 'react'

export default function DataTable({ columns, data, defaultSort, onRowClick, rowAction, stickyHeader = true, zebra = true }) {
  const [sort, setSort] = useState(defaultSort || null)

  const sortedData = useMemo(() => {
    if (!sort) return data
    const { id, dir } = sort
    return [...data].sort((a, b) => {
      const va = a[id]
      const vb = b[id]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return dir === 'asc' ? va - vb : vb - va
      return dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
    })
  }, [data, sort])

  const setSortBy = (id, sortable) => {
    if (!sortable) return
    setSort((prev) => {
      if (!prev || prev.id !== id) return { id, dir: 'asc' }
      return prev.dir === 'asc' ? { id, dir: 'desc' } : null
    })
  }

  return (
    <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white">
      <table className="min-w-full">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                onClick={() => setSortBy(col.id, col.sortable)}
                className={`text-left text-slate-600 text-sm font-medium px-4 py-3 ${stickyHeader ? 'sticky top-0 bg-slate-50 z-10' : ''} ${
                  col.sortable ? 'cursor-pointer select-none' : ''
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>{col.header}</span>
                  {sort?.id === col.id ? (
                    <span className="text-xs">{sort.dir === 'asc' ? '▲' : '▼'}</span>
                  ) : null}
                </div>
              </th>
            ))}
            {rowAction ? <th className="px-4 py-3" /> : null}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, idx) => (
            <tr
              key={row.id || row.MigrationID}
              onClick={() => onRowClick && onRowClick(row)}
              className={`border-t border-slate-100 ${zebra ? (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30') : ''} hover:bg-slate-50 ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
            >
              {columns.map((col) => (
                <td key={col.id} className="px-4 py-3 text-sm text-slate-800">
                  {col.cell ? col.cell(row[col.id], row) : row[col.id]}
                </td>
              ))}
              {rowAction ? (
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      rowAction.onClick(row)
                    }}
                    className="text-sm rounded-lg bg-slate-900 text-white px-3 py-1.5 shadow hover:shadow-md"
                  >
                    {rowAction.label}
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (rowAction ? 1 : 0)} className="px-4 py-6 text-center text-slate-500">
                No data
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}


