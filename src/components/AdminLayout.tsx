/**
 * ADMIN LAYOUT COMPONENT
 * 
 * This component provides a consistent layout for all admin pages with sidebar navigation.
 * 
 * FEATURES:
 * - Consistent sidebar across all admin pages
 * - Responsive design
 * - Proper content area with padding
 * - Bootstrap grid system
 * 
 * USAGE:
 * <AdminLayout>
 *   <YourAdminPageContent />
 * </AdminLayout>
 * 
 * TO ADD NEW FEATURES:
 * - Add new sidebar items in AdminSidebar component
 * - Modify the layout structure if needed
 * - Update the responsive breakpoints
 */
import { ReactNode } from 'react'
import AdminSidebar from './AdminSidebar'

interface AdminLayoutProps {
  children: ReactNode
  currentPath?: string
}

function AdminLayout({ children, currentPath }: AdminLayoutProps) {
  return (
    <div className="admin-dashboard">
      <div className="container-fluid">
        <div className="row">
          {/* Sidebar */}
          <div className="col-md-3 col-lg-2 px-0">
            <AdminSidebar currentPath={currentPath} />
          </div>

          {/* Main Content */}
          <div className="col-md-9 col-lg-10">
            <div className="p-4">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminLayout
