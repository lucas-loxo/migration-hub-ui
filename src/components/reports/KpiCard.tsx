import React from 'react'
import Card from '../Card.jsx'

type KpiCardProps = {
  label: string
  value: number | string | null | undefined
  loading?: boolean
}

export default function KpiCard({ label, value, loading }: KpiCardProps) {
  if (loading) {
    return (
      <Card className="p-4 md:p-6 animate-pulse">
        <div className="h-4 bg-[#E3D7E8] rounded w-1/3 mb-2" />
        <div className="h-8 bg-[#E3D7E8] rounded w-1/4 mb-1" />
      </Card>
    )
  }

  const displayValue = value != null ? value : '--'

  return (
    <Card className="p-4 md:p-6 border-l-4 border-[#E01E73]">
      <div className="text-sm font-medium text-[#6B647E] mb-2">{label}</div>
      <div className="text-2xl font-semibold text-[#1B1630]">{displayValue}</div>
    </Card>
  )
}

