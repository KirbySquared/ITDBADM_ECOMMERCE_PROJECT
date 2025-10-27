/**
 * GENERAL AUTHENTICATION HOOK
 * 
 * This hook manages user authentication state for regular users (non-admin).
 * 
 * FEATURES:
 * - Checks authentication status on mount
 * - Listens for auth state changes (login/logout events)
 * - Provides logout functionality
 * - Works for both regular users and admins
 * 
 * TO ADD NEW FEATURES:
 * - Add new API calls in the hook
 * - Update the User interface if needed
 * - Add new auth-related functions
 * - Modify the logout behavior
 * 
 * USAGE:
 * const { isAuthenticated, user, logout } = useAuth()
 */
import { useState, useEffect } from 'react'

interface User {
  user_id: number
  username: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  address?: string
  role?: string
}

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  loading: boolean
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true
  })

  useEffect(() => {
    checkAuth()
    
    // Listen for auth state changes (e.g., after login)
    const handleAuthStateChange = () => {
      checkAuth()
    }
    
    window.addEventListener('authStateChanged', handleAuthStateChange)
    
    return () => {
      window.removeEventListener('authStateChanged', handleAuthStateChange)
    }
  }, [])

  const checkAuth = () => {
    try {
      const token = localStorage.getItem('token')
      const userStr = localStorage.getItem('user')
      
      if (!token || !userStr) {
        setAuthState({
          isAuthenticated: false,
          user: null,
          loading: false
        })
        return
      }

      // Parse user data
      const user = JSON.parse(userStr)
      
      setAuthState({
        isAuthenticated: true,
        user: user,
        loading: false
      })
    } catch (error) {
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false
      })
    }
  }

  const logout = async () => {
    try {
      const token = localStorage.getItem('token')
      if (token) {
        await fetch('http://localhost:8000/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false
      })
    }
  }

  return {
    ...authState,
    logout,
    checkAuth,
    refreshAuth: checkAuth
  }
}

