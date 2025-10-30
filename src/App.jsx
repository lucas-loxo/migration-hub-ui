import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import NavBar from './components/NavBar.jsx'
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
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <NavBar title={title} />
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/dashboard-owner" element={<DashboardOwner />} />
        <Route path="/migrations" element={<Migrations />} />
        <Route path="/details/:migrationId" element={<Details />} />
        <Route path="/remapping" element={<Remapping />} />
        <Route path="/communication" element={<Communication />} />
        <Route path="*" element={<Navigate to="/dashboard-owner" replace />} />
      </Routes>
    </AppLayout>
  )
}
