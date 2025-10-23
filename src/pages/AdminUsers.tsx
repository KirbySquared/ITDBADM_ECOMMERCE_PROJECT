/**
 * ADMIN USERS PAGE WITH CRUD FUNCTIONALITY
 * 
 * This page provides complete user management functionality for admins.
 * 
 * FEATURES:
 * - User listing with search and filters
 * - Create new users
 * - Edit existing users
 * - Delete users (with confirmation)
 * - User role management
 * - Real-time data updates
 * 
 * API ENDPOINTS:
 * - GET /api/admin/users - List users with pagination/filters
 * - POST /api/admin/users - Create new user
 * - PUT /api/admin/users/{id} - Update user
 * - DELETE /api/admin/users/{id} - Delete user
 */
import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import UserModal from '../components/UserModal'

interface User {
  user_id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: string
  created_at: string
  updated_at?: string
}

interface UsersResponse {
  users: User[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [error, setError] = useState('')

  const fetchUsers = async () => {
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
      if (roleFilter !== 'all') params.append('role', roleFilter)

      const response = await fetch(`http://localhost:8000/api/admin/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch users')
      }

      setUsers(data.data.users)
      setTotalPages(data.data.pagination.pages)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [currentPage, searchTerm, roleFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchUsers()
  }

  const handleCreateUser = () => {
    setSelectedUser(null)
    setShowModal(true)
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setShowModal(true)
  }

  const handleSaveUser = async (userData: User) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const url = selectedUser 
        ? `http://localhost:8000/api/admin/users/${selectedUser.user_id}`
        : 'http://localhost:8000/api/admin/users'
      
      const method = selectedUser ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save user')
      }

      // Refresh the users list
      await fetchUsers()
    } catch (err) {
      throw err // Re-throw to be handled by the modal
    }
  }

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`http://localhost:8000/api/admin/users/${user.user_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete user')
      }

      // Refresh the users list
      await fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const getRoleBadge = (role: string) => {
    return role === 'admin' ? 'badge bg-danger' : 'badge bg-primary'
  }

  if (loading) {
    return (
      <AdminLayout currentPath="/admin/users">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading users...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout currentPath="/admin/users">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Users Management</h2>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-primary">
            <i className="bi bi-download me-2"></i>
            Export Users
          </button>
          <button className="btn btn-primary" onClick={handleCreateUser}>
            <i className="bi bi-person-plus me-2"></i>
            Add User
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <form onSubmit={handleSearch}>
        <div className="row mb-4">
          <div className="col-md-4">
            <div className="input-group">
              <span className="input-group-text">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>
          <div className="col-md-3">
            <button type="submit" className="btn btn-outline-secondary w-100">
              <i className="bi bi-funnel me-1"></i>
              Search
            </button>
          </div>
        </div>
      </form>

      {/* Users Table */}
      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.user_id}>
                    <td>{user.user_id}</td>
                    <td>
                      <strong>{user.username}</strong>
                    </td>
                    <td>{user.first_name} {user.last_name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className={getRoleBadge(user.role)}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button 
                          className="btn btn-outline-primary" 
                          title="Edit User"
                          onClick={() => handleEditUser(user)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button 
                          className="btn btn-outline-danger" 
                          title="Delete User"
                          onClick={() => handleDeleteUser(user)}
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

      {/* Pagination */}
      <div className="d-flex justify-content-between align-items-center mt-4">
        <div>
          <p className="text-muted mb-0">
            Showing {users.length} users
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

      {/* User Modal */}
      <UserModal
        show={showModal}
        onHide={() => setShowModal(false)}
        user={selectedUser}
        onSave={handleSaveUser}
      />
    </AdminLayout>
  )
}

export default AdminUsers
