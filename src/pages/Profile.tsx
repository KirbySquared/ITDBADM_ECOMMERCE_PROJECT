import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import EditProfileModal from '../components/EditProfileModal'
import ReviewModal from '../components/ReviewModal'
import { useCurrency } from '../context/CurrencyContext'
import { api } from '../api/config'
import { formatPrice } from '../utils/currency'
import './Profile.css'

interface User {
  user_id: number
  username: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  address?: string
  branch_id?: number
  branch_name?: string
}

interface Order {
  order_id: number
  order_date: string
  total_amount: number
  currency: string
  status: string
  shipping_address: string
  payment_method?: string
  payment_status?: string
  items_count: number
}

interface OrderItem {
  product_id: number
  product_name: string
  brand?: string
  model?: string
  product_image?: string
  has_reviewed?: number
  review_id?: number
  review_rating?: number
}

function Profile() {
  const { currency } = useCurrency()
  const [user, setUser] = useState<User | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<'profile' | 'orders'>('profile')
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<number | null>(null)
  const [orderItemsForReview, setOrderItemsForReview] = useState<OrderItem[]>([])
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Get user data from localStorage
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const userData = JSON.parse(userStr)
      // Ensure phone and address are set to empty string if undefined/null
      setUser({
        ...userData,
        phone: userData.phone || '',
        address: userData.address || ''
      })
    } else {
      // If no user data, redirect to login
      navigate('/login')
    }
  }, [navigate])

  // Handle activeTab from navigation state (e.g., when coming back from order details)
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab)
    }
  }, [location.state])

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders()
    }
  }, [activeTab, currency])

  // Listen for order creation events to refresh orders list
  useEffect(() => {
    const handleOrderCreated = () => {
      // Always refresh orders when order is created, regardless of active tab
      fetchOrders()
    }
    window.addEventListener('orderCreated', handleOrderCreated)
    return () => window.removeEventListener('orderCreated', handleOrderCreated)
  }, [])

  const fetchOrders = async () => {
    setOrdersLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        navigate('/login')
        return
      }

      const response = await fetch(api(`/orders?currency=${encodeURIComponent(currency)}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.status === 401) {
        // Token expired or invalid - clear and redirect to login
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login')
        return
      }

      if (!response.ok) {
        // Handle other errors without redirecting
        const errorData = await response.json().catch(() => ({}))
        console.error('Error fetching orders:', errorData.message || 'Failed to fetch orders')
        setOrders([])
        return
      }

      const data = await response.json()
      console.log('Orders API response:', data) // Debug log
      
      if (data.success && data.data) {
        const ordersList = data.data.orders || []
        console.log('Setting orders:', ordersList) // Debug log
        setOrders(ordersList)
      } else {
        // If response is not successful, set empty array
        console.warn('Orders response not successful or missing data:', data)
        setOrders([])
      }
    } catch (err) {
      console.error('Error fetching orders:', err)
      // Don't redirect on network errors, just show empty state
      setOrders([])
    } finally {
      setOrdersLoading(false)
    }
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
    if (!status) return null
    const statusConfig: Record<string, { class: string; label: string }> = {
      pending: { class: 'warning', label: 'Pending' },
      completed: { class: 'success', label: 'Completed' },
      failed: { class: 'danger', label: 'Failed' },
      refunded: { class: 'secondary', label: 'Refunded' }
    }
    const config = statusConfig[status] || { class: 'secondary', label: status }
    return <span className={`badge bg-${config.class}`}>{config.label}</span>
  }

  const handleEditProfile = async (userData: Partial<User> & { password?: string }) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token')
      }

      const response = await fetch('http://localhost:8000/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to update profile')
      }

      // Update user data in localStorage
      const updatedUser = data.data.user
      setUser(updatedUser)
      localStorage.setItem('user', JSON.stringify(updatedUser))
      
      // Trigger auth state change
      window.dispatchEvent(new Event('authStateChanged'))
    } catch (error) {
      console.error('Error updating profile:', error)
      throw error
    }
  }

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token')
      if (token) {
        await fetch('http://localhost:8000/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.dispatchEvent(new Event('authStateChanged'))
      navigate('/')
    }
  }

  const handleReviewClick = async (orderId: number) => {
    setLoadingOrderDetails(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        navigate('/login')
        return
      }

      const response = await fetch(api(`/orders/${orderId}?currency=${encodeURIComponent(currency)}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.status === 401) {
        navigate('/login')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to load order details')
      }

      const data = await response.json()
      if (data.success && data.data && data.data.items) {
        setOrderItemsForReview(data.data.items)
        setSelectedOrderForReview(orderId)
        setShowReviewModal(true)
      } else {
        throw new Error('Failed to load order items')
      }
    } catch (error) {
      console.error('Error fetching order details:', error)
      alert('Failed to load order details. Please try again.')
    } finally {
      setLoadingOrderDetails(false)
    }
  }

  const handleReviewSubmitted = () => {
    // Refresh orders to update review status
    fetchOrders()
  }

  if (!user) {
    return (
      <div className="profile">
        <div className="container">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="profile">
      <div className="container py-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="display-5 fw-bold">My Account</h1>
          <Link to="/" className="btn btn-outline-primary">
            <i className="bi bi-house me-2"></i>
            Back to Home
          </Link>
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs mb-4" role="tablist">
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
              type="button"
            >
              <i className="bi bi-person me-2"></i>
              Profile Information
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
              type="button"
            >
              <i className="bi bi-bag-check me-2"></i>
              My Orders
              {orders.length > 0 && (
                <span className="badge bg-primary ms-2">{orders.length}</span>
              )}
            </button>
          </li>
        </ul>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'profile' && (
            <div className="row g-4">
              <div className="col-md-8">
                <div className="card shadow-sm">
                  <div className="card-header bg-primary text-white">
                    <h4 className="mb-0">
                      <i className="bi bi-person-circle me-2"></i>
                      Account Information
                    </h4>
                  </div>
                  <div className="card-body">
                    <div className="info-item">
                      <label><i className="bi bi-person me-2"></i>Username:</label>
                      <span>{user.username}</span>
                    </div>
                    <div className="info-item">
                      <label><i className="bi bi-person-badge me-2"></i>Full Name:</label>
                      <span>{user.first_name} {user.last_name}</span>
                    </div>
                    <div className="info-item">
                      <label><i className="bi bi-envelope me-2"></i>Email:</label>
                      <span>{user.email}</span>
                    </div>
                    {user.phone && (
                      <div className="info-item">
                        <label><i className="bi bi-telephone me-2"></i>Phone:</label>
                        <span>{user.phone}</span>
                      </div>
                    )}
                    {user.address && (
                      <div className="info-item">
                        <label><i className="bi bi-geo-alt me-2"></i>Address:</label>
                        <span>{user.address}</span>
                      </div>
                    )}
                    {user.branch_name && (
                      <div className="info-item">
                        <label><i className="bi bi-shop me-2"></i>Nearest Branch:</label>
                        <span>{user.branch_name}</span>
                      </div>
                    )}
                    {!user.branch_name && (
                      <div className="info-item">
                        <label><i className="bi bi-shop me-2"></i>Nearest Branch:</label>
                        <span className="text-muted">Not selected</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="col-md-4">
                <div className="card shadow-sm">
                  <div className="card-header">
                    <h5 className="mb-0">
                      <i className="bi bi-gear me-2"></i>
                      Account Actions
                    </h5>
                  </div>
                  <div className="card-body">
                    <div className="d-grid gap-2">
                      <button 
                        className="btn btn-primary"
                        onClick={() => setShowEditModal(true)}
                      >
                        <i className="bi bi-pencil me-2"></i>
                        Edit Profile
                      </button>
                      <Link to="/products" className="btn btn-outline-primary">
                        <i className="bi bi-box-seam me-2"></i>
                        Browse Products
                      </Link>
                      <Link to="/cart" className="btn btn-outline-primary">
                        <i className="bi bi-cart me-2"></i>
                        View Cart
                      </Link>
                      <button className="btn btn-danger" onClick={handleLogout}>
                        <i className="bi bi-box-arrow-right me-2"></i>
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="card shadow-sm">
              <div className="card-header bg-primary text-white">
                <h4 className="mb-0">
                  <i className="bi bi-bag-check me-2"></i>
                  Order History
                </h4>
              </div>
              <div className="card-body">
                {ordersLoading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-3 text-muted">Loading your orders...</p>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="bi bi-bag-x text-muted" style={{ fontSize: '4rem' }}></i>
                    <h4 className="mt-3 text-muted">No Recent Orders</h4>
                    <p className="text-muted mb-4">
                      You haven't placed any orders yet. Start shopping to see your order history here!
                    </p>
                    <Link to="/products" className="btn btn-primary">
                      <i className="bi bi-box-seam me-2"></i>
                      Browse Products
                    </Link>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Order #</th>
                          <th>Date</th>
                          <th>Items</th>
                          <th>Total Amount</th>
                          <th>Status</th>
                          <th>Payment</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((order) => (
                          <tr key={order.order_id}>
                            <td>
                              <strong className="text-primary">#{order.order_id}</strong>
                            </td>
                            <td>
                              {new Date(order.order_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </td>
                            <td>
                              <span className="badge bg-secondary">
                                {order.items_count} item{order.items_count !== 1 ? 's' : ''}
                              </span>
                            </td>
                            <td>
                              <strong>{formatPrice(order.total_amount, currency)}</strong>
                            </td>
                            <td>{getStatusBadge(order.status)}</td>
                            <td>
                              {getPaymentStatusBadge(order.payment_status || 'pending')}
                            </td>
                            <td>
                              <div className="btn-group btn-group-sm" role="group">
                                <Link
                                  to={`/orders/${order.order_id}`}
                                  className="btn btn-outline-primary"
                                >
                                  <i className="bi bi-eye me-1"></i>
                                  View Details
                                </Link>
                                {order.status === 'delivered' && (
                                  <button
                                    className="btn btn-outline-success"
                                    onClick={() => handleReviewClick(order.order_id)}
                                    disabled={loadingOrderDetails}
                                    title="Review products in this order"
                                  >
                                    {loadingOrderDetails ? (
                                      <span className="spinner-border spinner-border-sm" role="status"></span>
                                    ) : (
                                      <>
                                        <i className="bi bi-star me-1"></i>
                                        Review
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {user && (
        <EditProfileModal
          show={showEditModal}
          onHide={() => setShowEditModal(false)}
          user={user}
          onSave={handleEditProfile}
        />
      )}

      {/* Review Modal */}
      {selectedOrderForReview && (
        <ReviewModal
          show={showReviewModal}
          onHide={() => {
            setShowReviewModal(false)
            setSelectedOrderForReview(null)
            setOrderItemsForReview([])
          }}
          orderId={selectedOrderForReview}
          products={orderItemsForReview}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}
    </div>
  )
}

export default Profile
