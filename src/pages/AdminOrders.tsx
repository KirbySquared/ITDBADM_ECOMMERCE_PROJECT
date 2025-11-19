import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import AdminOrderModal from '../components/AdminOrderModal'
import { useCurrency } from '../context/CurrencyContext'
import { formatPrice } from '../utils/currency'

interface OrderItem {
  order_item_id: number
  product_id: number
  quantity: number
  unit_price: number
  subtotal: number
  product_name: string
  brand: string
  model?: string
  product_image?: string
}

interface Payment {
  payment_method: string
  payment_status: string
  amount: number
  currency: string
  transaction_id?: string
  payment_date: string
}

interface Order {
  order_id: number
  user_id: number
  order_date: string
  total_amount: number
  currency: string
  status: string
  shipping_address: string
  created_at: string
  updated_at?: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  items_count: number
  items?: OrderItem[]
  payment?: Payment
}

function AdminOrders() {
  const { currency } = useCurrency()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  
  // Modal states
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false)
  const [showEditOrderModal, setShowEditOrderModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [currentPage, statusFilter, currency]) // Refetch when currency changes

  const fetchOrders = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        currency: currency, // Pass currency to API
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo })
      })

      const response = await fetch(`http://localhost:8000/api/admin/orders?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch orders')
      }

      const data = await response.json()
      if (data.success) {
        setOrders(data.data.orders)
        setTotalPages(data.data.pagination.pages)
      } else {
        throw new Error(data.message || 'Failed to fetch orders')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders')
    } finally {
      setLoading(false)
    }
  }

  const fetchOrderDetails = async (orderId: number) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:8000/api/admin/orders/${orderId}?currency=${encodeURIComponent(currency)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch order details')
      }

      const data = await response.json()
      if (data.success) {
        return data.data
      } else {
        throw new Error(data.message || 'Failed to fetch order details')
      }
    } catch (err) {
      throw err
    }
  }


  const cancelOrder = async (orderId: number) => {
    if (!confirm('Are you sure you want to cancel this order?')) return

    setError(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:8000/api/admin/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to cancel order')
      }

      const data = await response.json()
      if (data.success) {
        await fetchOrders() // Refresh the orders list
      } else {
        throw new Error(data.message || 'Failed to cancel order')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order')
    }
  }

  const createOrder = async (orderData: {
    user_id: number
    total_amount: number
    currency: string
    status: string
    shipping_address: string
    items: Array<{
      product_id: number
      quantity: number
      unit_price: number
    }>
  }) => {
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:8000/api/admin/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      })

      if (!response.ok) {
        throw new Error('Failed to create order')
      }

      const data = await response.json()
      if (data.success) {
        setShowCreateModal(false)
        
        // Refresh the orders list to get updated currency
        setLoading(true)
        try {
          const params = new URLSearchParams({
            page: currentPage.toString(),
            limit: '10',
            ...(searchTerm && { search: searchTerm }),
            ...(statusFilter !== 'all' && { status: statusFilter }),
            ...(dateFrom && { date_from: dateFrom }),
            ...(dateTo && { date_to: dateTo })
          })

          const refreshResponse = await fetch(`http://localhost:8000/api/admin/orders?${params}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json()
            if (refreshData.success) {
              setOrders(refreshData.data.orders)
              setTotalPages(refreshData.data.pagination.pages)
            }
          }
        } catch (refreshErr) {
          console.error('Failed to refresh orders:', refreshErr)
          await fetchOrders()
        } finally {
          setLoading(false)
        }
      } else {
        throw new Error(data.message || 'Failed to create order')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order')
    }
  }

  const editOrder = async (orderData: {
    user_id: number
    total_amount: number
    currency: string
    status: string
    shipping_address: string
    items: Array<{
      product_id: number
      quantity: number
      unit_price: number
    }>
  }) => {
    if (!selectedOrder) return

    setError(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:8000/api/admin/orders/${selectedOrder.order_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to update order')
      }

      const data = await response.json()
      if (data.success) {
        // Close modal first
        setShowEditOrderModal(false)
        const editedOrderId = selectedOrder.order_id
        
        // Refresh the orders list to get updated currency
        // Use a fresh fetch to ensure we get updated data
        setLoading(true)
        try {
          const params = new URLSearchParams({
            page: currentPage.toString(),
            limit: '10',
            ...(searchTerm && { search: searchTerm }),
            ...(statusFilter !== 'all' && { status: statusFilter }),
            ...(dateFrom && { date_from: dateFrom }),
            ...(dateTo && { date_to: dateTo })
          })

          const refreshResponse = await fetch(`http://localhost:8000/api/admin/orders?${params}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json()
            if (refreshData.success) {
              setOrders(refreshData.data.orders)
              setTotalPages(refreshData.data.pagination.pages)
            }
          }
        } catch (refreshErr) {
          console.error('Failed to refresh orders:', refreshErr)
          // Still try to fetch orders using the existing function
          await fetchOrders()
        } finally {
          setLoading(false)
        }
        
        // If viewing order details, refresh those too
        if (showOrderDetailsModal && editedOrderId) {
          try {
            const updatedOrder = await fetchOrderDetails(editedOrderId)
            setSelectedOrder(updatedOrder)
          } catch (err) {
            console.error('Failed to refresh order details:', err)
          }
        }
        setSelectedOrder(null)
      } else {
        throw new Error(data.message || 'Failed to update order')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order')
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchOrders()
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
    setCurrentPage(1)
    fetchOrders()
  }

  const handleViewOrder = async (order: Order) => {
    try {
      const orderDetails = await fetchOrderDetails(order.order_id)
      setSelectedOrder(orderDetails)
      setShowOrderDetailsModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order details')
    }
  }

  const handleCreateOrder = () => {
    setShowCreateModal(true)
  }

  const handleEditOrder = async (order: Order) => {
    try {
      const orderDetails = await fetchOrderDetails(order.order_id)
      setSelectedOrder(orderDetails)
      setShowEditOrderModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order details')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      pending: 'bg-warning',
      processing: 'bg-info',
      shipped: 'bg-primary',
      delivered: 'bg-success',
      cancelled: 'bg-danger'
    }
    return (
      <span className={`badge ${statusClasses[status as keyof typeof statusClasses] || 'bg-secondary'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getPaymentStatusBadge = (status: string) => {
    const statusClasses = {
      pending: 'bg-warning',
      completed: 'bg-success',
      failed: 'bg-danger',
      refunded: 'bg-info'
    }
    return (
      <span className={`badge ${statusClasses[status as keyof typeof statusClasses] || 'bg-secondary'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <AdminLayout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">
          <i className="bi bi-box-seam me-2"></i>
          Orders Management
        </h1>
        <button 
          className="btn btn-primary"
          onClick={handleCreateOrder}
        >
          <i className="bi bi-plus-circle me-2"></i>
          Create Order
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <form onSubmit={handleSearch} className="row g-3">
            <div className="col-md-3">
              <label htmlFor="search" className="form-label">Search Orders</label>
              <input
                type="text"
                className="form-control"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by customer name, email, or order ID..."
              />
            </div>
            <div className="col-md-2">
              <label htmlFor="status" className="form-label">Status</label>
              <select
                className="form-select"
                id="status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="col-md-2">
              <label htmlFor="dateFrom" className="form-label">From Date</label>
              <input
                type="date"
                className="form-control"
                id="dateFrom"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label htmlFor="dateTo" className="form-label">To Date</label>
              <input
                type="date"
                className="form-control"
                id="dateTo"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">&nbsp;</label>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary">
                  <i className="bi bi-search me-1"></i>
                  Search
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={handleClearSearch}>
                  <i className="bi bi-x-circle me-1"></i>
                  Clear
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card">
        <div className="card-header">
          <h6 className="mb-0">
            <i className="bi bi-list-ul me-2"></i>
            Orders List
          </h6>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2 text-muted">Loading orders...</p>
            </div>
          ) : error ? (
            <div className="alert alert-danger m-3" role="alert">
              <i className="bi bi-exclamation-triangle me-2"></i>
              {error}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-4">
              <i className="bi bi-box-seam text-muted" style={{fontSize: '3rem'}}></i>
              <p className="text-muted mt-2">No orders found</p>
              <small className="text-muted">Try adjusting your search criteria</small>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                    <th>Items</th>
                    <th>Order Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.order_id}>
                      <td>
                        <strong>#{order.order_id}</strong>
                      </td>
                      <td>{order.first_name} {order.last_name}</td>
                      <td>{order.email}</td>
                      <td>{formatPrice(order.total_amount, order.currency)}</td>
                      <td>{getStatusBadge(order.status)}</td>
                      <td>
                        <span className="badge bg-secondary">
                          {order.items_count} {order.items_count === 1 ? 'item' : 'items'}
                        </span>
                      </td>
                      <td>{formatDate(order.order_date)}</td>
                      <td>
                        <div className="btn-group btn-group-sm" role="group">
                          <button 
                            className="btn btn-outline-primary" 
                            title="View Details"
                            onClick={() => handleViewOrder(order)}
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                          <button 
                            className="btn btn-outline-info" 
                            title="Edit Order"
                            onClick={() => handleEditOrder(order)}
                            disabled={order.status === 'cancelled' || order.status === 'delivered'}
                          >
                            <i className="bi bi-pencil-square"></i>
                          </button>
                          <button 
                            className="btn btn-outline-danger" 
                            title="Cancel Order"
                            onClick={() => cancelOrder(order.order_id)}
                            disabled={order.status === 'cancelled' || order.status === 'delivered'}
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
            <nav aria-label="Orders pagination">
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

      {/* Order Details Modal (View Only) */}
      {showOrderDetailsModal && selectedOrder && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-box-seam me-2"></i>
                  Order #{selectedOrder.order_id} Details
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowOrderDetailsModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  {/* Customer Information */}
                  <div className="col-md-6">
                    <h6 className="mb-3">Customer Information</h6>
                    <div className="card">
                      <div className="card-body">
                        <p><strong>Name:</strong> {selectedOrder.first_name} {selectedOrder.last_name}</p>
                        <p><strong>Email:</strong> {selectedOrder.email}</p>
                        {selectedOrder.phone && <p><strong>Phone:</strong> {selectedOrder.phone}</p>}
                        <p><strong>Order Date:</strong> {formatDate(selectedOrder.order_date)}</p>
                        <p><strong>Status:</strong> {getStatusBadge(selectedOrder.status)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Shipping Information */}
                  <div className="col-md-6">
                    <h6 className="mb-3">Shipping Information</h6>
                    <div className="card">
                      <div className="card-body">
                        <p><strong>Shipping Address:</strong></p>
                        <p className="text-muted">{selectedOrder.shipping_address}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="mt-4">
                  <h6 className="mb-3">Order Items</h6>
                  <div className="table-responsive">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Quantity</th>
                          <th>Unit Price</th>
                          <th>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items?.map(item => (
                          <tr key={item.order_item_id}>
                            <td>
                              <div className="d-flex align-items-center">
                                {item.product_image ? (
                                  <img 
                                    src={item.product_image} 
                                    alt={item.product_name}
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
                                  <div className="fw-bold">{item.product_name}</div>
                                  <small className="text-muted">{item.brand} {item.model}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge bg-primary fs-6">{item.quantity}</span>
                            </td>
                            <td className="fw-bold">{formatPrice(item.unit_price, selectedOrder.currency)}</td>
                            <td className="fw-bold text-success">{formatPrice(item.subtotal, selectedOrder.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="table-active">
                          <th colSpan={3}>Total Amount</th>
                          <th>{formatPrice(selectedOrder.total_amount, selectedOrder.currency)}</th>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Payment Information */}
                {selectedOrder.payment && (
                  <div className="mt-4">
                    <h6 className="mb-3">Payment Information</h6>
                    <div className="card">
                      <div className="card-body">
                        <div className="row">
                          <div className="col-md-6">
                            <p><strong>Payment Method:</strong> {selectedOrder.payment.payment_method.replace('_', ' ').toUpperCase()}</p>
                            <p><strong>Payment Status:</strong> {getPaymentStatusBadge(selectedOrder.payment.payment_status)}</p>
                          </div>
                          <div className="col-md-6">
                            <p><strong>Amount:</strong> {formatPrice(selectedOrder.payment.amount, selectedOrder.payment.currency)}</p>
                            {selectedOrder.payment.transaction_id && (
                              <p><strong>Transaction ID:</strong> {selectedOrder.payment.transaction_id}</p>
                            )}
                            <p><strong>Payment Date:</strong> {formatDate(selectedOrder.payment.payment_date)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowOrderDetailsModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Create Order Modal */}
      <AdminOrderModal
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        onSave={createOrder}
      />

      {/* Edit Order Modal */}
      <AdminOrderModal
        show={showEditOrderModal}
        onHide={() => {
          setShowEditOrderModal(false)
          setSelectedOrder(null)
        }}
        order={selectedOrder}
        onSave={editOrder}
      />
    </AdminLayout>
  )
}

export default AdminOrders