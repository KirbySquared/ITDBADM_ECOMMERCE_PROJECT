import { useState, useEffect } from 'react'
import StaffLayout from '../components/StaffLayout'
import { formatPrice } from '../utils/currency'

interface Product {
  product_id: number
  product_name: string
  brand: string
  model?: string
  price: number
  currency: string
  category_name: string
  stock_quantity: number
  product_image?: string
}

function StaffInventory() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  
  // Modal states
  const [showAddStockModal, setShowAddStockModal] = useState(false)
  const [showDamageModal, setShowDamageModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [stockQuantity, setStockQuantity] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchInventory()
  }, [currentPage])

  const fetchInventory = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm })
      })

      const response = await fetch(`http://localhost:8000/api/staff/inventory?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch inventory')
      }

      const data = await response.json()
      if (data.success) {
        setProducts(data.data.products)
        setTotalPages(data.data.pagination.pages)
      } else {
        throw new Error(data.message || 'Failed to fetch inventory')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory')
    } finally {
      setLoading(false)
    }
  }

  const handleAddStock = (product: Product) => {
    setSelectedProduct(product)
    setStockQuantity('')
    setShowAddStockModal(true)
  }

  const handleMarkDamaged = (product: Product) => {
    setSelectedProduct(product)
    setStockQuantity('')
    setShowDamageModal(true)
  }

  const submitAddStock = async () => {
    if (!selectedProduct || !stockQuantity || parseInt(stockQuantity) <= 0) {
      setError('Please enter a valid quantity')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:8000/api/staff/inventory/${selectedProduct.product_id}/add-stock`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quantity: parseInt(stockQuantity) })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to add stock')
      }

      const data = await response.json()
      if (data.success) {
        setShowAddStockModal(false)
        setSelectedProduct(null)
        setStockQuantity('')
        await fetchInventory()
      } else {
        throw new Error(data.message || 'Failed to add stock')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add stock')
    } finally {
      setSaving(false)
    }
  }

  const submitMarkDamaged = async () => {
    if (!selectedProduct || !stockQuantity || parseInt(stockQuantity) <= 0) {
      setError('Please enter a valid quantity')
      return
    }

    if (parseInt(stockQuantity) > selectedProduct.stock_quantity) {
      setError('Cannot mark more items as damaged than available stock')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:8000/api/staff/inventory/${selectedProduct.product_id}/damage`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quantity: parseInt(stockQuantity) })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to mark items as damaged')
      }

      const data = await response.json()
      if (data.success) {
        setShowDamageModal(false)
        setSelectedProduct(null)
        setStockQuantity('')
        await fetchInventory()
      } else {
        throw new Error(data.message || 'Failed to mark items as damaged')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark items as damaged')
    } finally {
      setSaving(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchInventory()
  }

  const getStockBadge = (quantity: number) => {
    if (quantity === 0) {
      return <span className="badge bg-danger">Out of Stock</span>
    } else if (quantity < 10) {
      return <span className="badge bg-warning">Low Stock ({quantity})</span>
    } else {
      return <span className="badge bg-success">{quantity} units</span>
    }
  }

  return (
    <StaffLayout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">
          <i className="bi bi-box-seam me-2"></i>
          Inventory Management
        </h1>
      </div>

      {/* Search */}
      <div className="card mb-4">
        <div className="card-body">
          <form onSubmit={handleSearch} className="row g-3">
            <div className="col-md-10">
              <label htmlFor="search" className="form-label">Search Products</label>
              <input
                type="text"
                className="form-control"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by product name, brand, or model..."
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">&nbsp;</label>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary w-100">
                  <i className="bi bi-search me-1"></i>
                  Search
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        <div className="card-header">
          <h6 className="mb-0">
            <i className="bi bi-list-ul me-2"></i>
            Products Inventory
          </h6>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2 text-muted">Loading inventory...</p>
            </div>
          ) : error ? (
            <div className="alert alert-danger m-3" role="alert">
              <i className="bi bi-exclamation-triangle me-2"></i>
              {error}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-4">
              <i className="bi bi-box-seam text-muted" style={{fontSize: '3rem'}}></i>
              <p className="text-muted mt-2">No products found</p>
              <small className="text-muted">Try adjusting your search criteria</small>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.product_id}>
                      <td>
                        <div className="d-flex align-items-center">
                          {product.product_image ? (
                            <img 
                              src={product.product_image} 
                              alt={product.product_name}
                              className="me-2 rounded"
                              style={{width: '50px', height: '50px', objectFit: 'cover'}}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                              }}
                            />
                          ) : (
                            <div 
                              className="me-2 bg-light rounded d-flex align-items-center justify-content-center"
                              style={{width: '50px', height: '50px'}}
                            >
                              <i className="bi bi-image text-muted"></i>
                            </div>
                          )}
                          <div>
                            <div className="fw-bold">{product.product_name}</div>
                            <small className="text-muted">{product.brand} {product.model}</small>
                          </div>
                        </div>
                      </td>
                      <td>{product.category_name}</td>
                      <td>{formatPrice(product.price, product.currency)}</td>
                      <td>{getStockBadge(product.stock_quantity)}</td>
                      <td>
                        <div className="btn-group btn-group-sm" role="group">
                          <button 
                            className="btn btn-outline-success" 
                            title="Add Stock"
                            onClick={() => handleAddStock(product)}
                          >
                            <i className="bi bi-plus-circle"></i>
                          </button>
                          <button 
                            className="btn btn-outline-danger" 
                            title="Mark as Damaged"
                            onClick={() => handleMarkDamaged(product)}
                            disabled={product.stock_quantity === 0}
                          >
                            <i className="bi bi-x-circle"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="card-footer">
            <nav aria-label="Inventory pagination">
              <ul className="pagination pagination-sm mb-0 justify-content-center">
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
      </div>

      {/* Add Stock Modal */}
      {showAddStockModal && selectedProduct && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-plus-circle me-2"></i>
                  Add Stock - {selectedProduct.product_name}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowAddStockModal(false)}></button>
              </div>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}
                <div className="mb-3">
                  <label htmlFor="stockQuantity" className="form-label">Quantity to Add</label>
                  <input
                    type="number"
                    className="form-control"
                    id="stockQuantity"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    min="1"
                    required
                    disabled={saving}
                  />
                  <small className="text-muted">Current stock: {selectedProduct.stock_quantity} units</small>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowAddStockModal(false)
                    setSelectedProduct(null)
                    setStockQuantity('')
                    setError(null)
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-success" 
                  onClick={submitAddStock}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Adding...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-2"></i>
                      Add Stock
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mark Damaged Modal */}
      {showDamageModal && selectedProduct && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-x-circle me-2"></i>
                  Mark as Damaged - {selectedProduct.product_name}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowDamageModal(false)}></button>
              </div>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}
                <div className="mb-3">
                  <label htmlFor="damageQuantity" className="form-label">Quantity to Mark as Damaged</label>
                  <input
                    type="number"
                    className="form-control"
                    id="damageQuantity"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    min="1"
                    max={selectedProduct.stock_quantity}
                    required
                    disabled={saving}
                  />
                  <small className="text-muted">Current stock: {selectedProduct.stock_quantity} units</small>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowDamageModal(false)
                    setSelectedProduct(null)
                    setStockQuantity('')
                    setError(null)
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={submitMarkDamaged}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-x-circle me-2"></i>
                      Mark as Damaged
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </StaffLayout>
  )
}

export default StaffInventory

