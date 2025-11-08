import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

type NotificationType = 'success' | 'error' | 'warning' | 'info'

interface Notification {
  message: string
  type: NotificationType
}

interface NotificationContextType {
  showSuccess: (message: string) => void
  showError: (message: string) => void
  showWarning: (message: string) => void
  showInfo: (message: string) => void
  notification: Notification | null
  clearNotification: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notification, setNotification] = useState<Notification | null>(null)

  const showNotification = (message: string, type: NotificationType) => {
    setNotification({ message, type })
    // Auto-dismiss after 5 seconds for errors/warnings, 3 seconds for success/info
    const timeout = type === 'error' || type === 'warning' ? 5000 : 3000
    setTimeout(() => {
      setNotification(null)
    }, timeout)
  }

  const showSuccess = (message: string) => showNotification(message, 'success')
  const showError = (message: string) => showNotification(message, 'error')
  const showWarning = (message: string) => showNotification(message, 'warning')
  const showInfo = (message: string) => showNotification(message, 'info')

  const clearNotification = () => {
    setNotification(null)
  }

  return (
    <NotificationContext.Provider value={{ 
      showSuccess, 
      showError, 
      showWarning, 
      showInfo,
      notification, 
      clearNotification 
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotification = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider')
  }
  return context
}

