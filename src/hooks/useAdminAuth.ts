/**
 * ADMIN AUTHENTICATION HOOK
 * 
 * This hook manages admin authentication state and provides auth-related functions.
 * 
 * FEATURES:
 * - Checks authentication status on mount
 * - Listens for auth state changes (login/logout events)
 * - Validates admin role via API
 * - Provides logout functionality
 * - Exposes refresh function for manual auth checks
 * 
 * API ENDPOINTS USED:
 * - /api/admin/check_auth - Validates admin token and role
 * - /api/auth/logout - Logs out user (called during logout)
 * 
 * EVENTS:
 * - Listens for 'authStateChanged' custom event
 * - Automatically refreshes auth state when event is fired
 * 
 * TO ADD NEW FEATURES:
 * - Add new API calls in the hook
 * - Update the User interface if needed
 * - Add new auth-related functions
 * - Modify the logout behavior
 * 
 * USAGE:
 * const { isAdmin, isAuthenticated, user, logout, refreshAuth } = useAdminAuth()
 */
import { useState, useEffect } from 'react'

interface User {
  user_id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: string
}

interface AuthState {
  isAuthenticated: boolean
  isAdmin: boolean
  user: User | null
  loading: boolean
}

export const useAdminAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isAdmin: false,
    user: null,
    loading: true
  })

  useEffect(() => {
    checkAdminAuth()
    
    // Listen for auth state changes (e.g., after login)
    const handleAuthStateChange = () => {
      checkAdminAuth()
    }
    
    window.addEventListener('authStateChanged', handleAuthStateChange)
    
    return () => {
      window.removeEventListener('authStateChanged', handleAuthStateChange)
    }
  }, [])

  const checkAdminAuth = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setAuthState({
          isAuthenticated: false,
          isAdmin: false,
          user: null,
          loading: false
        })
        return
      }

      const response = await fetch('http://localhost:8000/api/admin/check_auth', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setAuthState({
          isAuthenticated: true,
          isAdmin: true,
          user: data.data.user,
          loading: false
        })
      } else {
        setAuthState({
          isAuthenticated: false,
          isAdmin: false,
          user: null,
          loading: false
        })
      }
    } catch (error) {
      setAuthState({
        isAuthenticated: false,
        isAdmin: false,
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
        isAdmin: false,
        user: null,
        loading: false
      })
    }
  }

  return {
    ...authState,
    logout,
    checkAuth: checkAdminAuth,
    refreshAuth: checkAdminAuth
  }
}
