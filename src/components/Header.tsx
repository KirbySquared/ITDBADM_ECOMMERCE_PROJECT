/**
 * DYNAMIC HEADER COMPONENT (+ Currency Dropdown)
 * - Keeps your existing admin/user logic
 * - Adds a currency selector that updates global currency context
 * - Admin header: dark form-select
 * - User header: light/transparent select that matches gradient
 */
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCurrency } from '../context/CurrencyContext'  // ⬅️ added
import MiniCart from './MiniCart'
import './Header.css'

function Header() {
  const { isAuthenticated, user, logout } = useAuth()
  const { currency, setCurrency } = useCurrency()          // ⬅️ added
  const location = useLocation()
  const navigate = useNavigate()
  const [showMiniCart, setShowMiniCart] = useState(false)
  const [hoverTimeout, setHoverTimeout] = useState<number | null>(null)
  const cartButtonRef = useRef<HTMLDivElement>(null)

  // Check if we're on an admin page
  const isAdminPage = location.pathname.startsWith('/admin')
  // Check if user is admin
  const isAdmin = user?.role === 'admin' || (isAuthenticated && isAdminPage)

  // Handle logout with redirection
  const handleLogout = async () => {
    try {
      await logout()
      navigate('/')
    } catch (error) {
      console.error('Logout error:', error)
      navigate('/')
    }
  }

  const handleCartMouseEnter = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
    }
    const timeout = setTimeout(() => {
      setShowMiniCart(true)
    }, 1000)
    setHoverTimeout(timeout)
  }

  const handleCartMouseLeave = () => {
    setTimeout(() => {
      if (!document.querySelector('.minicart-modal:hover')) {
        setShowMiniCart(false)
      }
    }, 200)
  }

  const handleModalMouseEnter = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
    }
  }

  const handleModalMouseLeave = () => {
    setTimeout(() => {
      setShowMiniCart(false)
    }, 300)
  }

  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
      }
    }
  }, [hoverTimeout])

  // -------------------- ADMIN HEADER --------------------
  if (isAdmin && isAuthenticated && isAdminPage) {
    return (
      <header className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm sticky-top">
        <div className="container-fluid">
          <Link to="/admin" className="navbar-brand d-flex align-items-center">
            <i className="bi bi-shield-check me-2"></i>
            Admin Panel
          </Link>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#adminNavbarNav"
            aria-controls="adminNavbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="adminNavbarNav">
            <div className="navbar-nav ms-auto align-items-lg-center gap-2">
              <Link to="/admin" className="nav-link d-flex align-items-center">
                <i className="bi bi-house-door me-1"></i>
                Dashboard Home
              </Link>
              <Link to="/" className="nav-link d-flex align-items-center me-2">
                <i className="bi bi-globe me-1"></i>
                View Store
              </Link>
              <button
                className="btn btn-outline-light d-flex align-items-center"
                onClick={handleLogout}
              >
                <i className="bi bi-box-arrow-right me-1"></i>
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>
    )
  }

  // -------------------- USER HEADER --------------------
  return (
    <header
      className="navbar navbar-expand-lg sticky-top border-bottom"
      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
    >
      <div className="container">
        <Link to="/" className="navbar-brand text-white fw-bold fs-3 d-flex align-items-center">
          <i className="bi bi-controller me-2" style={{ fontSize: '1.8rem' }}></i>
          <span style={{ fontFamily: 'Arial, sans-serif', letterSpacing: '1px' }}>GameStore</span>
        </Link>

        <button
          className="navbar-toggler bg-white"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <Link to="/" className="nav-link text-white fw-semibold">
                <i className="bi bi-house-door me-1"></i>
                Home
              </Link>
            </li>
            <li className="nav-item">
              <Link to="/products" className="nav-link text-white fw-semibold">
                <i className="bi bi-grid me-1"></i>
                Products
              </Link>
            </li>
          </ul>

          <div className="d-flex align-items-center gap-2">
            {/* ⬇️ Currency dropdown (user, light/transparent style) */}
            <div className="d-flex align-items-center me-1">
              <label className="me-2 text-white-50 d-none d-lg-inline" htmlFor="userCurrency">
                Currency
              </label>
              <select
                id="userCurrency"
                value={currency}
                onChange={e => setCurrency(e.target.value as any)}
                aria-label="Currency selector"
                className="form-select form-select-sm"
                style={{
                  width: 120,
                  background: 'rgba(255,255,255,0.15)',
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.35)'
                }}
              >
                <option value="PHP">PHP ₱</option>
                <option value="USD">USD $</option>
                <option value="KRW">KRW ₩</option>
              </select>
              <span className="badge bg-light text-dark ms-2">{currency}</span>
            </div>

            {isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  className="btn profile-btn"
                  style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', color: 'white' }}
                >
                  <i className="bi bi-person-circle me-1"></i>
                  Profile
                </Link>

                <div className="position-relative">
                  <div
                    ref={cartButtonRef}
                    className="cart-button-wrapper d-flex align-items-center"
                    onMouseEnter={handleCartMouseEnter}
                    onMouseLeave={handleCartMouseLeave}
                  >
                    <button
                      className="btn btn cart-toggle"
                      onClick={() => setShowMiniCart(!showMiniCart)}
                    >
                      <i className="bi bi-cart3"></i>
                    </button>
                    <Link to="/cart" className="nav-link text-white fw-semibold cart-link">
                      Cart
                    </Link>
                  </div>
                </div>

                <button
                  className="btn btn-outline-light border-2"
                  onClick={handleLogout}
                >
                  <i className="bi bi-box-arrow-right me-1"></i>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-light">
                  <i className="bi bi-box-arrow-in-right me-1"></i>
                  Login
                </Link>
                <Link to="/register" className="btn btn-warning fw-bold">
                  <i className="bi bi-person-plus me-1"></i>
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mini Cart Modal */}
      <MiniCart
        show={showMiniCart}
        onHide={() => setShowMiniCart(false)}
        onCartUpdate={() => {
          window.dispatchEvent(new Event('cartUpdated'))
        }}
        onMouseEnter={handleModalMouseEnter}
        onMouseLeave={handleModalMouseLeave}
        triggerElement={cartButtonRef.current}
      />
    </header>
  )
}

export default Header
