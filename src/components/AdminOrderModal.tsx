import { useState, useEffect } from 'react'
import { getCurrencyOptions } from '../utils/currency'

interface User {
  user_id: number
  username: string
  email: string
  first_name: string
  last_name: string
}

interface Product {
  product_id: number
  product_name: string
  brand: string
  model?: string
  price: number | string
  currency: string
  stock_quantity: number
  primary_image_url?: string
}

interface OrderItem {
  product_id: number
  quantity: number
  unit_price: number
}

interface OrderFormData {
  user_id: number
  total_amount: number
  currency: string
  status: string
  shipping_address: string
  items: OrderItem[]
}

interface AdminOrderModalProps {
  show: boolean
  onHide: () => void
  order?: {
    order_id?: number
    user_id: number
    total_amount: number
    currency: string
    status: string
    shipping_address: string
    first_name?: string
    last_name?: string
    email?: string
  } | null
  onSave: (orderData: OrderFormData) => Promise<void>
}

function AdminOrderModal({ show, onHide, order, onSave }: AdminOrderModalProps) {
  const [formData, setFormData] = useState({
    user_id: '',
    total_amount: '',
    currency: 'PHP',
    status: 'pending',
    shipping_address: ''
  })
  const [users, setUsers] = useState<User[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Get currency options with custom display logic
  const getCurrencyDisplayOptions = () => {
    return getCurrencyOptions().map(currency => ({
      ...currency,
      displayText: isDropdownOpen ? currency.label : currency.value
    }))
  }

  // Handle dropdown focus/blur events
  const handleDropdownFocus = () => {
    setIsDropdownOpen(true)
  }

  const handleDropdownBlur = () => {
    // Delay to allow option selection
    setTimeout(() => {
      setIsDropdownOpen(false)
    }, 150)
  }

  const handleDropdownClick = () => {
    setIsDropdownOpen(true)
  }

  useEffect(() => {
    if (show) {
      fetchUsers()
      fetchProducts()
      if (order) {
        setFormData({
          user_id: order.user_id.toString(),
          total_amount: order.total_amount.toString(),
          currency: order.currency,
          status: order.status,
          shipping_address: order.shipping_address
        })
        // Load existing order items for editing
        fetchOrderItems(order.order_id!)
      } else {
        setFormData({
          user_id: '',
          total_amount: '',
          currency: 'PHP',
          status: 'pending',
          shipping_address: ''
        })
        setOrderItems([])
      }
      setError(null)
    }
  }, [show, order])

  const fetchOrderItems = async (orderId: number) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:8000/api/admin/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch order details')
      }

      const data = await response.json()
      if (data.success && data.data.items) {
        // Convert order items to the format expected by the modal
        const items = data.data.items.map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: Number(item.unit_price)
        }))
        setOrderItems(items)
      } else {
        setOrderItems([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch order items')
      setOrderItems([])
    }
  }

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:8000/api/admin/users?limit=100', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const data = await response.json()
      if (data.success) {
        setUsers(data.data.users)
      } else {
        throw new Error(data.message || 'Failed to fetch users')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users')
    }
  }

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:8000/api/admin/products?limit=100', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch products')
      }

      const data = await response.json()
      if (data.success) {
        setProducts(data.data.products)
      } else {
        throw new Error(data.message || 'Failed to fetch products')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Calculate total amount from order items
  const calculateTotal = () => {
    return orderItems.reduce((total, item) => total + (Number(item.unit_price) * item.quantity), 0)
  }

  // Add product to order
  const addProductToOrder = (productId: number) => {
    const product = products.find(p => p.product_id === productId)
    if (!product) return

    // Check currency consistency
    if (orderItems.length > 0) {
      const firstProduct = products.find(p => p.product_id === orderItems[0].product_id)
      if (firstProduct && firstProduct.currency !== product.currency) {
        setError(`Cannot mix currencies. All products must be in ${firstProduct.currency}. This product is in ${product.currency}.`)
        return
      }
    }

    const existingItem = orderItems.find(item => item.product_id === productId)
    if (existingItem) {
      // Update quantity if product already exists
      setOrderItems(prev => prev.map(item => 
        item.product_id === productId 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      // Add new product and set currency
      setOrderItems(prev => [...prev, {
        product_id: productId,
        quantity: 1,
        unit_price: Number(product.price)
      }])
      
      // Set the order currency to match the first product's currency
      if (orderItems.length === 0) {
        setFormData(prev => ({
          ...prev,
          currency: product.currency
        }))
      }
    }
  }

  // Remove product from order
  const removeProductFromOrder = (productId: number) => {
    setOrderItems(prev => prev.filter(item => item.product_id !== productId))
  }

  // Clear all order items (useful when changing currency)
  const clearOrderItems = () => {
    setOrderItems([])
    setError(null)
  }

  // Update product quantity
  const updateProductQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeProductFromOrder(productId)
      return
    }
    
    setOrderItems(prev => prev.map(item => 
      item.product_id === productId 
        ? { ...item, quantity }
        : item
    ))
  }

  const validateForm = () => {
    if (!formData.user_id) return 'Please select a customer'
    // Allow empty orders when editing (will trigger deletion)
    if (!order && orderItems.length === 0) return 'Please add at least one product to the order'
    if (!formData.shipping_address.trim()) return 'Please enter shipping address'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    // Check if editing and removing all items
    if (order && orderItems.length === 0) {
      const confirmDelete = window.confirm(
        'This will remove all items from the order and delete it completely. Are you sure you want to continue?'
      )
      if (!confirmDelete) {
        return
      }
    }

    setSaving(true)
    setError(null)

    try {
      const totalAmount = calculateTotal()
      await onSave({
        user_id: parseInt(formData.user_id),
        total_amount: totalAmount,
        currency: formData.currency,
        status: formData.status,
        shipping_address: formData.shipping_address.trim(),
        items: orderItems
      })
      onHide()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save order')
    } finally {
      setSaving(false)
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
            {order ? `Edit Order #${order.order_id}` : 'Create New Order'}
          </h5>
          <button type="button" className="btn-close" onClick={onHide}></button>
        </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger" role="alert">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {error}
                </div>
              )}

              <div className="row g-3">
                <div className="col-md-6">
                  <label htmlFor="user_id" className="form-label">Customer *</label>
                  {users.length === 0 ? (
                    <div className="form-control d-flex align-items-center">
                      <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                      Loading customers...
                    </div>
                  ) : (
                    <select
                      className="form-select"
                      id="user_id"
                      name="user_id"
                      value={formData.user_id}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select a customer</option>
                      {users.map(user => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.first_name} {user.last_name} ({user.email})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="col-md-6">
                  <label className="form-label">Currency</label>
                  <select
                    className="form-select"
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    onFocus={handleDropdownFocus}
                    onBlur={handleDropdownBlur}
                    onClick={handleDropdownClick}
                    disabled={orderItems.length > 0}
                  >
                    {getCurrencyDisplayOptions().map(currency => (
                      <option key={currency.value} value={currency.value}>
                        {currency.displayText}
                      </option>
                    ))}
                  </select>
                  {orderItems.length > 0 && (
                    <small className="text-muted">
                      Currency is locked to match the products in this order
                    </small>
                  )}
                </div>

                <div className="col-md-6">
                  <label className="form-label">Total Amount</label>
                  <div className="form-control-plaintext fw-bold fs-5">
                    {formData.currency} {calculateTotal().toFixed(2)}
                  </div>
                </div>

                <div className="col-md-6">
                  <label htmlFor="status" className="form-label">Status</label>
                  <select
                    className="form-select"
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Product Selection */}
                <div className="col-12">
                  <label className="form-label">Add Products to Order</label>
                  {orderItems.length === 0 && (
                    <div className="alert alert-info mb-3">
                      <i className="bi bi-info-circle me-2"></i>
                      Select products to add to this order. The currency will be automatically set based on the first product selected.
                    </div>
                  )}
                  <div className="row g-2">
                    {products.map(product => {
                      // Check if this product's currency matches the order currency
                      const isCompatible = orderItems.length === 0 || 
                        (orderItems.length > 0 && 
                         products.find(p => p.product_id === orderItems[0].product_id)?.currency === product.currency)
                      
                      return (
                        <div key={product.product_id} className="col-md-6 col-lg-4">
                          <div className={`card h-100 ${!isCompatible ? 'opacity-50' : ''}`}>
                            <div className="card-body p-2">
                              <div className="d-flex align-items-center">
                                {product.primary_image_url && (
                                  <img 
                                    src={product.primary_image_url} 
                                    alt={product.product_name}
                                    className="me-2"
                                    style={{width: '40px', height: '40px', objectFit: 'cover'}}
                                  />
                                )}
                                <div className="flex-grow-1">
                                  <h6 className="card-title mb-1">{product.product_name}</h6>
                                  <small className="text-muted">{product.brand}</small>
                                  <div className="fw-bold text-primary">
                                    {product.currency} {Number(product.price).toFixed(2)}
                                  </div>
                                  {!isCompatible && orderItems.length > 0 && (
                                    <small className="text-danger">
                                      Different currency
                                    </small>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className={`btn btn-sm ${isCompatible ? 'btn-outline-primary' : 'btn-outline-secondary'}`}
                                  onClick={() => addProductToOrder(product.product_id)}
                                  disabled={!isCompatible}
                                  title={!isCompatible ? 'Cannot mix currencies in one order' : 'Add to order'}
                                >
                                  <i className="bi bi-plus"></i>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Order Items */}
                {orderItems.length > 0 ? (
                  <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <label className="form-label mb-0">Order Items</label>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={clearOrderItems}
                        title="Clear all items and reset currency"
                      >
                        <i className="bi bi-trash me-1"></i>
                        Clear Order
                      </button>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Unit Price</th>
                            <th>Quantity</th>
                            <th>Subtotal</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderItems.map(item => {
                            const product = products.find(p => p.product_id === item.product_id)
                            return (
                              <tr key={item.product_id}>
                                <td>
                                  <div className="d-flex align-items-center">
                                    {product?.primary_image_url && (
                                      <img 
                                        src={product.primary_image_url} 
                                        alt={product.product_name}
                                        className="me-2"
                                        style={{width: '30px', height: '30px', objectFit: 'cover'}}
                                      />
                                    )}
                                    <div>
                                      <div className="fw-bold">{product?.product_name}</div>
                                      <small className="text-muted">{product?.brand}</small>
                                    </div>
                                  </div>
                                </td>
                                <td>{formData.currency} {Number(item.unit_price).toFixed(2)}</td>
                                <td>
                                  <div className="input-group input-group-sm" style={{width: '100px'}}>
                                    <button
                                      type="button"
                                      className="btn btn-outline-secondary"
                                      onClick={() => updateProductQuantity(item.product_id, item.quantity - 1)}
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      className="form-control text-center"
                                      value={item.quantity}
                                      onChange={(e) => updateProductQuantity(item.product_id, parseInt(e.target.value) || 0)}
                                      min="1"
                                    />
                                    <button
                                      type="button"
                                      className="btn btn-outline-secondary"
                                      onClick={() => updateProductQuantity(item.product_id, item.quantity + 1)}
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="fw-bold">
                                  {formData.currency} {(Number(item.unit_price) * item.quantity).toFixed(2)}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeProductFromOrder(item.product_id)}
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : order ? (
                  <div className="col-12">
                    <div className="alert alert-warning">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      <strong>Warning:</strong> This order has no items. Saving will delete this order completely.
                    </div>
                  </div>
                ) : null}

                <div className="col-12">
                  <label htmlFor="shipping_address" className="form-label">Shipping Address *</label>
                  <textarea
                    className="form-control"
                    id="shipping_address"
                    name="shipping_address"
                    value={formData.shipping_address}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Enter complete shipping address..."
                    required
                  />
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onHide}>
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    {order ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <i className={`bi ${order ? 'bi-check-circle' : 'bi-plus-circle'} me-2`}></i>
                    {order ? 'Update Order' : 'Create Order'}
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

export default AdminOrderModal
