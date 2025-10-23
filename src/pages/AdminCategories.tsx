/**
 * ADMIN CATEGORIES PAGE WITH CRUD FUNCTIONALITY
 * 
 * This page provides complete category management functionality for admins.
 * 
 * FEATURES:
 * - Category listing with search
 * - Create new categories
 * - Edit existing categories
 * - Delete categories (with product count validation)
 * - Real-time data updates
 * 
 * API ENDPOINTS:
 * - GET /api/admin/categories - List categories with pagination/filters
 * - POST /api/admin/categories - Create new category
 * - PUT /api/admin/categories/{id} - Update category
 * - DELETE /api/admin/categories/{id} - Delete category
 */
import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import CategoryModal from '../components/CategoryModal'

interface Category {
  category_id: number
  category_name: string
  description?: string
  product_count: number
  created_at: string
}

interface CategoriesResponse {
  categories: Category[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [error, setError] = useState('')

  const fetchCategories = async () => {
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

      const response = await fetch(`http://localhost:8000/api/admin/categories?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch categories')
      }

      setCategories(data.data.categories)
      setTotalPages(data.data.pagination.pages)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [currentPage])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchCategories()
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setCurrentPage(1)
    fetchCategories()
  }

  const handleCreateCategory = () => {
    setSelectedCategory(null)
    setShowModal(true)
  }

  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category)
    setShowModal(true)
  }

  const handleSaveCategory = async (categoryData: Omit<Category, 'category_id' | 'product_count' | 'created_at'>) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const url = selectedCategory 
        ? `http://localhost:8000/api/admin/categories/${selectedCategory.category_id}`
        : 'http://localhost:8000/api/admin/categories'
      
      const method = selectedCategory ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(categoryData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save category')
      }

      // Refresh the categories list
      await fetchCategories()
    } catch (err) {
      throw err // Re-throw to be handled by the modal
    }
  }

  const handleDeleteCategory = async (category: Category) => {
    if (category.product_count > 0) {
      alert(`Cannot delete category "${category.category_name}" because it has ${category.product_count} products. Please move or delete the products first.`)
      return
    }

    if (!confirm(`Are you sure you want to delete category "${category.category_name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`http://localhost:8000/api/admin/categories/${category.category_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete category')
      }

      // Refresh the categories list
      await fetchCategories()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete category')
    }
  }

  if (loading) {
    return (
      <AdminLayout currentPath="/admin/categories">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading categories...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout currentPath="/admin/categories">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Categories Management</h2>
        <button className="btn btn-primary" onClick={handleCreateCategory}>
          <i className="bi bi-plus-circle me-2"></i>
          Add Category
        </button>
      </div>

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
                placeholder="Search categories..."
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

      {/* Categories Grid */}
      <div className="row g-4">
        {categories.map(category => (
          <div key={category.category_id} className="col-md-6 col-lg-4">
            <div className="card h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <h5 className="card-title mb-0">{category.category_name}</h5>
                  <span className="badge bg-primary">
                    {category.product_count} product{category.product_count !== 1 ? 's' : ''}
                  </span>
                </div>
                
                <p className="card-text text-muted mb-3">
                  {category.description || 'No description provided'}
                </p>
                
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <small className="text-muted">
                    Created: {new Date(category.created_at).toLocaleDateString()}
                  </small>
                </div>
                
                <div className="btn-group w-100">
                  <button 
                    className="btn btn-outline-info btn-sm" 
                    title="Edit Category"
                    onClick={() => handleEditCategory(category)}
                  >
                    <i className="bi bi-pencil me-1"></i>
                    Edit
                  </button>
                  <button 
                    className="btn btn-outline-danger btn-sm" 
                    title="Delete Category"
                    onClick={() => handleDeleteCategory(category)}
                  >
                    <i className="bi bi-trash me-1"></i>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {categories.length === 0 && !loading && (
        <div className="text-center py-5">
          <i className="bi bi-tags text-muted" style={{fontSize: '4rem'}}></i>
          <h4 className="mt-3">No categories found</h4>
          <p className="text-muted">
            {searchTerm ? 'Try adjusting your search terms or clear the search to see all categories.' : 'Get started by creating your first category.'}
          </p>
          {searchTerm ? (
            <button className="btn btn-outline-primary" onClick={handleClearSearch}>
              <i className="bi bi-arrow-clockwise me-2"></i>
              Clear Search
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleCreateCategory}>
              <i className="bi bi-plus-circle me-2"></i>
              Add Category
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {categories.length > 0 && (
        <div className="d-flex justify-content-between align-items-center mt-4">
          <div>
            <p className="text-muted mb-0">
              Showing {categories.length} categories
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

      {/* Category Modal */}
      <CategoryModal
        show={showModal}
        onHide={() => setShowModal(false)}
        category={selectedCategory}
        onSave={handleSaveCategory}
      />
    </AdminLayout>
  )
}

export default AdminCategories
