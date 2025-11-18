import React from 'react'

type BtcFilterProps = {
  value: string
  options: string[]
  onChange: (value: string) => void
  loading?: boolean
}

export default function BtcFilter({ value, options, onChange, loading }: BtcFilterProps) {
  if (loading) {
    return <div className="h-8 w-32 bg-[#E3D7E8] rounded animate-pulse" />
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="btc-filter" className="text-sm text-[#6B647E] whitespace-nowrap">
        BTC:
      </label>
      <select
        id="btc-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="rounded-md border border-[#E3D7E8] text-sm px-3 py-1.5 bg-white text-[#1B1630] focus:outline-none focus:ring-2 focus:ring-[#E01E73] focus:border-[#E01E73]"
      >
        <option value="all">All BTCs</option>
        {options.map((btc) => (
          <option key={btc} value={btc.toLowerCase()}>
            {btc}
          </option>
        ))}
      </select>
    </div>
  )
}

