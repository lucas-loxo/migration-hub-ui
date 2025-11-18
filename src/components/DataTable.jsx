import React, { useMemo, useState } from 'react'

export default function DataTable({ columns, data, defaultSort, onRowClick, rowAction, stickyHeader = true, zebra = true, rowKey }) {
  const [sort, setSort] = useState(defaultSort || null)

  const sortedData = useMemo(() => {
    if (!sort) return data
    const { id, dir } = sort
    const col = columns.find((c) => c.id === id)
    const sortVal = col && col.sortValue
    return [...data].sort((a, b) => {
      const va = sortVal ? sortVal(a) : a[id]
      const vb = sortVal ? sortVal(b) : b[id]
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
    <div className="overflow-hidden border border-[#E3D7E8] rounded-2xl bg-white">
      <table className="w-full table-fixed">
        <thead className="bg-[#E01E73]/5">
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                onClick={() => setSortBy(col.id, col.sortable)}
                style={col.width ? { width: col.width } : undefined}
                className={`text-left text-[#6B647E] text-sm font-medium px-4 py-3 border-b border-[#E3D7E8] ${stickyHeader ? 'sticky top-0 bg-[#E01E73]/5 z-10' : ''} ${
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
            {rowAction ? <th className="px-4 py-3 border-b border-[#E3D7E8]" /> : null}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, idx) => (
            <tr
              key={rowKey ? rowKey(row) : (row.id || row.MigrationID)}
              onClick={() => onRowClick && onRowClick(row)}
              className={`border-t border-[#E3D7E8] ${zebra ? (idx % 2 === 0 ? 'bg-white' : 'bg-[#FFF8FC]') : ''} hover:bg-[#E01E73]/5 ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
            >
              {columns.map((col) => (
                <td 
                  key={col.id} 
                  style={col.width ? { width: col.width } : undefined}
                  className="px-4 py-3 text-sm text-[#1B1630]"
                >
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
                    className="text-sm rounded-lg bg-[#E01E73] text-white px-3 py-1.5 shadow hover:bg-[#B0175B] hover:shadow-md"
                  >
                    {rowAction.label}
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (rowAction ? 1 : 0)} className="px-4 py-6 text-center text-[#6B647E]">
                No data
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}


