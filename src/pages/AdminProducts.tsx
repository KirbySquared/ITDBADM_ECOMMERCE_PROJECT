/**
 * ADMIN PRODUCTS PAGE WITH CRUD FUNCTIONALITY
 * 
 * This page provides complete product management functionality for admins.
 * 
 * FEATURES:
 * - Product listing with search and filters
 * - Create new products
 * - Edit existing products
 * - Delete products
 * - Stock management
 * - Category integration
 * - Real-time data updates
 * 
 * API ENDPOINTS:
 * - GET /api/admin/products - List products with pagination/filters
 * - POST /api/admin/products - Create new product
 * - PUT /api/admin/products/{id} - Update product
 * - DELETE /api/admin/products/{id} - Delete product
 */
import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import AdminProductModal from '../components/AdminProductModal'
import AddProductToBranchModal from '../components/AddProductToBranchModal'
import { formatPrice } from '../utils/currency'
import { useAdminNotification } from '../context/AdminNotificationContext'
import { useCurrency } from '../context/CurrencyContext'

interface Product {
  product_id: number
  category_id: number
  product_name: string
  brand: string
  model?: string
  description?: string
  price: number
  currency: string
  stock_quantity: number
  specifications?: any
  images?: Array<{
    image_id: number
    image_url: string
    alt_text?: string
    is_primary: boolean
    sort_order: number
    created_at: string
  }>
  category_name: string
  branch_id?: number
  branch_name?: string
  is_unassigned?: number
  created_at: string
  updated_at?: string
}

interface Category {
  category_id: number
  category_name: string
}


interface Branch {
  branch_id: number
  branch_name: string
  address?: string
}

