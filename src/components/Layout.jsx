import { NavLink, useLocation } from 'react-router-dom'

const assetNavItems = [
  { to: '/assets/dashboard', label: 'Dashboard' },
  { to: '/assets/monthly', label: 'Monthly' },
  { to: '/assets/accounts', label: 'Accounts' },
  { to: '/assets/assets', label: 'Assets' },
  { to: '/assets/snapshots', label: 'Snapshots' },
]

const tradeNavItems = [
  { to: '/trades', label: 'Trades' },
  { to: '/trades/new', label: 'New' },
]

export default function Layout({ children }) {
  const location = useLocation()
  const legacyAssetPaths = ['/dashboard', '/monthly', '/accounts', '/snapshots']
  const isAssetsMode =
    location.pathname.startsWith('/assets') || location.pathname === '/' || legacyAssetPaths.includes(location.pathname)
  const isTradesMode = location.pathname.startsWith('/trades')

  const navItems = isTradesMode ? tradeNavItems : assetNavItems

  return (
    <div className="app-shell">
      <header className="header">
        <div className="mode-tabs">
          <NavLink
            to="/assets/monthly"
            className={() => (isAssetsMode ? 'mode-tab active' : 'mode-tab')}
          >
            資産管理
          </NavLink>
          <NavLink
            to="/trades"
            className={() => (isTradesMode ? 'mode-tab active' : 'mode-tab')}
          >
            投資ログ
          </NavLink>
        </div>

        <div className="header-main">
          <h1>Asset MVP</h1>
          <nav>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                end={item.to === '/trades' || item.to === '/assets/dashboard'}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="container">{children}</main>
    </div>
  )
}
