import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api/config'
import { formatPrice } from '../utils/currency'
import './OrderConfirmation.css'

interface OrderItem {
  order_item_id: number
  product_id: number
  product_name: string
  brand: string
  model?: string
  quantity: number
  unit_price: number
  subtotal: number
  primary_image_url?: string
  product_image?: string  // API returns this as product_image
}

interface Payment {
  payment_id: number
  payment_method: string
  payment_status: string
  amount: number
  currency: string
  transaction_id?: string
  payment_date?: string
}

interface Order {
  order_id: number
  user_id: number
  order_date: string
  total_amount: number
  currency: string
  status: string
  shipping_address: string
  first_name: string
  last_name: string
  email: string
  items: OrderItem[]
  payment: Payment
}

function OrderConfirmation() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { user } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isNewOrder, setIsNewOrder] = useState(false)

  useEffect(() => {
    // Check if this is a new order from checkout
    const fromCheckout = location.state?.fromCheckout === true
    
    // Try to get order from navigation state first
    if (location.state?.order) {
      setOrder(location.state.order)
      setIsNewOrder(fromCheckout)
      setLoading(false)
      return
    }

    // Otherwise fetch by order ID
    if (id) {
      fetchOrder(parseInt(id))
      // If no state, assume it's from order history (not a new order)
      setIsNewOrder(false)
    } else {
      setError('Order ID not found')
      setLoading(false)
    }
  }, [id, location.state])

  const fetchOrder = async (orderId: number) => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      if (!token) {
        navigate('/login')
        return
      }

      // Use user-facing orders endpoint instead of admin endpoint
      const response = await fetch(api(`/orders/${orderId}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.status === 401) {
        navigate('/login')
        return
      }

      const data = await response.json()
      if (data.success && data.data) {
        setOrder(data.data)
      } else {
        setError(data.message || 'Failed to load order details')
      }
    } catch (err) {
      setError('Failed to load order details')
      console.error('Error fetching order:', err)
    } finally {
      setLoading(false)
    }
  }

  const getPaymentMethodName = (method: string) => {
    const methods: Record<string, string> = {
      credit_card: 'Credit Card',
      debit_card: 'Debit Card',
      gcash: 'GCash',
      maya: 'Maya',
      bank_transfer: 'Bank Transfer',
      cod: 'Cash on Delivery'
    }
    return methods[method] || method
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { class: string; label: string }> = {
      pending: { class: 'warning', label: 'Pending' },
      processing: { class: 'info', label: 'Processing' },
      shipped: { class: 'primary', label: 'Shipped' },
      delivered: { class: 'success', label: 'Delivered' },
      cancelled: { class: 'danger', label: 'Cancelled' }
    }
    const config = statusConfig[status] || { class: 'secondary', label: status }
    return <span className={`badge bg-${config.class}`}>{config.label}</span>
  }

  const getPaymentStatusBadge = (status: string) => {
    const statusConfig: Record<string, { class: string; label: string }> = {
      pending: { class: 'warning', label: 'Pending' },
      completed: { class: 'success', label: 'Completed' },
      failed: { class: 'danger', label: 'Failed' },
      refunded: { class: 'secondary', label: 'Refunded' }
    }
    const config = statusConfig[status] || { class: 'secondary', label: status }
    return <span className={`badge bg-${config.class}`}>{config.label}</span>
  }

  if (loading) {
    return (
      <div className="order-confirmation">
        <div className="container">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Loading order details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="order-confirmation">
        <div className="container">
          <div className="text-center py-5">
            <div className="alert alert-danger">
              <i className="bi bi-exclamation-triangle me-2"></i>
              {error || 'Order not found'}
            </div>
            <button className="btn btn-primary mt-3" onClick={() => navigate('/')}>
              Go to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="order-confirmation">
      <div className="container py-5">
        {/* Success Header - Only show for new orders */}
        {isNewOrder && (
          <div className="text-center mb-5">
            <div className="success-icon mb-3">
              <i className="bi bi-check-circle-fill"></i>
            </div>
            <h1 className="display-4 fw-bold text-success mb-2">Order Confirmed!</h1>
            <p className="lead text-muted">
              Thank you for your purchase. Your order has been successfully placed.
            </p>
          </div>
        )}

        {/* Order Details Header - For viewing from order history */}
        {!isNewOrder && (
          <div className="text-center mb-5">
            <h1 className="display-4 fw-bold mb-2">Order Details</h1>
            <p className="lead text-muted">
              View your order information below.
            </p>
          </div>
        )}

        {/* Order Summary Card */}
        <div className="row justify-content-center">
          <div className="col-lg-10">
            <div className="card shadow-sm mb-4">
              <div className="card-header bg-primary text-white">
                <h4 className="mb-0">
                  <i className="bi bi-receipt me-2"></i>
                  Order Summary
                </h4>
              </div>
              <div className="card-body">
                <div className="row mb-4">
                  <div className="col-md-6">
                    <h6 className="text-muted mb-2">Order Number</h6>
                    <p className="fs-5 fw-bold">#{order.order_id}</p>
                  </div>
                  <div className="col-md-6">
                    <h6 className="text-muted mb-2">Order Date</h6>
                    <p className="fs-5">
                      {new Date(order.order_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>

                <div className="row mb-4">
                  <div className="col-md-6">
                    <h6 className="text-muted mb-2">Order Status</h6>
                    <div>{getStatusBadge(order.status)}</div>
                  </div>
                  <div className="col-md-6">
                    <h6 className="text-muted mb-2">Payment Status</h6>
                    <div>{getPaymentStatusBadge(order.payment?.payment_status || 'pending')}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div className="card shadow-sm mb-4">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-person me-2"></i>
                  Customer Information
                </h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <h6 className="text-muted mb-1">Name</h6>
                    <p className="mb-0">{order.first_name} {order.last_name}</p>
                  </div>
                  <div className="col-md-6 mb-3">
                    <h6 className="text-muted mb-1">Email</h6>
                    <p className="mb-0">{order.email}</p>
                  </div>
                  <div className="col-12">
                    <h6 className="text-muted mb-1">Shipping Address</h6>
                    <p className="mb-0">{order.shipping_address}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="card shadow-sm mb-4">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-box-seam me-2"></i>
                  Order Items ({order.items?.length || 0})
                </h5>
              </div>
              <div className="card-body">
                {order.items && order.items.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th style={{ width: '80px' }}>Image</th>
                          <th>Product</th>
                          <th className="text-center">Quantity</th>
                          <th className="text-end">Unit Price</th>
                          <th className="text-end">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item) => (
                          <tr key={item.order_item_id}>
                            <td>
                              {(item.primary_image_url || item.product_image) ? (
                                <img
                                  src={item.primary_image_url || item.product_image}
                                  alt={item.product_name}
                                  className="order-item-image"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
                                  }}
                                />
                              ) : (
                                <div className="order-item-image-placeholder">
                                  <i className="bi bi-image"></i>
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="fw-bold">{item.product_name}</div>
                              <small className="text-muted">{item.brand} {item.model ? `- ${item.model}` : ''}</small>
                            </td>
                            <td className="text-center">
                              <span className="badge bg-secondary">{item.quantity}</span>
                            </td>
                            <td className="text-end">
                              {formatPrice(item.unit_price, order.currency)}
                            </td>
                            <td className="text-end fw-bold">
                              {formatPrice(item.subtotal, order.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={4} className="text-end fw-bold fs-5">
                            Total Amount:
                          </td>
                          <td className="text-end fw-bold fs-5 text-primary">
                            {formatPrice(order.total_amount, order.currency)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted">No items found</p>
                )}
              </div>
            </div>

            {/* Payment Information */}
            {order.payment && (
              <div className="card shadow-sm mb-4">
                <div className="card-header">
                  <h5 className="mb-0">
                    <i className="bi bi-credit-card me-2"></i>
                    Payment Information
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <h6 className="text-muted mb-1">Payment Method</h6>
                      <p className="mb-0">
                        <i className="bi bi-wallet2 me-2"></i>
                        {getPaymentMethodName(order.payment.payment_method)}
                      </p>
                    </div>
                    <div className="col-md-6 mb-3">
                      <h6 className="text-muted mb-1">Payment Status</h6>
                      <div>{getPaymentStatusBadge(order.payment.payment_status)}</div>
                    </div>
                    {order.payment.transaction_id && (
                      <div className="col-md-6 mb-3">
                        <h6 className="text-muted mb-1">Transaction ID</h6>
                        <p className="mb-0 font-monospace small">{order.payment.transaction_id}</p>
                      </div>
                    )}
                    {order.payment.payment_date && (
                      <div className="col-md-6 mb-3">
                        <h6 className="text-muted mb-1">Payment Date</h6>
                        <p className="mb-0">
                          {new Date(order.payment.payment_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    )}
                    <div className="col-12">
                      <h6 className="text-muted mb-1">Amount Paid</h6>
                      <p className="fs-4 fw-bold text-success mb-0">
                        {formatPrice(order.payment.amount, order.payment.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons - Different buttons based on context */}
            <div className="text-center mb-4">
              {isNewOrder ? (
                <>
                  {/* New Order - Show "Back to Home" and "Browse More" */}
                  <button
                    className="btn btn-primary btn-lg me-3"
                    onClick={() => navigate('/')}
                  >
                    <i className="bi bi-house me-2"></i>
                    Back to Home
                  </button>
                  <button
                    className="btn btn-outline-primary btn-lg me-3"
                    onClick={() => navigate('/products')}
                  >
                    <i className="bi bi-grid me-2"></i>
                    Browse More Products
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-lg"
                    onClick={() => navigate('/profile')}
                  >
                    <i className="bi bi-person me-2"></i>
                    View Profile
                  </button>
                </>
              ) : (
                <>
                  {/* Viewing from Order History - Show "Back to Orders" */}
                  <button
                    className="btn btn-primary btn-lg me-3"
                    onClick={() => navigate('/profile', { state: { activeTab: 'orders' } })}
                  >
                    <i className="bi bi-arrow-left me-2"></i>
                    Back to Order History
                  </button>
                  <button
                    className="btn btn-outline-primary btn-lg"
                    onClick={() => navigate('/products')}
                  >
                    <i className="bi bi-grid me-2"></i>
                    Browse Products
                  </button>
                </>
              )}
            </div>

            {/* Help Text - Only show for new orders */}
            {isNewOrder && (
              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                <strong>What's next?</strong> You will receive an email confirmation shortly. 
                {order.payment?.payment_method === 'cod' && (
                  <span> For Cash on Delivery orders, payment will be collected upon delivery.</span>
                )}
                {order.status === 'processing' && (
                  <span> Your order is being processed and will be shipped soon.</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrderConfirmation

