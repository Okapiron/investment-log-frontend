import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts'
import { Link } from 'react-router-dom'

import { api, formatJPY } from '../lib/api'

const colors = ['#2a9d8f', '#e76f51', '#e9c46a', '#264653', '#457b9d', '#f4a261']
const assetTypes = ['cash', 'stock', 'fund', 'bond', 'crypto', 'other']

function defaultRange() {
  const now = new Date()
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  return { from, to: end }
}

export default function DashboardPage() {
  const { from: defaultFrom, to: defaultTo } = defaultRange()
  const [range, setRange] = useState({ from: defaultFrom, to: defaultTo })

  const latestQuery = useQuery({ queryKey: ['dashboard', 'latest'], queryFn: () => api.get('/dashboard/latest') })
  const monthlyQuery = useQuery({
    queryKey: ['dashboard', 'monthly', range.from, range.to],
    queryFn: () => api.get(`/dashboard/monthly?from=${range.from}&to=${range.to}`),
  })

  const areaData = useMemo(() => {
    const points = monthlyQuery.data?.points || []
    return points.map((p) => ({ month: p.month, ...p.by_asset_type, total_jpy: p.total_jpy }))
  }, [monthlyQuery.data])

  const pieData = latestQuery.data?.by_asset_type || []
  const hasLatest = latestQuery.data?.month

  if (!latestQuery.isLoading && !hasLatest) {
    return (
      <section>
        <h2>Dashboard</h2>
        <p className="empty">最新月データがありません。</p>
        <Link className="cta-link" to="/assets/snapshots">
          スナップショット登録へ
        </Link>
      </section>
    )
  }

  return (
    <section>
      <h2>Dashboard</h2>

      <div className="cards">
        <article className="card">
          <h3>最新月総資産</h3>
          <p className="big-number">{formatJPY(latestQuery.data?.total_jpy || 0)}</p>
          <p className="meta">month: {latestQuery.data?.month || '-'}</p>
        </article>
      </div>

      <div className="chart-grid">
        <article className="card chart-card">
          <h3>資産タイプ別配分（最新月）</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value_jpy" nameKey="asset_type" outerRadius={110}>
                  {pieData.map((entry, idx) => (
                    <Cell key={entry.asset_type} fill={colors[idx % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatJPY(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card chart-card wide">
          <div className="chart-header">
            <h3>資産タイプ別 積み上げ推移</h3>
            <div className="range-row">
              <input
                type="month"
                value={range.from}
                onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))}
              />
              <input type="month" value={range.to} onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))} />
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}万`} />
                <Tooltip formatter={(v) => formatJPY(v)} />
                <Legend />
                {assetTypes.map((t, idx) => (
                  <Area
                    key={t}
                    type="monotone"
                    dataKey={t}
                    stackId="1"
                    stroke={colors[idx % colors.length]}
                    fill={colors[idx % colors.length]}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>
    </section>
  )
}
