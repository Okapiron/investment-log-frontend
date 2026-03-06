import { Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout'
import TradesNewPage from './pages/TradesNewPage'
import TradesPage from './pages/TradesPage'
import TradeDetailPage from './pages/TradeDetailPage.jsx'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/trades" replace />} />

        <Route path="/trades" element={<TradesPage />} />
        <Route path="/trades/new" element={<TradesNewPage />} />
        <Route path="/trades/:id" element={<TradeDetailPage />} />

        <Route path="/assets/*" element={<Navigate to="/trades" replace />} />
        <Route path="/dashboard" element={<Navigate to="/trades" replace />} />
        <Route path="/monthly" element={<Navigate to="/trades" replace />} />
        <Route path="/accounts" element={<Navigate to="/trades" replace />} />
        <Route path="/snapshots" element={<Navigate to="/trades" replace />} />

        <Route path="*" element={<Navigate to="/trades" replace />} />
      </Routes>
    </Layout>
  )
}
