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
import ProductModal from '../components/ProductModal'

interface Product {
  product_id: number
  category_id: number
  product_name: string
  brand: string
  model?: string
  description?: string
  price: number
  stock_quantity: number
  specifications?: any
  image_url?: string
  category_name: string
  created_at: string
  updated_at?: string
}

interface Category {
  category_id: number
  category_name: string
}


function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [error, setError] = useState('')

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
        limit: '10'
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
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [currentPage, searchTerm, selectedCategory])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchProducts()
  }

  const handleCreateProduct = () => {
    setSelectedProduct(null)
    setShowModal(true)
  }

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product)
    setShowModal(true)
  }

  const handleSaveProduct = async (productData: Omit<Product, 'product_id' | 'category_name' | 'created_at' | 'updated_at'>) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const url = selectedProduct 
        ? `http://localhost:8000/api/admin/products/${selectedProduct.product_id}`
        : 'http://localhost:8000/api/admin/products'
      
      const method = selectedProduct ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save product')
      }

      // Refresh the products list
      await fetchProducts()
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete product')
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
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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
          <div className="col-md-3">
            <button type="submit" className="btn btn-outline-secondary w-100">
              <i className="bi bi-funnel me-1"></i>
              Search
            </button>
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
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Category</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.product_id}>
                    <td>{product.product_id}</td>
                    <td>
                      <div>
                        <strong>{product.product_name}</strong>
                        {product.model && <div><small className="text-muted">{product.model}</small></div>}
                      </div>
                    </td>
                    <td>{product.brand}</td>
                    <td>${product.price.toFixed(2)}</td>
                    <td>
                      <span className={`badge ${
                        product.stock_quantity < 10 ? 'bg-danger' : 
                        product.stock_quantity < 20 ? 'bg-warning' : 'bg-success'
                      }`}>
                        {product.stock_quantity}
                      </span>
                    </td>
                    <td>{product.category_name}</td>
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
      <ProductModal
        show={showModal}
        onHide={() => setShowModal(false)}
        product={selectedProduct}
        categories={categories}
        onSave={handleSaveProduct}
      />
    </AdminLayout>
  )
}

export default AdminProducts
