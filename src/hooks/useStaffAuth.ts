/**
 * STAFF AUTHENTICATION HOOK
 * 
 * This hook manages staff authentication state and provides auth-related functions.
 * 
 * FEATURES:
 * - Checks authentication status on mount
 * - Listens for auth state changes (login/logout events)
 * - Validates staff role via API
 * - Provides logout functionality
 * - Exposes refresh function for manual auth checks
 * 
 * API ENDPOINTS USED:
 * - /api/staff/check_auth - Validates staff token and role
 * - /api/auth/logout - Logs out user (called during logout)
 * 
 * EVENTS:
 * - Listens for 'authStateChanged' custom event
 * - Automatically refreshes auth state when event is fired
 */
import { useState, useEffect } from 'react'

interface StaffUser {
  user_id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: string
  branch_id: number
  branch_name: string
}

interface AuthState {
  isAuthenticated: boolean
  isStaff: boolean
  user: StaffUser | null
  loading: boolean
}

export const useStaffAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isStaff: false,
    user: null,
    loading: true
  })

  useEffect(() => {
    checkStaffAuth()
    
    // Listen for auth state changes (e.g., after login)
    const handleAuthStateChange = () => {
      checkStaffAuth()
    }
    
    window.addEventListener('authStateChanged', handleAuthStateChange)
    
    return () => {
      window.removeEventListener('authStateChanged', handleAuthStateChange)
    }
  }, [])

  const checkStaffAuth = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setAuthState({
          isAuthenticated: false,
          isStaff: false,
          user: null,
          loading: false
        })
        return
      }

      const response = await fetch('http://localhost:8000/api/staff/check_auth', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setAuthState({
          isAuthenticated: true,
          isStaff: true,
          user: data.data.user,
          loading: false
        })
      } else {
        setAuthState({
          isAuthenticated: false,
          isStaff: false,
          user: null,
          loading: false
        })
      }
    } catch (error) {
      setAuthState({
        isAuthenticated: false,
        isStaff: false,
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
        isStaff: false,
        user: null,
        loading: false
      })
    }
  }

  return {
    ...authState,
    logout,
    checkAuth: checkStaffAuth,
    refreshAuth: checkStaffAuth
  }
}

