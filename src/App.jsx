import { Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout'
import AccountsPage from './pages/AccountsPage'
import AssetsPage from './pages/AssetsPage'
import DashboardPage from './pages/DashboardPage'
import MonthlyPage from './pages/MonthlyPage'
import SnapshotsPage from './pages/SnapshotsPage'
import TradesNewPage from './pages/TradesNewPage'
import TradesPage from './pages/TradesPage'
import TradeDetailPage from './pages/TradeDetailPage.jsx'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/assets/monthly" replace />} />

        <Route path="/assets" element={<Navigate to="/assets/assets" replace />} />
        <Route path="/assets/dashboard" element={<DashboardPage />} />
        <Route path="/assets/monthly" element={<MonthlyPage />} />
        <Route path="/assets/accounts" element={<AccountsPage />} />
        <Route path="/assets/assets" element={<AssetsPage />} />
        <Route path="/assets/snapshots" element={<SnapshotsPage />} />

        <Route path="/dashboard" element={<Navigate to="/assets/dashboard" replace />} />
        <Route path="/monthly" element={<Navigate to="/assets/monthly" replace />} />
        <Route path="/accounts" element={<Navigate to="/assets/accounts" replace />} />
        <Route path="/snapshots" element={<Navigate to="/assets/snapshots" replace />} />

        <Route path="/trades" element={<TradesPage />} />
        <Route path="/trades/new" element={<TradesNewPage />} />
        <Route path="/trades/:id" element={<TradeDetailPage />} />

        <Route path="*" element={<Navigate to="/assets/monthly" replace />} />
      </Routes>
    </Layout>
  )
}
