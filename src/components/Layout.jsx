import { NavLink, useLocation } from 'react-router-dom'

const tradeNavItems = [
  { to: '/trades', label: 'Trades' },
  { to: '/trades/new', label: 'New' },
]

export default function Layout({ children }) {
  const location = useLocation()
  const isTradesMode = location.pathname.startsWith('/trades')

  const navItems = tradeNavItems

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-main">
          <h1>Trade Trace</h1>
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
      </header>
      <main className="container">{children}</main>
    </div>
  )
}
