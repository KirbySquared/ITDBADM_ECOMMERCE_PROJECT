import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api/config'
import { formatPrice } from '../utils/currency'
import './Checkout.css'

type Branch = { branch_id: number; branch_name: string; address?: string }
type CartItem = {
  cart_id: number
  product_id: number
  quantity: number
  product_name: string
  price: number
  display_price?: number
  currency: string
  primary_image_url?: string
  brand?: string
  model?: string
}

// Payment method configuration with image placeholders
const paymentMethods = [
  {
    id: 'credit_card',
    name: 'Credit Card',
    icon: '💳',
    imageUrl: 'https://www.nicepng.com/png/detail/53-534638_mastercard-png-mastercard-logo-png-visa-mastercard-logo.png'
  },
  {
    id: 'debit_card',
    name: 'Debit Card',
    icon: '💳',
    imageUrl: 'https://media.philstar.com/images/articles/bdo-metrobank-bpi_2018-04-04_21-53-21.jpg'
  },
  {
    id: 'gcash',
    name: 'GCash',
    icon: '📱',
    imageUrl: 'https://play-lh.googleusercontent.com/qILRk-M7V-QtGSSLdyCj5hMIZMWbZwFLh-CePfKxrcisWSxXqZEGb_EQ9lVfEqWc6J-py5wAU-0mbqTejJAlhw' 
  },
  {
    id: 'maya',
    name: 'Maya',
    icon: '📱',
    imageUrl: 'https://play-lh.googleusercontent.com/fdQjxsIO8BTLaw796rQPZtLEnGEV8OJZJBJvl8dFfZLZcGf613W93z7y9dFAdDhvfqw=w240-h480-rw' 
  },
  {
    id: 'bank_transfer',
    name: 'Bank Transfer',
    icon: '🏦',
    imageUrl: 'https://static.vecteezy.com/system/resources/previews/015/149/520/non_2x/bank-transfer-icon-simple-money-send-vector.jpg' 
  },
  {
    id: 'cod',
    name: 'Cash on Delivery',
    icon: '💰',
    imageUrl: 'https://freemiumicons.com/wp-content/uploads/2023/06/cash-on-delivery-icon-1.png' 
  }
]

