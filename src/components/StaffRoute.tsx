import { ReactNode } from 'react'
import { useStaffAuth } from '../hooks/useStaffAuth'
import { Link } from 'react-router-dom'

interface StaffRouteProps {
  children: ReactNode
}

function StaffRoute({ children }: StaffRouteProps) {
  const { isStaff, isAuthenticated, loading } = useStaffAuth()

  if (loading) {
    return (
      <div className="container">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Checking staff access...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="container">
        <div className="text-center py-5">
          <div className="alert alert-warning">
            <h4>Authentication Required</h4>
            <p>Please log in to access the staff panel.</p>
            <div className="mt-3">
              <Link to="/staff/login" className="btn btn-primary me-2">Staff Login</Link>
              <Link to="/login" className="btn btn-outline-primary me-2">Regular Login</Link>
              <Link to="/" className="btn btn-outline-secondary">Go to Home</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isStaff) {
    return (
      <div className="container">
        <div className="text-center py-5">
          <div className="alert alert-danger">
            <h4>Access Denied</h4>
            <p>You need staff privileges to access this page.</p>
            <div className="mt-3">
              <Link to="/staff/login" className="btn btn-primary me-2">Staff Login</Link>
              <Link to="/" className="btn btn-outline-secondary">Go to Home</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export default StaffRoute

