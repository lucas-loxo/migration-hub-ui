import React from 'react'
import { NavLink } from 'react-router-dom'

const links = [
  { to: '/dashboard-owner', label: 'Dashboard', icon: '📊' },
  { to: '/migrations', label: 'Migrations', icon: '🗂️' },
  { to: '/reports', label: 'Reports', icon: '📈' },
]

export default function Sidebar({ collapsed = false }) {
  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} shrink-0 hidden md:flex flex-col border-r border-slate-200 bg-white transition-all duration-200`}>
      <div className={`h-16 flex items-center ${collapsed ? 'justify-center' : 'px-4'} text-xl font-bold`}>
        <span>🚀</span>
        {!collapsed && <span className="ml-2">Migration Hub</span>}
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-xl ${collapsed ? 'justify-center' : ''} px-3 py-2 transition ${
                isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
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


