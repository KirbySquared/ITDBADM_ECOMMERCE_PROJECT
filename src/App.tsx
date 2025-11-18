import { BrowserRouter as Router } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import AppRoutes from './routes/AppRoutes'
import { isTokenExpiringSoon, refreshToken } from './utils/tokenRefresh'
import { useNotification } from './context/NotificationContext'
import './App.css'

function App() {
  const { showInfo } = useNotification()

  useEffect(() => {
    // Check and refresh token on app load
    const checkToken = async () => {
      const token = localStorage.getItem('token')
      if (!token) return

      // If token is expiring soon, refresh it
      if (isTokenExpiringSoon()) {
        const refreshed = await refreshToken()
        if (refreshed) {
          showInfo('Your session has been extended')
        }
      }
    }

    checkToken()

    // Set up periodic token refresh (every 10 minutes)
    const interval = setInterval(async () => {
      const token = localStorage.getItem('token')
      if (!token) return

      if (isTokenExpiringSoon()) {
        const refreshed = await refreshToken()
        if (refreshed) {
          showInfo('Your session has been extended')
        }
      }
    }, 10 * 60 * 1000) // 10 minutes

    return () => clearInterval(interval)
  }, [showInfo])

  return (
    <Router>
      <Layout>
        <AppRoutes />
      </Layout>
    </Router>
  )
}

export default App