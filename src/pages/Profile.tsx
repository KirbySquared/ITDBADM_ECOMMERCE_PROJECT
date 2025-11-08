import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import EditProfileModal from '../components/EditProfileModal'
import './Profile.css'

interface User {
  user_id: number
  username: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  address?: string
  branch_id?: number
  branch_name?: string
}

function Profile() {
  const [user, setUser] = useState<User | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Get user data from localStorage
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const userData = JSON.parse(userStr)
      // Ensure phone and address are set to empty string if undefined/null
      setUser({
        ...userData,
        phone: userData.phone || '',
        address: userData.address || ''
      })
    } else {
      // If no user data, redirect to login
      navigate('/login')
    }
  }, [navigate])

  const handleEditProfile = async (userData: Partial<User> & { password?: string }) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token')
      }

      const response = await fetch('http://localhost:8000/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to update profile')
      }

      // Update user data in localStorage
      const updatedUser = data.data.user
      setUser(updatedUser)
      localStorage.setItem('user', JSON.stringify(updatedUser))
      
      // Trigger auth state change
      window.dispatchEvent(new Event('authStateChanged'))
    } catch (error) {
      console.error('Error updating profile:', error)
      throw error
    }
  }

  const handleLogout = async () => {
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
      window.dispatchEvent(new Event('authStateChanged'))
      navigate('/')
    }
  }

  if (!user) {
    return (
      <div className="profile">
        <div className="container">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="profile">
      <div className="container">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1>User Profile</h1>
          <Link to="/" className="btn btn-outline-primary">
            <i className="bi bi-house me-2"></i>
            Back to Home
          </Link>
        </div>
        
        <div className="row g-4">
          <div className="col-md-8">
            <div className="card">
              <div className="card-body">
                <h2 className="mb-4">Account Information</h2>
                
                <div className="info-item">
                  <label><i className="bi bi-person me-2"></i>Username:</label>
                  <span>{user.username}</span>
                </div>
                <div className="info-item">
                  <label><i className="bi bi-person-badge me-2"></i>Full Name:</label>
                  <span>{user.first_name} {user.last_name}</span>
                </div>
                <div className="info-item">
                  <label><i className="bi bi-envelope me-2"></i>Email:</label>
                  <span>{user.email}</span>
                </div>
                {user.phone && (
                  <div className="info-item">
                    <label><i className="bi bi-telephone me-2"></i>Phone:</label>
                    <span>{user.phone}</span>
                  </div>
                )}
                {user.address && (
                  <div className="info-item">
                    <label><i className="bi bi-geo-alt me-2"></i>Address:</label>
                    <span>{user.address}</span>
                  </div>
                )}
                {user.branch_name && (
                  <div className="info-item">
                    <label><i className="bi bi-shop me-2"></i>Nearest Branch:</label>
                    <span>{user.branch_name}</span>
                  </div>
                )}
                {!user.branch_name && (
                  <div className="info-item">
                    <label><i className="bi bi-shop me-2"></i>Nearest Branch:</label>
                    <span className="text-muted">Not selected</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h2 className="mb-4">Account Actions</h2>
                <div className="d-grid gap-2">
                  <button 
                    className="btn btn-primary"
                    onClick={() => setShowEditModal(true)}
                  >
                    <i className="bi bi-pencil me-2"></i>
                    Edit Profile
                  </button>
                  <Link to="/products" className="btn btn-outline-primary">
                    <i className="bi bi-box-seam me-2"></i>
                    Browse Products
                  </Link>
                  <Link to="/cart" className="btn btn-outline-primary">
                    <i className="bi bi-cart me-2"></i>
                    View Cart
                  </Link>
                  <button className="btn btn-danger" onClick={handleLogout}>
                    <i className="bi bi-box-arrow-right me-2"></i>
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {user && (
        <EditProfileModal
          show={showEditModal}
          onHide={() => setShowEditModal(false)}
          user={user}
          onSave={handleEditProfile}
        />
      )}
    </div>
  )
}

export default Profile
