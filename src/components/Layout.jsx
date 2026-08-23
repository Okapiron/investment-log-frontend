import { Link, NavLink, useLocation } from 'react-router-dom'
import { isAuthEnabled, isAuthenticated } from '../lib/auth'
import { isLocalTrialMode } from '../lib/localMode'
import { hasPrivateAccess, isPrivateModeEnabled } from '../lib/privateAccess'

const tradeNavItems = [
  { to: '/review', label: 'レビュー' },
  { to: '/trades', label: '取引一覧' },
  { to: '/import', label: '取込' },
  { to: '/settings', label: '設定' },
]

export default function Layout({ children }) {
  const location = useLocation()
  const privateModeEnabled = isPrivateModeEnabled()
  const privateAccessGranted = hasPrivateAccess()
  const isAuthRoute = location.pathname.startsWith('/auth')
  const authEnabled = isAuthEnabled()
  const authed = isAuthenticated()
  const localTrial = isLocalTrialMode()
  const isPrivateLanding = privateModeEnabled && !privateAccessGranted
  const isPublicLanding = location.pathname === '/' && authEnabled && !authed
  const navItems = isAuthRoute || isPublicLanding || isPrivateLanding
    ? []
    : localTrial
      ? tradeNavItems.filter((item) => item.to !== '/trades/new')
      : tradeNavItems

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-main">
          <div className="brand">
            <div className="brand-mark" aria-hidden>
              <img src="/brand/logo-mark-512.png" alt="" className="brand-mark-image" />
            </div>
            <div className="brand-copy">
              <h1>TradeTrace</h1>
              <div className="brand-sub">トレードを振り返るための投資ノート</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <nav>
              {isPublicLanding ? (
                <>
                  <Link to="/auth" className="nav-link nav-link-public" data-cta="header-login">
                    ログイン
                  </Link>
                  <Link to="/auth?mode=signup" className="nav-link nav-link-primary" data-cta="header-signup">
                    新規登録
                  </Link>
                </>
              ) : null}
              {isPrivateLanding ? <span className="nav-link nav-link-private">個人用モード</span> : null}
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
              {localTrial && !isAuthRoute && !isPublicLanding && !isPrivateLanding ? (
                <Link to="/auth?mode=signup" className="nav-link nav-link-primary" data-cta="local-header-signup">
                  クラウド保存
                </Link>
              ) : null}
            </nav>
          </div>
        </div>
      </header>
      <main className="container">{children}</main>
    </div>
  )
}
