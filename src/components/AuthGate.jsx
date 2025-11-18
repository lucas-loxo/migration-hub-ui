import React, { Suspense } from 'react'
import { useAuth } from '../state/AuthContext.tsx'
import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardOwner from '../pages/DashboardOwner.jsx'
import Details from '../pages/Details.jsx'
import Remapping from '../pages/Remapping.jsx'
import Communication from '../pages/Communication.jsx'
import Reports from '../pages/Reports.tsx'
import MyMigrationsPage from '../pages/MyMigrationsPage.tsx'
import CustomerPage from '../pages/CustomerPage.tsx'
// [MH-AI] Debug view for ComponentsConfig
import ComponentsConfigDebug from '../pages/debug/ComponentsConfigDebug.tsx'
import MessagingPage from '../pages/MessagingPage.tsx'
import { RouteErrorBoundary } from './common/RouteErrorBoundary.tsx'
import Card from './Card.jsx'

export default function AuthGate() {
  const { loading: authLoading, authed, requestSignIn } = useAuth()

  if (authLoading) {
    return <div className="p-6 text-center text-slate-500">Loading…</div>
  }

  if (!authed) {
    return (
      <div className="p-6 text-center">
        <div className="mb-2 text-slate-600">Sign in to continue</div>
        <button onClick={requestSignIn} className="rounded-xl bg-slate-900 text-white px-3 py-2">Sign in with Google</button>
      </div>
    )
  }

  const LoadingSkeleton = () => (
    <Card className="p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
      </div>
    </Card>
  )

  return (
        <Routes>
          {/* Dashboard route temporarily disabled */}
          {/* <Route path="/" element={
            <RouteErrorBoundary>
              <Suspense fallback={<LoadingSkeleton />}>
                <DashboardOwner />
              </Suspense>
            </RouteErrorBoundary>
          } /> */}
          <Route path="/dashboard-owner" element={
            <RouteErrorBoundary>
              <Suspense fallback={<LoadingSkeleton />}>
                <DashboardOwner />
              </Suspense>
            </RouteErrorBoundary>
          } />
          <Route path="/migrations" element={
            <RouteErrorBoundary>
              <Suspense fallback={<LoadingSkeleton />}>
                <MyMigrationsPage />
              </Suspense>
            </RouteErrorBoundary>
          } />
          <Route path="/migrations/:migrationId" element={
            <RouteErrorBoundary>
              <Suspense fallback={<LoadingSkeleton />}>
                <CustomerPage />
              </Suspense>
            </RouteErrorBoundary>
          } />
          <Route path="/my-migrations" element={<Navigate to="/migrations" replace />} />
          <Route path="/customer/:customerId" element={
            <RouteErrorBoundary>
              <Suspense fallback={<LoadingSkeleton />}>
                <CustomerPage />
              </Suspense>
            </RouteErrorBoundary>
          } />
          <Route path="/details/:migrationId" element={
            <RouteErrorBoundary>
              <Suspense fallback={<LoadingSkeleton />}>
                <Details />
              </Suspense>
            </RouteErrorBoundary>
          } />
          <Route path="/remapping" element={
            <RouteErrorBoundary>
              <Suspense fallback={<LoadingSkeleton />}>
                <Remapping />
              </Suspense>
            </RouteErrorBoundary>
          } />
          <Route path="/communication" element={
            <RouteErrorBoundary>
              <Suspense fallback={<LoadingSkeleton />}>
                <Communication />
              </Suspense>
            </RouteErrorBoundary>
          } />
          <Route path="/reports" element={
            <RouteErrorBoundary>
              <Suspense fallback={<LoadingSkeleton />}>
                <Reports />
              </Suspense>
            </RouteErrorBoundary>
          } />
          <Route path="/debug/components-config" element={
            <RouteErrorBoundary>
              <Suspense fallback={<LoadingSkeleton />}>
                <ComponentsConfigDebug />
              </Suspense>
            </RouteErrorBoundary>
          } />
          <Route path="/messaging" element={
            <RouteErrorBoundary>
              <Suspense fallback={<LoadingSkeleton />}>
                <MessagingPage />
              </Suspense>
            </RouteErrorBoundary>
          } />
          <Route path="*" element={<Navigate to="/migrations" replace />} />
        </Routes>
  )
}


