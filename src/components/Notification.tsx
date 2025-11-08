/**
 * NOTIFICATION COMPONENT
 * 
 * This component displays notifications for user actions (success, error, warning, info).
 * It should be placed in the Layout to be accessible across all pages.
 * 
 * USAGE:
 * Import and use in Layout:
 * <Notification />
 * 
 * In any component, use the hook:
 * const { showSuccess, showError } = useNotification()
 * showSuccess('Product added to cart!')
 * showError('Failed to add product')
 */
import { useNotification } from '../context/NotificationContext'

function Notification() {
  const { notification, clearNotification } = useNotification()

  if (!notification) return null

  const alertClass = {
    success: 'alert-success',
    error: 'alert-danger',
    warning: 'alert-warning',
    info: 'alert-info'
  }[notification.type]

  const iconClass = {
    success: 'bi-check-circle',
    error: 'bi-exclamation-triangle',
    warning: 'bi-exclamation-triangle',
    info: 'bi-info-circle'
  }[notification.type]

  return (
    <div 
      className={`alert ${alertClass} alert-dismissible fade show`} 
      role="alert" 
      style={{ position: 'sticky', top: '56px', zIndex: 1050, margin: 0 }}
    >
      <i className={`bi ${iconClass} me-2`}></i>
      {notification.message}
      <button 
        type="button" 
        className="btn-close" 
        onClick={clearNotification} 
        aria-label="Close"
      ></button>
    </div>
  )
}

export default Notification

