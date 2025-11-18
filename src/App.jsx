import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import AppShell from './layouts/AppShell.jsx'
import { FORM_NEW_MIGRATION_URL } from './config/constants.ts'
import AuthGate from './components/AuthGate.jsx'

function AppLayout({ children }) {
  const location = useLocation()
  const titleMap = {
    // '/': 'Dashboard', // Temporarily disabled
    '/dashboard-owner': 'Owner Dashboard',
    '/migrations': 'Migrations',
    '/remapping': 'Remapping',
    '/communication': 'Communication',
    // '/messaging': 'Messaging', // Temporarily disabled
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
    if (!FORM_NEW_MIGRATION_URL) {
      console.warn('[MH-UI] New Migration Form URL not configured')
    }
  }, [])
  
  return (
    <AppLayout>
      <AuthGate />
    </AppLayout>
  )
}