function Checkout() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [lock, setLock] = useState<null | {
    lock_id: string
    currency: string
    rate_to_php: number
    locked_at: string
    expires_at?: string
  }>(null)

  const [branches, setBranches] = useState<Branch[]>([])
  const [cart, setCart] = useState<{ items: CartItem[]; subtotal: number; currency: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    address: '',
    city: '',
    zipCode: '',
    fulfillment: 'pickup',      // 'pickup' | 'delivery'
    branchId: '',               // required (stock is per branch)
    paymentMethod: 'credit_card',    // 'credit_card' | 'debit_card' | 'gcash' | 'maya' | 'bank_transfer' | 'cod'
    notes: ''
  })
  
  const branchLocked = !!user?.branch_id

  // Update form data when user data is available
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        firstName: prev.firstName || user.first_name || '',
        lastName: prev.lastName || user.last_name || '',
        email: prev.email || user.email || '',
        address: prev.address || user.address || '',
        branchId: prev.branchId || (user.branch_id?.toString() || '')
      }))
    }
  }, [user])

  // Load currency lock, cart contents, and branches
  useEffect(() => {
    const lockJson = sessionStorage.getItem('checkout_lock')
    if (!lockJson) {
      navigate('/cart')
      return
    }
    try {
      setLock(JSON.parse(lockJson))
    } catch {
      navigate('/cart')
      return
    }

    ;(async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate('/login')
          return
        }

        const [cartRes, branchRes] = await Promise.all([
          fetch(api('/cart'), {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(api('/branches'), {
            headers: { 'Content-Type': 'application/json' }
          })
        ])

        if (cartRes.status === 401) {
          navigate('/login')
          return
        }

        const cartJson = cartRes.ok ? await cartRes.json() : null
        const branchJson = branchRes.ok ? await branchRes.json() : null

        if (cartJson?.success) {
          let allItems = cartJson.data.items || []
          
          // Filter items based on selected items from cart page
          const selectedItemsJson = sessionStorage.getItem('checkout_selected_items')
          if (selectedItemsJson) {
            try {
              const selectedCartIds = new Set(JSON.parse(selectedItemsJson).map((id: any) => Number(id)))
              allItems = allItems.filter((item: any) => selectedCartIds.has(Number(item.cart_id)))
            } catch (e) {
              console.error('Failed to parse selected items:', e)
              // If parsing fails, use all items
            }
          }
          
          // Recalculate subtotal for filtered items
          const filteredSubtotal = allItems.reduce((sum: number, item: any) => {
            const price = item.display_price ?? item.price ?? 0
            return sum + (Number(price) * Number(item.quantity))
          }, 0)
          
          setCart({
            items: allItems,
            subtotal: filteredSubtotal,
            currency: allItems[0]?.currency || cartJson.data.items?.[0]?.currency || 'PHP'
          })
        } else {
          setError('Failed to load cart.')
        }

        if (branchJson?.success) {
          setBranches(branchJson.data.branches || [])
        } else {
          setError(prev => prev ?? 'Failed to load branches.')
        }
      } catch (e) {
        console.error(e)
        setError('Failed to load checkout data.')
      }
    })()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!lock) {
      setError('Currency lock missing. Please return to the cart.')
      return
    }
    
    if (!cart || cart.items.length === 0) {
      setError('Your cart is empty.')
      return
    }
    
    if (!formData.branchId) {
      setError('Please select a branch.')
      return
    }
    
    if (!formData.firstName?.trim()) {
      setError('First name is required.')
      return
    }
    
    if (!formData.lastName?.trim()) {
      setError('Last name is required.')
      return
    }
    
    if (!formData.email?.trim()) {
      setError('Email address is required.')
      return
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email.trim())) {
      setError('Please enter a valid email address.')
      return
    }
    
    if (!formData.paymentMethod) {
      setError('Please select a payment method.')
      return
    }
    
    // Validate delivery address fields if delivery is selected
    if (formData.fulfillment === 'delivery') {
      if (!formData.address?.trim()) {
        setError('Street address is required for delivery.')
        return
      }
      
      if (!formData.city?.trim()) {
        setError('City is required for delivery.')
        return
      }
      
      if (!formData.zipCode?.trim()) {
        setError('ZIP code is required for delivery.')
        return
      }
    }

    setSubmitting(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        navigate('/login')
        return
      }

      // Build payload for the API. Backend will:
      // 1) Verify currency & get conversion rate
      // 2) Validate stock availability
      // 3) Create Orders and Order_Items with ACID transaction
      // 4) Create Payment record
      // 5) Create Order Currency Snapshot
      // 6) Simulate payment (auto-complete non-COD)
      // 7) Deduct stock when payment is completed
      // 8) Log transaction
      // 9) Clear cart
      const payload = {
        currency: lock.currency,
        customer: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email
        },
        fulfillment: {
          type: formData.fulfillment,              // 'pickup' | 'delivery'
          branch_id: Number(formData.branchId),
          address: formData.fulfillment === 'delivery' ? {
            line1: formData.address,
            city: formData.city,
            zip: formData.zipCode
          } : null
        },
        payment: { method: formData.paymentMethod },
        notes: formData.notes || null,
        items: cart.items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.display_price ?? i.price,  // Use display_price if available (converted currency)
          currency: i.currency
        }))
      }

      const res = await fetch(api('/checkout/create-order'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const err = await res.json().catch(()=> ({}))
        throw new Error(err?.message || 'Order failed')
      }

      const data = await res.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Order creation failed')
      }
      
      // Clear the lock and cart
      sessionStorage.removeItem('checkout_lock')
      window.dispatchEvent(new Event('cartUpdated'))

      // Navigate to an order confirmation screen
      navigate(`/orders/${data.data?.order_id ?? 'success'}`, {
        state: { order: data.data, fromCheckout: true }
      })
    } catch (e) {
      console.error(e)
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const showDelivery = formData.fulfillment === 'delivery'

  return (
    <div className="checkout-page">
      <div className="container py-4">
        <div className="row mb-4">
          <div className="col-12">
            <h2 className="fw-bold mb-1">
              <i className="bi bi-cart-check me-2"></i>
              Checkout
            </h2>
            <p className="text-muted">Review your order and complete your purchase</p>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
            <button type="button" className="btn-close" onClick={() => setError(null)}></button>
          </div>
        )}

        <div className="row g-4">
          {/* Left Column - Checkout Form */}
          <div className="col-lg-8">
            <form onSubmit={handleSubmit}>
              {/* Fulfillment Section */}
              <div className="card mb-4 shadow-sm">
                <div className="card-header bg-white border-bottom">
                  <h5 className="mb-0 fw-bold">
                    <i className="bi bi-truck me-2"></i>
                    Delivery Method
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Choose Delivery Option</label>
                      <div className="d-flex gap-3">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="fulfillment"
                            id="pickup"
                            value="pickup"
                            checked={formData.fulfillment === 'pickup'}
                            onChange={handleChange}
                          />
                          <label className="form-check-label" htmlFor="pickup">
                            <i className="bi bi-shop me-1"></i>
                            Store Pickup
                          </label>
                        </div>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="fulfillment"
                            id="delivery"
                            value="delivery"
                            checked={formData.fulfillment === 'delivery'}
                            onChange={handleChange}
                          />
                          <label className="form-check-label" htmlFor="delivery">
                            <i className="bi bi-truck me-1"></i>
                            Delivery
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="branchId" className="form-label fw-semibold">
                        Select Branch <span className="text-danger">*</span>
                      </label>
                      <select
                        id="branchId"
                        name="branchId"
                        className="form-control"
                        value={formData.branchId}
                        onChange={handleChange}
                        required
                        disabled={branchLocked || submitting}
                      >
                        <option value="">Choose a branch...</option>
                        {branches.map(b => (
                          <option key={b.branch_id} value={b.branch_id}>
                            {b.branch_name} {b.address ? `- ${b.address}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="card mb-4 shadow-sm">
                <div className="card-header bg-white border-bottom">
                  <h5 className="mb-0 fw-bold">
                    <i className="bi bi-person me-2"></i>
                    {showDelivery ? 'Shipping Information' : 'Contact Information'}
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label htmlFor="firstName" className="form-label fw-semibold">
                        First Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        className="form-control"
                        value={formData.firstName}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="lastName" className="form-label fw-semibold">
                        Last Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        className="form-control"
                        value={formData.lastName}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="col-12">
                      <label htmlFor="email" className="form-label fw-semibold">
                        Email Address <span className="text-danger">*</span>
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        className="form-control"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    {showDelivery && (
                      <>
                        <div className="col-12">
                          <label htmlFor="address" className="form-label fw-semibold">
                            Street Address <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            id="address"
                            name="address"
                            className="form-control"
                            value={formData.address}
                            onChange={handleChange}
                            required
                            placeholder="House/Unit No., Street, Barangay"
                          />
                        </div>
                        <div className="col-md-6">
                          <label htmlFor="city" className="form-label fw-semibold">
                            City <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            id="city"
                            name="city"
                            className="form-control"
                            value={formData.city}
                            onChange={handleChange}
                            required
                          />
                        </div>
                        <div className="col-md-6">
                          <label htmlFor="zipCode" className="form-label fw-semibold">
                            ZIP Code <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            id="zipCode"
                            name="zipCode"
                            className="form-control"
                            value={formData.zipCode}
                            onChange={handleChange}
                            required
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Method Section */}
              <div className="card mb-4 shadow-sm">
                <div className="card-header bg-white border-bottom">
                  <h5 className="mb-0 fw-bold">
                    <i className="bi bi-credit-card me-2"></i>
                    Payment Method
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row g-3 mb-3">
                    {paymentMethods.map((method) => (
                      <div key={method.id} className="col-md-6 col-lg-4">
                        <div
                          className={`payment-method-card ${
                            formData.paymentMethod === method.id ? 'selected' : ''
                          }`}
                          onClick={() => setFormData(prev => ({ ...prev, paymentMethod: method.id }))}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            id={method.id}
                            value={method.id}
                            checked={formData.paymentMethod === method.id}
                            onChange={handleChange}
                            className="d-none"
                          />
                          <label htmlFor={method.id} className="w-100 mb-0 cursor-pointer">
                            <div className="d-flex align-items-center gap-2">
                              {method.imageUrl ? (
                                <img
                                  src={method.imageUrl}
                                  alt={method.name}
                                  className="payment-method-image"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                    const parent = target.parentElement
                                    if (parent) {
                                      const icon = document.createElement('span')
                                      icon.className = 'payment-method-icon'
                                      icon.textContent = method.icon
                                      parent.insertBefore(icon, target)
                                    }
                                  }}
                                />
                              ) : (
                                <span className="payment-method-icon">{method.icon}</span>
                              )}
                              <span className="fw-semibold">{method.name}</span>
                            </div>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <label htmlFor="notes" className="form-label fw-semibold">
                      Order Notes (Optional)
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      className="form-control"
                      value={formData.notes}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Special instructions for your order..."
                    />
                  </div>
                </div>
              </div>

              {/* Submit button inside form */}
              <div className="card mb-4 shadow-sm">
                <div className="card-body">
                  <button
                    type="submit"
                    className="btn btn-primary w-100 btn-lg fw-bold"
                    disabled={submitting || !cart || cart.items.length === 0}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-lock-fill me-2"></i>
                        Complete Order
                      </>
                    )}
                  </button>
                  <p className="text-center small text-muted mt-2 mb-0">
                    <i className="bi bi-shield-check me-1"></i>
                    Secure checkout
                  </p>
                </div>
              </div>
            </form>
          </div>

          {/* Right Column - Order Summary */}
          <div className="col-lg-4">
            <div className="card shadow-sm">
              <div className="card-header bg-primary text-white">
                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-receipt me-2"></i>
                  Order Summary
                </h5>
              </div>
              <div className="card-body">
                {cart && cart.items.length > 0 ? (
                  <>
                    <div className="order-items mb-3">
                      {cart.items.map((item) => (
                        <div key={item.cart_id} className="d-flex gap-3 mb-3 pb-3 border-bottom">
                          {item.primary_image_url && (
                            <img
                              src={item.primary_image_url}
                              alt={item.product_name}
                              className="order-item-image"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZTwvdGV4dD48L3N2Zz4='
                              }}
                            />
                          )}
                          <div className="flex-grow-1">
                            <h6 className="mb-1 fw-semibold">{item.product_name}</h6>
                            {item.brand && (
                              <small className="text-muted d-block">{item.brand} {item.model ? `- ${item.model}` : ''}</small>
                            )}
                            <div className="d-flex justify-content-between align-items-center mt-2">
                              <span className="text-muted small">Qty: {item.quantity}</span>
                              <span className="fw-bold text-primary">
                                {formatPrice((item.display_price ?? item.price) * item.quantity, item.currency)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="order-summary-totals">
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">Subtotal:</span>
                        <span className="fw-semibold">{formatPrice(cart.subtotal, cart.currency)}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">Shipping:</span>
                        <span className="fw-semibold">
                          {formData.fulfillment === 'delivery' ? 'Calculated at checkout' : 'Free (Pickup)'}
                        </span>
                      </div>
                      <hr />
                      <div className="d-flex justify-content-between mb-3">
                        <span className="fw-bold fs-5">Total:</span>
                        <span className="fw-bold fs-5 text-primary">
                          {formatPrice(cart.subtotal, cart.currency)}
                        </span>
                      </div>
                      {lock && (
                        <div className="alert alert-info small mb-3">
                          <div className="d-flex align-items-center">
                            <i className="bi bi-info-circle me-2"></i>
                            <div>
                              <div><strong>Currency:</strong> {lock.currency}</div>
                              <div className="small">Rate: {lock.rate_to_php}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <i className="bi bi-cart-x text-muted" style={{ fontSize: '3rem' }}></i>
                    <p className="text-muted mt-2">Your cart is empty</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Checkout
