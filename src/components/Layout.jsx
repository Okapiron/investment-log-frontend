import { NavLink, useLocation } from 'react-router-dom'
import { clearAuthSession, isAuthEnabled, isAuthenticated } from '../lib/auth'

const tradeNavItems = [
  { to: '/trades', label: 'Trades' },
  { to: '/trades/new', label: 'New' },
  { to: '/settings', label: 'Settings' },
]

export default function Layout({ children }) {
  const location = useLocation()
  const isAuthRoute = location.pathname.startsWith('/auth')

  const navItems = isAuthRoute ? [] : tradeNavItems
  const showLogout = isAuthEnabled() && isAuthenticated() && !isAuthRoute

  function handleLogout() {
    clearAuthSession()
    window.location.assign('/auth')
  }

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-main">
          <h1>Trade Trace</h1>
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
            {showLogout ? (
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  background: 'rgba(255,255,255,0.16)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.35)',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: 13,
                }}
              >
                Logout
              </button>
            ) : null}
          </div>
        </div>
      </header>
      <main className="container">{children}</main>
    </div>
  )
}
