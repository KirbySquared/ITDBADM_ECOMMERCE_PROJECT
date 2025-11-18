/**
 * USER FORM MODAL COMPONENT
 * 
 * This component provides a modal form for creating and editing users.
 * 
 * FEATURES:
 * - Create new users
 * - Edit existing users
 * - Form validation
 * - Loading states
 * - Error handling
 * 
 * USAGE:
 * <UserModal 
 *   show={showModal} 
 *   onHide={() => setShowModal(false)} 
 *   user={selectedUser} 
 *   onSave={handleSaveUser} 
 * />
 */
import { useState, useEffect } from 'react'

interface Branch {
  branch_id: number
  branch_name: string
  address?: string
}

interface User {
  user_id?: number
  username: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  address?: string
  role: string
  branch_id?: number
  password?: string
  created_at?: string
  updated_at?: string
}

interface AdminUserModalProps {
  show: boolean
  onHide: () => void
  user?: User | null
  onSave: (userData: Omit<User, 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>
}

function AdminUserModal({ show, onHide, user, onSave }: AdminUserModalProps) {
  const [formData, setFormData] = useState<User>({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    role: 'user',
    branch_id: undefined,
    password: ''
  })
  const [branches, setBranches] = useState<Branch[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (show) {
      fetchBranches()
    }
  }, [show])

  const fetchBranches = async () => {
    try {
      setLoadingBranches(true)
      const response = await fetch('http://localhost:8000/api/branches', {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setBranches(data.data.branches)
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err)
    } finally {
      setLoadingBranches(false)
    }
  }

  useEffect(() => {
    if (user) {
      setFormData({
        ...user,
        branch_id: user.branch_id || undefined
      })
    } else {
      setFormData({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
        address: '',
        role: 'user',
        branch_id: undefined,
        password: ''
      })
    }
    setErrors({})
  }, [user, show])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: value
      }
      
      // Clear branch_id if role is changed from staff to something else
      if (name === 'role' && value !== 'staff') {
        newData.branch_id = undefined
      }
      
      return newData
    })
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
    
    // Clear branch_id error if role is changed away from staff
    if (name === 'role' && value !== 'staff' && errors.branch_id) {
      setErrors(prev => ({
        ...prev,
        branch_id: ''
      }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.username.trim()) newErrors.username = 'Username is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required'
    if (!formData.last_name.trim()) newErrors.last_name = 'Last name is required'
    
    // Password is required for new users (when user is null/undefined)
    if (!user && !formData.password?.trim()) {
      newErrors.password = 'Password is required'
    }
    
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email format is invalid'
    }
    
    // Staff role requires branch_id
    if (formData.role === 'staff' && (!formData.branch_id || formData.branch_id === 0)) {
      newErrors.branch_id = 'Branch selection is required for staff users'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setLoading(true)
    try {
      // Prepare data for saving (exclude fields that shouldn't be sent)
      const { user_id, created_at, updated_at, ...saveData } = formData
      
      // For existing users, don't send password if it's empty
      if (user && !saveData.password) {
        delete saveData.password
      }
      
      // Only include branch_id if role is staff, otherwise exclude it
      if (saveData.role !== 'staff') {
        delete saveData.branch_id
      } else if (saveData.branch_id) {
        // Ensure branch_id is a number
        saveData.branch_id = parseInt(saveData.branch_id.toString())
      }
      
      await onSave(saveData)
      onHide()
    } catch (error) {
      console.error('Error saving user:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!show) return null

  return (
    <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {user ? 'Edit User' : 'Add New User'}
            </h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label htmlFor="username" className="form-label">Username *</label>
                  <input
                    type="text"
                    className={`form-control ${errors.username ? 'is-invalid' : ''}`}
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                  />
                  {errors.username && <div className="invalid-feedback">{errors.username}</div>}
                </div>
                
                <div className="col-md-6 mb-3">
                  <label htmlFor="email" className="form-label">Email *</label>
                  <input
                    type="email"
                    className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                  {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                </div>
              </div>
              
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label htmlFor="first_name" className="form-label">First Name *</label>
                  <input
                    type="text"
                    className={`form-control ${errors.first_name ? 'is-invalid' : ''}`}
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                  />
                  {errors.first_name && <div className="invalid-feedback">{errors.first_name}</div>}
                </div>
                
                <div className="col-md-6 mb-3">
                  <label htmlFor="last_name" className="form-label">Last Name *</label>
                  <input
                    type="text"
                    className={`form-control ${errors.last_name ? 'is-invalid' : ''}`}
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                  />
                  {errors.last_name && <div className="invalid-feedback">{errors.last_name}</div>}
                </div>
              </div>
              
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label htmlFor="phone" className="form-label">Phone</label>
                  <input
                    type="tel"
                    className="form-control"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="col-md-6 mb-3">
                  <label htmlFor="role" className="form-label">Role</label>
                  <select
                    className="form-select"
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                  >
                    <option value="user">User</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              
              {/* Branch selection - required for staff role */}
              {formData.role === 'staff' && (
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label htmlFor="branch_id" className="form-label">
                      Branch <span className="text-danger">*</span>
                    </label>
                    {loadingBranches ? (
                      <div className="form-control">
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Loading branches...
                      </div>
                    ) : (
                      <select
                        className={`form-select ${errors.branch_id ? 'is-invalid' : ''}`}
                        id="branch_id"
                        name="branch_id"
                        value={formData.branch_id || ''}
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value) : undefined
                          setFormData(prev => ({ ...prev, branch_id: value }))
                          if (errors.branch_id) {
                            setErrors(prev => ({ ...prev, branch_id: '' }))
                          }
                        }}
                        required
                      >
                        <option value="">Select a branch</option>
                        {branches.map(branch => (
                          <option key={branch.branch_id} value={branch.branch_id}>
                            {branch.branch_name}
                          </option>
                        ))}
                      </select>
                    )}
                    {errors.branch_id && <div className="invalid-feedback">{errors.branch_id}</div>}
                    {formData.role === 'staff' && !errors.branch_id && (
                      <div className="form-text">
                        Staff users must be assigned to a specific branch
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Password field */}
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label htmlFor="password" className="form-label">
                    Password {!user && '*'}
                    {user && <small className="text-muted ms-2">(leave empty to keep current password)</small>}
                  </label>
                  <input
                    type="text"
                    className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                    id="password"
                    name="password"
                    value={formData.password || ''}
                    onChange={handleChange}
                    placeholder={user ? "Enter new password to reset (optional)" : "Enter password"}
                    required={!user}
                  />
                  {errors.password && <div className="invalid-feedback">{errors.password}</div>}
                  {user && (
                    <div className="form-text">
                      <i className="bi bi-key me-1"></i>
                      Set a new password for this user. Passwords are encrypted and cannot be viewed.
                    </div>
                  )}
                  {!user && (
                    <div className="form-text">
                      <i className="bi bi-lock me-1"></i>
                      Password will be encrypted using bcrypt (industry standard security)
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mb-3">
                <label htmlFor="address" className="form-label">Address</label>
                <textarea
                  className="form-control"
                  id="address"
                  name="address"
                  rows={3}
                  value={formData.address}
                  onChange={handleChange}
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onHide}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Saving...
                  </>
                ) : (
                  user ? 'Update User' : 'Create User'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default AdminUserModal
