/**
 * ADMIN SIDEBAR COMPONENT
 * 
 * This component provides consistent navigation for all admin pages.
 * 
 * FEATURES:
 * - Active route highlighting
 * - Responsive design
 * - Bootstrap icons
 * - Consistent styling with AdminDashboard
 * 
 * USAGE:
 * <AdminSidebar currentPath="/admin/products" />
 * 
 * TO ADD NEW NAVIGATION ITEMS:
 * - Add new Link components in the nav section
 * - Update the active route logic if needed
 * - Add corresponding routes in AppRoutes.tsx
 */
import { Link, useLocation } from 'react-router-dom'
import './AdminSidebar.css'

interface AdminSidebarProps {
  currentPath?: string
}

function AdminSidebar({ currentPath }: AdminSidebarProps) {
  const location = useLocation()
  const activePath = currentPath || location.pathname

  return (
    <div className="admin-sidebar p-3">
      <h4 className="text-white mb-4">Navigation</h4>
      <nav className="nav flex-column">
        <Link 
          to="/admin" 
          className={`nav-link ${activePath === '/admin' ? 'active' : ''}`}
        >
          <i className="bi bi-speedometer2 me-2"></i>
          Dashboard
        </Link>
        
        <Link 
          to="/admin/products" 
          className={`nav-link ${activePath.startsWith('/admin/products') ? 'active' : ''}`}
        >
          <i className="bi bi-box me-2"></i>
          Products
        </Link>
        
        <Link 
          to="/admin/orders" 
          className={`nav-link ${activePath.startsWith('/admin/orders') ? 'active' : ''}`}
        >
          <i className="bi bi-cart-check me-2"></i>
          Orders
        </Link>
        
        <Link 
          to="/admin/users" 
          className={`nav-link ${activePath.startsWith('/admin/users') ? 'active' : ''}`}
        >
          <i className="bi bi-people me-2"></i>
          Users
        </Link>
        
        <Link 
          to="/admin/categories" 
          className={`nav-link ${activePath.startsWith('/admin/categories') ? 'active' : ''}`}
        >
          <i className="bi bi-tags me-2"></i>
          Categories
        </Link>
        
        <Link 
          to="/" 
          className="nav-link mt-3"
        >
          <i className="bi bi-globe me-2"></i>
          View Store
        </Link>
      </nav>
    </div>
  )
}

export default AdminSidebar
