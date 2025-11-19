/**
 * ADMIN LOGIN PAGE
 * 
 * This page handles admin authentication for the admin panel.
 * 
 * BACKEND API ENDPOINT: /api/admin/login
 * - Method: POST
 * - Body: { email: string, password: string }
 * - Response: { success: boolean, data: { user: object, token: string } }
 * 
 * FRONTEND FEATURES:
 * - Form validation
 * - Loading states
 * - Error handling
 * - Automatic redirect to admin dashboard on success
 * - Custom event dispatch for header refresh
 * 
 * TO ADD NEW FEATURES:
 * - Add form fields in the formData state
 * - Update the API call body
 * - Add validation in handleSubmit
 * - Update the UI in the return statement
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './AdminLogin.css'

function AdminLogin() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('http://localhost:8000/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Store token and user data
        localStorage.setItem('token', data.data.token)
        localStorage.setItem('user', JSON.stringify(data.data.user))
        
        // Trigger a custom event to refresh auth state
        window.dispatchEvent(new CustomEvent('authStateChanged'))
        
        // Redirect to admin dashboard
        navigate('/admin')
      } else {
        setError(data.message || 'Admin login failed')
      }
    } catch (err) {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <div className="login-card">
              <div className="text-center mb-4">
                <h2 className="text-primary">Admin Login</h2>
                <p className="text-muted">Electronics Store Control Panel</p>
              </div>
              
              {error && (
                <div className="alert alert-danger">{error}</div>
              )}
              
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="email" className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="password" className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="d-grid mb-3">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Logging in...
                      </>
                    ) : (
                      'Login'
                    )}
                  </button>
                </div>
              </form>
              
              <div className="text-center">
                <Link to="/" className="btn btn-outline-secondary">
                  Back to Store
                </Link>
              </div>
              
              <div className="text-center mt-3">
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminLogin
