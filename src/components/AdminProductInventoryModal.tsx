/**
 * ADMIN PRODUCT INVENTORY MODAL COMPONENT
 * 
 * This component provides a modal for managing product inventory across different branches.
 * 
 * FEATURES:
 * - View current inventory for all branches
 * - Add inventory to a branch
 * - Update inventory for a branch
 * - Remove inventory from a branch
 * 
 * USAGE:
 * <AdminProductInventoryModal 
 *   show={showModal} 
 *   onHide={() => setShowModal(false)} 
 *   productId={productId}
 *   productName={productName}
 *   onInventoryChange={handleInventoryChange} 
 * />
 */
import { useState, useEffect } from 'react'

interface Branch {
  branch_id: number
  branch_name: string
  address?: string
}

interface InventoryEntry {
  branch_id: number
  branch_name: string
  stock_qty: number
}

interface AdminProductInventoryModalProps {
  show: boolean
  onHide: () => void
  productId: number
  productName: string
  onInventoryChange?: () => void
}

function AdminProductInventoryModal({ show, onHide, productId, productName, onInventoryChange }: AdminProductInventoryModalProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [inventory, setInventory] = useState<InventoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedBranchId, setSelectedBranchId] = useState<number>(0)
  const [stockQuantity, setStockQuantity] = useState<number>(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (show && productId) {
      fetchBranches()
      fetchInventory()
    }
  }, [show, productId])

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

  const fetchInventory = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`http://localhost:8000/api/admin/products/${productId}/inventory`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch inventory')
      }

      setInventory(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveInventory = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (selectedBranchId === 0) {
      setError('Please select a branch')
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

      const response = await fetch(`http://localhost:8000/api/admin/products/${productId}/inventory`, {
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
        throw new Error(data.message || 'Failed to save inventory')
      }

      // Reset form
      setStockQuantity(0)
      if (branches.length > 0) {
        setSelectedBranchId(branches[0].branch_id)
      }

      // Refresh inventory list
      await fetchInventory()
      onInventoryChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save inventory')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteInventory = async (branchId: number) => {
    if (!confirm(`Are you sure you want to remove inventory for this branch?`)) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`http://localhost:8000/api/admin/products/${productId}/inventory`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch_id: branchId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete inventory')
      }

      // Refresh inventory list
      await fetchInventory()
      onInventoryChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete inventory')
    }
  }

  if (!show) return null

  return (
    <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-box-seam me-2"></i>
              Manage Inventory: {productName}
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

            {/* Add/Update Inventory Form */}
            <div className="card mb-4">
              <div className="card-header">
                <h6 className="mb-0">
                  <i className="bi bi-plus-circle me-2"></i>
                  Add/Update Inventory
                </h6>
              </div>
              <div className="card-body">
                <form onSubmit={handleSaveInventory}>
                  <div className="row g-3">
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
                    <div className="col-md-4">
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
                    </div>
                    <div className="col-md-2 d-flex align-items-end">
                      <button 
                        type="submit" 
                        className="btn btn-primary w-100"
                        disabled={saving}
                      >
                        {saving ? (
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                        ) : (
                          <><i className="bi bi-check me-1"></i>Save</>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* Current Inventory List */}
            <div className="inventory-section">
              <h6 className="mb-3">
                <i className="bi bi-list-ul me-2"></i>
                Current Inventory by Branch
              </h6>
              
              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading inventory...</span>
                  </div>
                  <p className="mt-2 text-muted">Loading inventory...</p>
                </div>
              ) : inventory.length === 0 ? (
                <div className="text-center py-4">
                  <i className="bi bi-inbox text-muted" style={{fontSize: '3rem'}}></i>
                  <p className="text-muted mt-2">No inventory entries found</p>
                  <small className="text-muted">Add inventory using the form above</small>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Branch</th>
                        <th>Stock Quantity</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map(entry => (
                        <tr key={entry.branch_id}>
                          <td>
                            <strong>{entry.branch_name}</strong>
                            <br />
                            <small className="text-muted">Branch ID: {entry.branch_id}</small>
                          </td>
                          <td>
                            <span className={`badge ${
                              entry.stock_qty < 10 ? 'bg-danger' : 
                              entry.stock_qty < 20 ? 'bg-warning' : 'bg-success'
                            } fs-6`}>
                              {entry.stock_qty} units
                            </span>
                          </td>
                          <td>
                            {entry.stock_qty === 0 ? (
                              <span className="badge bg-secondary">Out of Stock</span>
                            ) : entry.stock_qty < 10 ? (
                              <span className="badge bg-danger">Low Stock</span>
                            ) : entry.stock_qty < 20 ? (
                              <span className="badge bg-warning">Medium Stock</span>
                            ) : (
                              <span className="badge bg-success">In Stock</span>
                            )}
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDeleteInventory(entry.branch_id)}
                              title="Remove inventory from this branch"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminProductInventoryModal

