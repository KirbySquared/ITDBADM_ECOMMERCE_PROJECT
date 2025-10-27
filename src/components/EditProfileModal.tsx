import { useState, useEffect } from 'react'

interface User {
  user_id: number
  username: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  address?: string
}

interface EditProfileModalProps {
  show: boolean
  onHide: () => void
  user: User
  onSave: (userData: Partial<User> & { password?: string }) => Promise<void>
}

function EditProfileModal({ show, onHide, user, onSave }: EditProfileModalProps) {
  const [formData, setFormData] = useState({
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone || '',
    address: user.address || '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string>('')

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone || '',
        address: user.address || '',
        password: '',
        confirmPassword: ''
      })
    }
    setErrors({})
    setSubmitError('')
  }, [user, show])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
    if (submitError) setSubmitError('')
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.username.trim()) newErrors.username = 'Username is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required'
    if (!formData.last_name.trim()) newErrors.last_name = 'Last name is required'
    
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email format is invalid'
    }
    
    // Validate password if provided
    if (formData.password) {
      if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters'
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    
    if (!validateForm()) return
    
    setLoading(true)
    try {
      const updateData: any = {
        username: formData.username,
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone || null,
        address: formData.address || null
      }

      // Only include password if it's provided
      if (formData.password) {
        updateData.password = formData.password
      }

      await onSave(updateData)
      onHide()
    } catch (error) {
      console.error('Error saving profile:', error)
      setSubmitError(error instanceof Error ? error.message : 'Failed to update profile. Please try again.')
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
              <i className="bi bi-pencil-square me-2"></i>
              Edit Profile
            </h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {submitError && (
                <div className="alert alert-danger" role="alert">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {submitError}
                </div>
              )}
              {Object.keys(errors).length > 0 && !submitError && (
                <div className="alert alert-warning" role="alert">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Please fix the errors below
                </div>
              )}

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
                    placeholder="(123) 456-7890"
                  />
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
                  placeholder="Enter your address"
                />
              </div>

              {/* Password Change Section */}
              <div className="card border-info">
                <div className="card-header bg-info bg-opacity-10">
                  <h6 className="mb-0">
                    <i className="bi bi-key me-2"></i>
                    Change Password (Optional)
                  </h6>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="password" className="form-label">New Password</label>
                      <input
                        type="password"
                        className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Leave empty to keep current password"
                      />
                      {errors.password && <div className="invalid-feedback">{errors.password}</div>}
                      <div className="form-text">
                        Leave empty if you don't want to change your password
                      </div>
                    </div>
                    
                    <div className="col-md-6 mb-3">
                      <label htmlFor="confirmPassword" className="form-label">Confirm New Password</label>
                      <input
                        type="password"
                        className={`form-control ${errors.confirmPassword ? 'is-invalid' : ''}`}
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="Confirm new password"
                      />
                      {errors.confirmPassword && <div className="invalid-feedback">{errors.confirmPassword}</div>}
                    </div>
                  </div>
                </div>
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
                  <>
                    <i className="bi bi-check-circle me-2"></i>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default EditProfileModal

