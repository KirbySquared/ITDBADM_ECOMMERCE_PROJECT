/**
 * ADMIN BRANCHES PAGE WITH CRUD FUNCTIONALITY
 * 
 * This page provides complete branch management functionality for admins.
 * 
 * FEATURES:
 * - Branch listing with search
 * - Create new branches
 * - Edit existing branches
 * - Delete branches (with inventory validation)
 * - Real-time data updates
 * 
 * API ENDPOINTS:
 * - GET /api/admin/branches - List branches with pagination/filters
 * - POST /api/admin/branches - Create new branch
 * - PUT /api/admin/branches/{id} - Update branch
 * - DELETE /api/admin/branches/{id} - Delete branch
 */
import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'

interface Branch {
  branch_id: number
  branch_name: string
  address?: string
}

interface BranchesResponse {
  branches: Branch[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

function AdminBranches() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    branch_name: '',
    address: ''
  })
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const fetchBranches = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      if (!token) {
        setError('No authentication token found')
        return
      }

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10'
      })
      
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`http://localhost:8000/api/admin/branches?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch branches')
      }

      setBranches(data.data.branches)
      setTotalPages(data.data.pagination.pages)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch branches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBranches()
  }, [currentPage])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchBranches()
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setCurrentPage(1)
    fetchBranches()
  }

  const handleCreateBranch = () => {
    setSelectedBranch(null)
    setFormData({
      branch_name: '',
      address: ''
    })
    setFormErrors({})
    setShowModal(true)
  }

  const handleEditBranch = (branch: Branch) => {
    setSelectedBranch(branch)
    setFormData({
      branch_name: branch.branch_name,
      address: branch.address || ''
    })
    setFormErrors({})
    setShowModal(true)
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.branch_name.trim()) {
      newErrors.branch_name = 'Branch name is required'
    }
    
    setFormErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setSaving(true)
    setError('')
    
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const url = selectedBranch 
        ? `http://localhost:8000/api/admin/branches/${selectedBranch.branch_id}`
        : 'http://localhost:8000/api/admin/branches'
      
      const method = selectedBranch ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch_name: formData.branch_name.trim(),
          address: formData.address.trim() || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save branch')
      }

      // Refresh the branches list
      await fetchBranches()
      setShowModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save branch')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBranch = async (branch: Branch) => {
    if (!confirm(`Are you sure you want to delete branch "${branch.branch_name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`http://localhost:8000/api/admin/branches/${branch.branch_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete branch')
      }

      // Refresh the branches list
      await fetchBranches()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete branch')
    }
  }

  if (loading) {
    return (
      <AdminLayout currentPath="/admin/branches">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading branches...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout currentPath="/admin/branches">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Branches Management</h2>
        <button className="btn btn-primary" onClick={handleCreateBranch}>
          <i className="bi bi-plus-circle me-2"></i>
          Add Branch
        </button>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')} aria-label="Close"></button>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch}>
        <div className="row mb-4">
          <div className="col-md-6">
            <div className="input-group">
              <span className="input-group-text">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search branches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  type="button" 
                  className="btn btn-outline-secondary"
                  onClick={handleClearSearch}
                  title="Clear search"
                >
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
          </div>
          <div className="col-md-3">
            <button type="submit" className="btn btn-primary w-100">
              <i className="bi bi-search me-1"></i>
              Search
            </button>
          </div>
          <div className="col-md-3">
            <button 
              type="button" 
              className="btn btn-outline-secondary w-100"
              onClick={handleClearSearch}
            >
              <i className="bi bi-arrow-clockwise me-1"></i>
              Reset
            </button>
          </div>
        </div>
      </form>

      {/* Branches Table */}
      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Branch Name</th>
                  <th>Address</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {branches.map(branch => (
                  <tr key={branch.branch_id}>
                    <td>{branch.branch_id}</td>
                    <td>
                      <strong>{branch.branch_name}</strong>
                    </td>
                    <td>{branch.address || <span className="text-muted">No address</span>}</td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button 
                          className="btn btn-outline-primary" 
                          title="Edit Branch"
                          onClick={() => handleEditBranch(branch)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button 
                          className="btn btn-outline-danger" 
                          title="Delete Branch"
                          onClick={() => handleDeleteBranch(branch)}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {branches.length === 0 && !loading && (
        <div className="text-center py-5">
          <i className="bi bi-shop text-muted" style={{fontSize: '4rem'}}></i>
          <h4 className="mt-3">No branches found</h4>
          <p className="text-muted">
            {searchTerm ? 'Try adjusting your search terms or clear the search to see all branches.' : 'Get started by creating your first branch.'}
          </p>
          {searchTerm ? (
            <button className="btn btn-outline-primary" onClick={handleClearSearch}>
              <i className="bi bi-arrow-clockwise me-2"></i>
              Clear Search
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleCreateBranch}>
              <i className="bi bi-plus-circle me-2"></i>
              Add Branch
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {branches.length > 0 && (
        <div className="d-flex justify-content-between align-items-center mt-4">
          <div>
            <p className="text-muted mb-0">
              Showing {branches.length} branches
            </p>
          </div>
          <nav>
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                <button 
                  className="page-link" 
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
              </li>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                  <button 
                    className="page-link" 
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                </li>
              ))}
              <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                <button 
                  className="page-link" 
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}

      {/* Branch Modal */}
      {showModal && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {selectedBranch ? 'Edit Branch' : 'Add New Branch'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              
              <form onSubmit={handleSaveBranch}>
                <div className="modal-body">
                  {error && (
                    <div className="alert alert-danger" role="alert">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      {error}
                    </div>
                  )}
                  
                  <div className="mb-3">
                    <label htmlFor="branch_name" className="form-label">Branch Name *</label>
                    <input
                      type="text"
                      className={`form-control ${formErrors.branch_name ? 'is-invalid' : ''}`}
                      id="branch_name"
                      value={formData.branch_name}
                      onChange={(e) => {
                        setFormData({ ...formData, branch_name: e.target.value })
                        if (formErrors.branch_name) {
                          setFormErrors({ ...formErrors, branch_name: '' })
                        }
                      }}
                      placeholder="Enter branch name"
                      required
                    />
                    {formErrors.branch_name && <div className="invalid-feedback">{formErrors.branch_name}</div>}
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="address" className="form-label">Address</label>
                    <textarea
                      className="form-control"
                      id="address"
                      rows={3}
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Enter branch address (optional)"
                    />
                  </div>
                </div>
                
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Saving...
                      </>
                    ) : (
                      selectedBranch ? 'Update Branch' : 'Create Branch'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminBranches
