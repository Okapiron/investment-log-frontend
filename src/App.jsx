import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useMemo } from 'react'

import Layout from './components/Layout'
import AuthCallbackPage from './pages/AuthCallbackPage'
import AuthPage from './pages/AuthPage'
import AuthResetPage from './pages/AuthResetPage'
import AnalysisPage from './pages/AnalysisPage'
import HelpPage from './pages/HelpPage'
import LandingPage from './pages/LandingPage'
import PrivateModePage from './pages/PrivateModePage'
import PrivacyPage from './pages/PrivacyPage'
import SettingsPage from './pages/SettingsPage'
import TermsPage from './pages/TermsPage'
import TradesNewPage from './pages/TradesNewPage'
import TradesPage from './pages/TradesPage'
import TradeDetailPage from './pages/TradeDetailPage.jsx'
import { hasAuthCallbackParams, isAuthEnabled, isAuthenticated } from './lib/auth'
import { hasPrivateAccess, isPrivateModeEnabled } from './lib/privateAccess'

function RootEntry() {
  const location = useLocation()
  const enabled = isAuthEnabled()
  const privateMode = isPrivateModeEnabled()
  const privateAccess = useMemo(() => hasPrivateAccess(), [location.pathname, location.key])
  const authed = useMemo(() => isAuthenticated(), [location.pathname, location.key])

  if (privateMode) {
    if (privateAccess) {
      return <Navigate to={{ pathname: '/trades', hash: location.hash, search: location.search }} replace />
    }
    return <PrivateModePage />
  }
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

function RequireAppAccess({ children }) {
  const location = useLocation()
  const privateMode = isPrivateModeEnabled()
  const privateAccess = useMemo(() => hasPrivateAccess(), [location.pathname, location.key])
  const enabled = isAuthEnabled()
  const authed = useMemo(() => isAuthenticated(), [location.pathname, location.key])
  if (privateMode && !privateAccess) return <Navigate to="/" replace />
  if (!enabled) return children
  if (!authed) return <Navigate to="/auth" replace />
  return children
}

function PrivateOrPublicPage({ children }) {
  if (isPrivateModeEnabled()) {
    return <PrivateModePage />
  }
  return children
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<RootEntry />} />

        <Route path="/auth" element={<PrivateOrPublicPage><AuthPage /></PrivateOrPublicPage>} />
        <Route path="/auth/callback" element={<PrivateOrPublicPage><AuthCallbackPage /></PrivateOrPublicPage>} />
        <Route path="/auth/reset" element={<PrivateOrPublicPage><AuthResetPage /></PrivateOrPublicPage>} />
        <Route path="/help" element={<PrivateOrPublicPage><HelpPage /></PrivateOrPublicPage>} />
        <Route path="/terms" element={<PrivateOrPublicPage><TermsPage /></PrivateOrPublicPage>} />
        <Route path="/privacy" element={<PrivateOrPublicPage><PrivacyPage /></PrivateOrPublicPage>} />

        <Route
          path="/analysis"
          element={(
            <RequireAppAccess>
              <AnalysisPage />
            </RequireAppAccess>
          )}
        />
        <Route
          path="/trades"
          element={(
            <RequireAppAccess>
              <TradesPage />
            </RequireAppAccess>
          )}
        />
        <Route
          path="/trades/new"
          element={(
            <RequireAppAccess>
              <TradesNewPage />
            </RequireAppAccess>
          )}
        />
        <Route
          path="/trades/:id"
          element={(
            <RequireAppAccess>
              <TradeDetailPage />
            </RequireAppAccess>
          )}
        />
        <Route
          path="/settings"
          element={(
            <RequireAppAccess>
              <SettingsPage />
            </RequireAppAccess>
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
