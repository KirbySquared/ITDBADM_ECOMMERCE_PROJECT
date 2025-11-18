/**
 * Token Refresh Utility
 * 
 * Automatically refreshes tokens before they expire and handles expired tokens
 */

interface RefreshResponse {
  success: boolean
  data?: {
    token: string
    user: any
  }
  message?: string
}

/**
 * Check if token is expired or about to expire (within 5 minutes)
 */
export function isTokenExpiringSoon(): boolean {
  const token = localStorage.getItem('token')
  if (!token) return true
  
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    const exp = payload.exp * 1000 // Convert to milliseconds
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000
    
    // Return true if expired or expiring within 5 minutes
    return (exp - now) < fiveMinutes
  } catch (e) {
    return true
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(): boolean {
  const token = localStorage.getItem('token')
  if (!token) return true
  
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    const exp = payload.exp * 1000 // Convert to milliseconds
    const now = Date.now()
    
    return exp < now
  } catch (e) {
    return true
  }
}

/**
 * Refresh the authentication token
 */
export async function refreshToken(): Promise<boolean> {
  const token = localStorage.getItem('token')
  if (!token) return false
  
  try {
    const response = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      // Token can't be refreshed - expired beyond grace period
      if (response.status === 401) {
        // Clear token and redirect to login
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.dispatchEvent(new Event('authStateChanged'))
        
        // Show message and redirect
        if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/admin') && !window.location.pathname.startsWith('/staff')) {
          alert('Your session has expired. Please login again.')
          window.location.href = '/login'
        }
        return false
      }
      return false
    }
    
    const data: RefreshResponse = await response.json()
    
    if (data.success && data.data) {
      // Update token and user data
      localStorage.setItem('token', data.data.token)
      localStorage.setItem('user', JSON.stringify(data.data.user))
      
      // Trigger auth state change
      window.dispatchEvent(new Event('authStateChanged'))
      
      return true
    }
    
    return false
  } catch (error) {
    console.error('Token refresh error:', error)
    return false
  }
}

/**
 * Ensure token is valid before making API calls
 * Returns true if token is valid, false if expired and can't be refreshed
 */
export async function ensureValidToken(): Promise<boolean> {
  // Check if token is expired
  if (isTokenExpired()) {
    // Try to refresh
    const refreshed = await refreshToken()
    if (!refreshed) {
      return false
    }
  } else if (isTokenExpiringSoon()) {
    // Token is expiring soon, refresh it proactively
    await refreshToken()
  }
  
  return true
}

