/**
 * STAFF SIDEBAR COMPONENT
 * 
 * This component provides consistent navigation for all staff pages.
 * 
 * FEATURES:
 * - Active route highlighting
 * - Responsive design
 * - Bootstrap icons
 * - Shows branch name
 */
import { Link, useLocation } from 'react-router-dom'
import { useStaffAuth } from '../hooks/useStaffAuth'
import './AdminSidebar.css'

interface StaffSidebarProps {
  currentPath?: string
}

function StaffSidebar({ currentPath }: StaffSidebarProps) {
  const location = useLocation()
  const activePath = currentPath || location.pathname
  const { user } = useStaffAuth()

  return (
    <div className="admin-sidebar p-3">
      <div className="mb-4">
        <h4 className="text-white mb-2">Staff Panel</h4>
        {user && user.branch_name && (
          <p className="text-white-50 small mb-0">
            <i className="bi bi-shop me-1"></i>
            {user.branch_name}
          </p>
        )}
      </div>
      <nav className="nav flex-column">
        <Link 
          to="/staff" 
          className={`nav-link ${activePath === '/staff' ? 'active' : ''}`}
        >
          <i className="bi bi-speedometer2 me-2"></i>
          Dashboard
        </Link>
        
        <Link 
          to="/staff/orders" 
          className={`nav-link ${activePath.startsWith('/staff/orders') ? 'active' : ''}`}
        >
          <i className="bi bi-cart-check me-2"></i>
          Orders
        </Link>
        
        <Link 
          to="/staff/inventory" 
          className={`nav-link ${activePath.startsWith('/staff/inventory') ? 'active' : ''}`}
        >
          <i className="bi bi-box-seam me-2"></i>
          Inventory
        </Link>
      </nav>
    </div>
  )
}

export default StaffSidebar

