import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AppShell from './layouts/AppShell.jsx'
import Reports from './pages/Reports.jsx'
import DashboardOwner from './pages/DashboardOwner.jsx'
import Migrations from './pages/Migrations.jsx'
import Details from './pages/Details.jsx'
import Remapping from './pages/Remapping.jsx'
import Communication from './pages/Communication.jsx'

function AppLayout({ children }) {
  const location = useLocation()
  const titleMap = {
    '/dashboard-owner': 'Owner Dashboard',
    '/migrations': 'All Migrations',
    '/remapping': 'Remapping',
    '/communication': 'Communication',
  }
  const currentPath = location.pathname.replace('#', '')
  const title = titleMap[currentPath] || 'Migration Hub'
  return (
    <AppShell title={title}>{children}</AppShell>
  )
}

export default function App() {
  useEffect(() => {
    console.log('[MH-UI] App mounted')
  }, [])
  return (
    <AppLayout>
      <Routes>
        <Route path="/dashboard-owner" element={<DashboardOwner />} />
        <Route path="/migrations" element={<Migrations />} />
        <Route path="/details/:migrationId" element={<Details />} />
        <Route path="/remapping" element={<Remapping />} />
        <Route path="/communication" element={<Communication />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="*" element={<Navigate to="/dashboard-owner" replace />} />
      </Routes>
    </AppLayout>
  )
}
