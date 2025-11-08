import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface AdminNotificationContextType {
  showSuccess: (message: string) => void
  successMessage: string | null
  clearSuccess: () => void
}

const AdminNotificationContext = createContext<AdminNotificationContextType | undefined>(undefined)

export const AdminNotificationProvider = ({ children }: { children: ReactNode }) => {
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setSuccessMessage(null)
    }, 3000)
  }

  const clearSuccess = () => {
    setSuccessMessage(null)
  }

  return (
    <AdminNotificationContext.Provider value={{ showSuccess, successMessage, clearSuccess }}>
      {children}
    </AdminNotificationContext.Provider>
  )
}

export const useAdminNotification = () => {
  const context = useContext(AdminNotificationContext)
  if (!context) {
    throw new Error('useAdminNotification must be used within AdminNotificationProvider')
  }
  return context
}

