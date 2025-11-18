import React from 'react'
import { NavLink } from 'react-router-dom'

const links = [
  // { to: '/', label: 'Dashboard', icon: '📊' }, // Temporarily disabled
  { to: '/migrations', label: 'Migrations', icon: '🗂️' },
  // { to: '/messaging', label: 'Inbox', icon: '💬' }, // Temporarily disabled
  { to: '/reports', label: 'Reports', icon: '📈' },
]

export default function Sidebar({ collapsed = false }) {
  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} shrink-0 hidden md:flex flex-col border-r border-[#E3D7E8] bg-white transition-all duration-200`}>
      <div className={`h-16 flex items-center ${collapsed ? 'justify-center' : 'px-4'} text-xl font-bold text-[#1B1630]`}>
        <span>🚀</span>
        {!collapsed && <span className="ml-2">Migration Hub</span>}
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/migrations'}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-xl ${collapsed ? 'justify-center' : ''} px-3 py-2 transition ${
                isActive ? 'bg-[#E01E73] text-white' : 'text-[#6B647E] hover:bg-[#E01E73]/10'
              }`
            }
          >
            <span className="text-lg">{l.icon}</span>
            {!collapsed && <span className="font-medium">{l.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}


