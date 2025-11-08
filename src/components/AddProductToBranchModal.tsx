/**
 * ADD PRODUCT TO BRANCH MODAL COMPONENT
 * 
 * This component provides a modal for adding existing products to branches.
 * 
 * FEATURES:
 * - Select a branch from dropdown
 * - Select any product from the database
 * - Set stock quantity (default 0)
 * - Add/update inventory for product in selected branch
 * 
 * USAGE:
 * <AddProductToBranchModal 
 *   show={showModal} 
 *   onHide={() => setShowModal(false)} 
 *   onInventoryChange={handleInventoryChange} 
 * />
 */
import { useState, useEffect } from 'react'

interface Branch {
  branch_id: number
  branch_name: string
  address?: string
}

interface Product {
  product_id: number
  product_name: string
  brand: string
  model?: string
  category_name: string
  price: number
  currency: string
}

interface AddProductToBranchModalProps {
  show: boolean
  onHide: () => void
  onInventoryChange?: () => void
}

function AddProductToBranchModal({ show, onHide, onInventoryChange }: AddProductToBranchModalProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [selectedBranchId, setSelectedBranchId] = useState<number>(0)
  const [selectedProductId, setSelectedProductId] = useState<number>(0)
  const [stockQuantity, setStockQuantity] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (show) {
      fetchBranches()
      fetchAllProducts()
      // Reset form when modal opens
      setSelectedProductId(0)
      setStockQuantity(0)
      setSearchTerm('')
      setError(null)
      setSuccessMessage(null)
    }
  }, [show])

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
        if (data.data.branches.length > 0 && selectedBranchId === 0) {
          setSelectedBranchId(data.data.branches[0].branch_id)
        }
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err)
    }
  }

  const fetchAllProducts = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      // Fetch all products without branch filter - use all_products=true parameter
      const response = await fetch('http://localhost:8000/api/admin/products?limit=1000&all_products=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch products')
      }

      if (data.success) {
        setProducts(data.data.products || [])
      } else {
        throw new Error(data.message || 'Failed to fetch products')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (selectedBranchId === 0) {
      setError('Please select a branch')
      return
    }

    if (selectedProductId === 0) {
      setError('Please select a product')
      return
    }

    if (stockQuantity < 0) {
      setError('Stock quantity cannot be negative')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const selectedProduct = products.find(p => p.product_id === selectedProductId)
      if (!selectedProduct) {
        throw new Error('Selected product not found')
      }

      const response = await fetch(`http://localhost:8000/api/admin/products/${selectedProductId}/inventory`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch_id: selectedBranchId,
          stock_qty: stockQuantity
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add product to branch')
      }

      // Show success message
      const selectedBranch = branches.find(b => b.branch_id === selectedBranchId)
      const successMsg = `Product "${selectedProduct.product_name}" successfully added to ${selectedBranch?.branch_name || 'branch'} with ${stockQuantity} units`
      setSuccessMessage(successMsg)
      setError(null)
      
      // Reset form after a short delay
      setTimeout(() => {
        setSelectedProductId(0)
        setStockQuantity(0)
        setSearchTerm('')
        setSuccessMessage(null)
        if (branches.length > 0) {
          setSelectedBranchId(branches[0].branch_id)
        }
      }, 2000)

      onInventoryChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product to branch')
    } finally {
      setSaving(false)
    }
  }

  // Filter products based on search term
  const filteredProducts = products.filter(product => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      product.product_name.toLowerCase().includes(search) ||
      product.brand.toLowerCase().includes(search) ||
      (product.model && product.model.toLowerCase().includes(search)) ||
      product.category_name.toLowerCase().includes(search)
    )
  })

  if (!show) return null

  return (
    <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-plus-circle me-2"></i>
              Add Product to Branch
            </h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>
          
          <div className="modal-body">
            {error && (
              <div className="alert alert-danger" role="alert">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}
            {successMessage && (
              <div className="alert alert-success" role="alert">
                <i className="bi bi-check-circle me-2"></i>
                {successMessage}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label htmlFor="branch_id" className="form-label">Branch *</label>
                  <select
                    className="form-select"
                    id="branch_id"
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                    required
                  >
                    <option value={0}>Select a branch</option>
                    {branches.map(branch => (
                      <option key={branch.branch_id} value={branch.branch_id}>
                        {branch.branch_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label htmlFor="stock_qty" className="form-label">Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    id="stock_qty"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(Number(e.target.value))}
                    required
                  />
                  <div className="form-text">
                    <i className="bi bi-info-circle me-1"></i>
                    Default is 0. Set the initial stock quantity for this product in the selected branch.
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="product_search" className="form-label">Search Products</label>
                <input
                  type="text"
                  className="form-control"
                  id="product_search"
                  placeholder="Search by product name, brand, model, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label htmlFor="product_id" className="form-label">Select Product *</label>
                {loading ? (
                  <div className="form-control d-flex align-items-center">
                    <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                    Loading products...
                  </div>
                ) : (
                  <select
                    className="form-select"
                    id="product_id"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(Number(e.target.value))}
                    required
                    size={8}
                    style={{minHeight: '200px'}}
                  >
                    <option value={0}>Select a product</option>
                    {filteredProducts.map(product => (
                      <option key={product.product_id} value={product.product_id}>
                        {product.product_name} - {product.brand} {product.model ? `(${product.model})` : ''} - {product.category_name}
                      </option>
                    ))}
                  </select>
                )}
                {filteredProducts.length === 0 && !loading && (
                  <div className="form-text text-warning">
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    No products found. {searchTerm ? 'Try adjusting your search.' : 'No products available in the database.'}
                  </div>
                )}
                {filteredProducts.length > 0 && (
                  <div className="form-text">
                    <i className="bi bi-info-circle me-1"></i>
                    Showing {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
                    {searchTerm && ` matching "${searchTerm}"`}
                  </div>
                )}
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={onHide}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={saving || selectedBranchId === 0 || selectedProductId === 0}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Adding...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check me-1"></i>
                      Add to Branch
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddProductToBranchModal

