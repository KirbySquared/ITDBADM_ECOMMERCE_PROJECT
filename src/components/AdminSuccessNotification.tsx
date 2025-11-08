/**
 * ADMIN SUCCESS NOTIFICATION COMPONENT
 * 
 * This component displays success notifications for admin actions.
 * It should be placed in the AdminLayout to be accessible across all admin pages.
 * 
 * USAGE:
 * Import and use in AdminLayout:
 * <AdminSuccessNotification />
 * 
 * In any admin page, use the hook:
 * const { showSuccess } = useAdminNotification()
 * showSuccess('Product created successfully!')
 */
import { useAdminNotification } from '../context/AdminNotificationContext'

function AdminSuccessNotification() {
  const { successMessage, clearSuccess } = useAdminNotification()

  if (!successMessage) return null

  return (
    <div className="alert alert-success alert-dismissible fade show" role="alert" style={{ position: 'sticky', top: '56px', zIndex: 1050 }}>
      <i className="bi bi-check-circle me-2"></i>
      {successMessage}
      <button 
        type="button" 
        className="btn-close" 
        onClick={clearSuccess} 
        aria-label="Close"
      ></button>
    </div>
  )
}

export default AdminSuccessNotification

