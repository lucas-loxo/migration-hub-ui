import React, { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar.jsx'
import NavBar from '../components/NavBar.jsx'

const STORAGE_KEY = 'mh_sidebar_collapsed'

export default function AppShell({ title, children }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw != null) setCollapsed(raw === '1')
    } catch (e) {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch (e) {}
  }, [collapsed])

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar collapsed={collapsed} />
      <div className="flex-1 flex flex-col">
        <NavBar title={title} onToggleSidebar={() => setCollapsed((v) => !v)} />
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  )
}