function AdminProducts() {
  const { showSuccess } = useAdminNotification()
  const { currency } = useCurrency()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<number>(1) // Default to branch 1 (0 = no branch)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [showAddToBranchModal, setShowAddToBranchModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch('http://localhost:8000/api/admin/categories', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setCategories(data.data.categories)
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    }
  }

  const fetchBranches = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/branches', {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setBranches(data.data.branches)
        // Set default branch if available
        if (data.data.branches.length > 0 && !selectedBranchId) {
          setSelectedBranchId(data.data.branches[0].branch_id)
        }
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err)
    }
  }

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      if (!token) {
        setError('No authentication token found')
        return
      }

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        branch_id: selectedBranchId.toString(),
        currency: currency
      })
      
      if (searchTerm) params.append('search', searchTerm)
      if (selectedCategory !== 'all') params.append('category', selectedCategory)

      const response = await fetch(`http://localhost:8000/api/admin/products?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch products')
      }

      setProducts(data.data.products)
      setTotalPages(data.data.pagination.pages)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
    fetchBranches()
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [currentPage, selectedBranchId, currency])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchProducts()
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setSelectedCategory('all')
    setCurrentPage(1)
    fetchProducts()
  }

  const handleCreateProduct = () => {
    setSelectedProduct(null)
    setShowModal(true)
  }

  const handleEditProduct = async (product: Product) => {
    try {
      // Fetch full product details - will use branch_id from product_inventory
      const token = localStorage.getItem('token')
      if (!token) {
        setError('No authentication token found')
        return
      }

      // Try to get product with the selected branch, but backend will use actual branch_id from inventory
      // If selectedBranchId is 0, pass it to get product without inventory data
      const response = await fetch(`http://localhost:8000/api/admin/products/${product.product_id}?branch_id=${selectedBranchId}&currency=${currency}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSelectedProduct(data.data)
        setShowModal(true)
      } else {
        setError(data.message || 'Failed to fetch product details')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch product details')
    }
  }

  const handleSaveProduct = async (productData: Omit<Product, 'product_id' | 'category_name' | 'created_at' | 'updated_at'>) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const url = selectedProduct 
        ? `http://localhost:8000/api/admin/products/${selectedProduct.product_id}`
        : `http://localhost:8000/api/admin/products?branch_id=0`
      
      const method = selectedProduct ? 'PUT' : 'POST'

      // For new products, always set branch_id to 0 (no branch assignment)
      // Admins will add products to branches later using "Add Product to Branch" modal
      // For updates, use branch_id from product data (from inventory)
      const productDataWithBranch = {
        ...productData,
        branch_id: selectedProduct && productData.branch_id ? productData.branch_id : 0
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productDataWithBranch)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save product')
      }

      // Refresh the products list
      await fetchProducts()
      
      // Show success message using context
      showSuccess(selectedProduct ? 'Product updated successfully!' : 'Product created successfully!')
      setError(null)
    } catch (err) {
      throw err // Re-throw to be handled by the modal
    }
  }

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Are you sure you want to delete product "${product.product_name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`http://localhost:8000/api/admin/products/${product.product_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete product')
      }

      // Refresh the products list
      await fetchProducts()
      
      // Show success message using context
      showSuccess(`Product "${product.product_name}" deleted successfully!`)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product')
    }
  }

  if (loading) {
    return (
      <AdminLayout currentPath="/admin/products">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading products...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout currentPath="/admin/products">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Products Management</h2>
        <button className="btn btn-primary" onClick={handleCreateProduct}>
          <i className="bi bi-plus-circle me-2"></i>
          Add Product
        </button>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close"></button>
        </div>
      )}

          {/* Search and Filters */}
          <form onSubmit={handleSearch}>
            <div className="row mb-3">
              <div className="col-md-4">
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="bi bi-search"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary"
                      onClick={() => setSearchTerm('')}
                      title="Clear search"
                    >
                      <i className="bi bi-x"></i>
                    </button>
                  )}
                </div>
              </div>
              <div className="col-md-3">
                <select
                  className="form-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category.category_id} value={category.category_name}>
                      {category.category_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
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
            <div className="row mb-4">
              <div className="col-md-4">
                <label className="form-label">Filter by Branch</label>
                <select
                  className="form-select"
                  value={selectedBranchId}
                  onChange={(e) => {
                    setSelectedBranchId(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                >
                  <option value={0}>All Products</option>
                  {branches.map(branch => (
                    <option key={branch.branch_id} value={branch.branch_id}>
                      {branch.branch_name}
                    </option>
                  ))}
                </select>
                <div className="form-text">
                  <i className="bi bi-info-circle me-1"></i>
                  {selectedBranchId === 0 
                    ? 'View all products in the master catalog. Products without branch assignment are marked as "Unassigned"'
                    : 'Select a branch to view and manage products for that branch'}
                </div>
              </div>
              <div className="col-md-4">
                <label className="form-label">Inventory Management</label>
                <div>
                  <button
                    type="button"
                    className="btn btn-info w-100"
                    onClick={() => setShowAddToBranchModal(true)}
                  >
                    <i className="bi bi-box-seam me-2"></i>
                    Add Product to Branch
                  </button>
                  <div className="form-text">
                    <i className="bi bi-info-circle me-1"></i>
                    Add existing products to any branch with stock quantity
                  </div>
                </div>
              </div>
            </div>
          </form>

      {/* Products Table */}
      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Product Name</th>
                  <th>Brand</th>
                  <th>Price & Currency</th>
                  {selectedBranchId !== 0 && (
                    <>
                      <th>
                        Stock
                        <small className="text-muted d-block" style={{fontSize: '0.7rem', fontWeight: 'normal'}}>
                          ({branches.find(b => b.branch_id === selectedBranchId)?.branch_name || 'Branch'})
                        </small>
                      </th>
                      <th>Branch</th>
                    </>
                  )}
                  <th>Category</th>
                  <th>Images</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.product_id}>
                    <td>{product.product_id}</td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        {product.images && product.images.length > 0 ? (
                          <img 
                            src={product.images.find(img => img.is_primary)?.image_url || product.images[0].image_url} 
                            alt={product.product_name}
                            className="rounded"
                            style={{ width: '32px', height: '32px', objectFit: 'cover' }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div 
                            className="bg-light rounded d-flex align-items-center justify-content-center"
                            style={{ width: '32px', height: '32px' }}
                          >
                            <i className="bi bi-image text-muted" style={{fontSize: '0.8rem'}}></i>
                          </div>
                        )}
                        <div>
                          <div className="d-flex align-items-center gap-2">
                            <strong>{product.product_name}</strong>
                            {selectedBranchId === 0 && product.is_unassigned === 1 && (
                              <span className="badge bg-warning text-dark">
                                <i className="bi bi-exclamation-triangle me-1"></i>
                                Unassigned
                              </span>
                            )}
                          </div>
                          {product.model && <div><small className="text-muted">{product.model}</small></div>}
                        </div>
                      </div>
                    </td>
                    <td>{product.brand}</td>
                    <td>
                      {product.price && product.currency 
                        ? formatPrice(Number(product.price), product.currency) 
                        : 'N/A'}
                    </td>
                    {selectedBranchId !== 0 && (
                      <>
                        <td>
                          <span className={`badge ${
                            (product.stock_quantity ?? 0) < 10 ? 'bg-danger' : 
                            (product.stock_quantity ?? 0) < 20 ? 'bg-warning' : 'bg-success'
                          }`}>
                            {product.stock_quantity ?? 0}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-info">
                            {product.branch_name || `Branch #${product.branch_id || selectedBranchId}`}
                          </span>
                        </td>
                      </>
                    )}
                    <td>{product.category_name}</td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        {product.images && product.images.length > 0 ? (
                          <img 
                            src={product.images.find(img => img.is_primary)?.image_url || product.images[0].image_url} 
                            alt={product.product_name}
                            className="rounded"
                            style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div 
                            className="bg-light rounded d-flex align-items-center justify-content-center"
                            style={{ width: '40px', height: '40px' }}
                          >
                            <i className="bi bi-image text-muted"></i>
                          </div>
                        )}
                        <div>
                          <small className="text-muted d-block">
                            {product.images ? product.images.length : 0} image{product.images && product.images.length !== 1 ? 's' : ''}
                          </small>
                          {product.images && product.images.some(img => img.is_primary) && (
                            <small className="text-success">
                              <i className="bi bi-star-fill me-1"></i>
                              Primary set
                            </small>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{new Date(product.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button 
                          className="btn btn-outline-primary" 
                          title="Edit Product"
                          onClick={() => handleEditProduct(product)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button 
                          className="btn btn-outline-danger" 
                          title="Delete Product"
                          onClick={() => handleDeleteProduct(product)}
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
            Showing {products.length} products
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

      {/* Product Modal */}
        <AdminProductModal
        show={showModal}
        onHide={() => setShowModal(false)}
        product={selectedProduct}
        categories={categories}
        selectedBranchId={selectedBranchId}
        onSave={handleSaveProduct}
      />

      {/* Add Product to Branch Modal */}
      <AddProductToBranchModal
        show={showAddToBranchModal}
        onHide={() => setShowAddToBranchModal(false)}
        onInventoryChange={() => {
          fetchProducts() // Refresh products list after inventory change
        }}
      />
    </AdminLayout>
  )
}

export default AdminProducts
