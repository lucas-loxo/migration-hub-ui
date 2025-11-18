import React from 'react'

export default function Card({ children, className = '' }) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm hover:shadow transition border border-[#E3D7E8] ${className}`}
    >
      {children}
    </div>
  )
}


