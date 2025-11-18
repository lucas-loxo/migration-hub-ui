import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from './state/AuthContext.tsx'
import GlobalErrorBoundary from './components/GlobalErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <GlobalErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </GlobalErrorBoundary>
    </HashRouter>
  </StrictMode>,
)
