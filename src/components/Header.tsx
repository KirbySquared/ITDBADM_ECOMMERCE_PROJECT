/**
 * DYNAMIC HEADER COMPONENT
 * 
 * This component automatically switches between admin and user headers based on:
 * 1. User authentication status (isAuthenticated)
 * 2. User role (isAdmin)
 * 3. Current route (isAdminPage)
 * 
 * HEADER TYPES:
 * - ADMIN HEADER: Shows on /admin/* pages when admin is logged in
 *   - Dark theme (bg-dark)
 *   - Admin Panel branding
 *   - Dashboard Home, View Store, Logout buttons
 * 
 * - USER HEADER: Shows on all other pages (including when admin visits store)
 *   - Light theme (bg-white)
 *   - GameStore branding
 *   - Home, Products, Cart navigation
 *   - Login/Register (when not logged in) or Profile/Logout (when logged in)
 * 
 * AUTHENTICATION:
 * - Uses useAdminAuth hook for auth state
 * - Automatically refreshes when authStateChanged event is fired
 * - Handles logout with redirection to home page
 * 
 * TO ADD NEW FEATURES:
 * - Add new navigation links in the appropriate header section
 * - Update the authentication logic if needed
 * - Modify the logout behavior in handleLogout()
 * - Add new user menu items in the user header section
 */
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../hooks/useAdminAuth'
import './Header.css'

function Header() {
  const { isAdmin, isAuthenticated, user, logout } = useAdminAuth()
  const location = useLocation()
  const navigate = useNavigate()
  
  // Check if we're on an admin page
  const isAdminPage = location.pathname.startsWith('/admin')

  // Handle logout with redirection
  const handleLogout = async () => {
    try {
      await logout()
      // Redirect to home page after logout
      navigate('/')
    } catch (error) {
      console.error('Logout error:', error)
      // Still redirect even if logout fails
      navigate('/')
    }
  }

  // Admin Header - automatically loads on admin dashboard pages
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
            <div className="navbar-nav ms-auto">
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

  // Regular User Header - for all non-admin pages (including when admin visits store)
  return (
    <header className="navbar navbar-expand-lg navbar-light bg-white shadow-sm sticky-top">
      <div className="container">
        <Link to="/" className="navbar-brand text-primary fw-bold fs-4">
          GameStore
        </Link>
        
        <button 
          className="navbar-toggler" 
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
              <Link to="/" className="nav-link">Home</Link>
            </li>
            <li className="nav-item">
              <Link to="/products" className="nav-link">Products</Link>
            </li>
            <li className="nav-item">
              <Link to="/cart" className="nav-link">Cart</Link>
            </li>
          </ul>
          
          <div className="d-flex gap-2">
            {isAuthenticated ? (
              // Show user menu when logged in (for both regular users and admins on store pages)
              <>
                <Link to="/profile" className="btn btn-outline-primary">
                  Profile
                </Link>
                <button 
                  className="btn btn-outline-danger"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </>
            ) : (
              // Show login/register when not logged in
              <>
                <Link to="/login" className="btn btn-outline-primary">Login</Link>
                <Link to="/register" className="btn btn-primary">Register</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
