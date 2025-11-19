import React, { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar.jsx'
import NavBar from '../components/NavBar.jsx'
import { usePermissions } from '../state/usePermissions'
import { useAuth } from '../state/AuthContext'

const STORAGE_KEY = 'mh_sidebar_collapsed'

export default function AppShell({ title, children }) {
  const [collapsed, setCollapsed] = useState(false)
  const { email, isEditor } = usePermissions()
  const { userEmail } = useAuth()

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
    <div className="min-h-screen flex bg-[#FFF8FC]">
      <Sidebar collapsed={collapsed} />
      <div className="flex-1 flex flex-col">
        {/* Debug banner */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-1 text-xs text-slate-600">
          Signed in as: {userEmail || email || "unknown"} | isEditor: {isEditor ? "yes" : "no"}
        </div>
        <NavBar title={title} onToggleSidebar={() => setCollapsed((v) => !v)} />
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  )
}


