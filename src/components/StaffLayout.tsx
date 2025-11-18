/**
 * STAFF LAYOUT COMPONENT
 * 
 * This component provides a consistent layout for all staff pages with sidebar navigation.
 * 
 * FEATURES:
 * - Consistent sidebar across all staff pages
 * - Responsive design
 * - Proper content area with padding
 * - Bootstrap grid system
 */
import { ReactNode } from 'react'
import StaffSidebar from './StaffSidebar'

interface StaffLayoutProps {
  children: ReactNode
  currentPath?: string
}

function StaffLayout({ children, currentPath }: StaffLayoutProps) {

  return (
    <div className="admin-dashboard">
      <div className="container-fluid">
        <div className="row">
          {/* Sidebar */}
          <div className="col-md-3 col-lg-2 px-0">
            <StaffSidebar currentPath={currentPath} />
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

export default StaffLayout

