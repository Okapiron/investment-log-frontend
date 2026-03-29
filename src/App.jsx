import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useMemo } from 'react'

import Layout from './components/Layout'
import AuthCallbackPage from './pages/AuthCallbackPage'
import AuthPage from './pages/AuthPage'
import AuthResetPage from './pages/AuthResetPage'
import AnalysisPage from './pages/AnalysisPage'
import HelpPage from './pages/HelpPage'
import LandingPage from './pages/LandingPage'
import PrivacyPage from './pages/PrivacyPage'
import SettingsPage from './pages/SettingsPage'
import TermsPage from './pages/TermsPage'
import TradesNewPage from './pages/TradesNewPage'
import TradesPage from './pages/TradesPage'
import TradeDetailPage from './pages/TradeDetailPage.jsx'
import { hasAuthCallbackParams, isAuthEnabled, isAuthenticated } from './lib/auth'

function RootEntry() {
  const location = useLocation()
  const enabled = isAuthEnabled()
  const authed = useMemo(() => isAuthenticated(), [location.pathname, location.key])

  if (hasAuthCallbackParams({ hash: location.hash, search: location.search })) {
    return <Navigate to={{ pathname: '/auth/callback', hash: location.hash, search: location.search }} replace />
  }
  if (!enabled) {
    return <Navigate to={{ pathname: '/trades', hash: location.hash, search: location.search }} replace />
  }
  if (authed) {
    return <Navigate to={{ pathname: '/trades', hash: location.hash, search: location.search }} replace />
  }
  return <LandingPage />
}

function RequireAuth({ children }) {
  const location = useLocation()
  const enabled = isAuthEnabled()
  const authed = useMemo(() => isAuthenticated(), [location.pathname, location.key])
  if (!enabled) return children
  if (!authed) return <Navigate to="/auth" replace />
  return children
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<RootEntry />} />

        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/auth/reset" element={<AuthResetPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        <Route
          path="/analysis"
          element={(
            <RequireAuth>
              <AnalysisPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/trades"
          element={(
            <RequireAuth>
              <TradesPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/trades/new"
          element={(
            <RequireAuth>
              <TradesNewPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/trades/:id"
          element={(
            <RequireAuth>
              <TradeDetailPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/settings"
          element={(
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          )}
        />

        <Route path="/assets/*" element={<Navigate to="/trades" replace />} />
        <Route path="/dashboard" element={<Navigate to="/trades" replace />} />
        <Route path="/monthly" element={<Navigate to="/trades" replace />} />
        <Route path="/accounts" element={<Navigate to="/trades" replace />} />
        <Route path="/snapshots" element={<Navigate to="/trades" replace />} />

        <Route path="*" element={<RootEntry />} />
      </Routes>
    </Layout>
  )
}
