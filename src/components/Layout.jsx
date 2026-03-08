import { NavLink, useLocation } from 'react-router-dom'

const tradeNavItems = [
  { to: '/trades', label: 'Trades' },
  { to: '/trades/new', label: 'New' },
  { to: '/help', label: 'Help' },
  { to: '/settings', label: 'Settings' },
]

export default function Layout({ children }) {
  const location = useLocation()
  const isAuthRoute = location.pathname.startsWith('/auth')

  const navItems = isAuthRoute ? [] : tradeNavItems

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-main">
          <div className="brand">
            <div className="brand-mark" aria-hidden>TT</div>
            <div className="brand-copy">
              <h1>TradeTrace</h1>
              <div className="brand-sub">Review First Trading Journal</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <nav>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  end={item.to === '/trades'}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <main className="container">{children}</main>
    </div>
  )
}
