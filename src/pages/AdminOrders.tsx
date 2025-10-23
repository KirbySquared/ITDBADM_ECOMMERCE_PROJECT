/**
 * ADMIN ORDERS PAGE
 * 
 * This page provides order management functionality for admins.
 * 
 * FEATURES:
 * - Order listing with filters
 * - Order status management
 * - Order details view
 * - Customer information
 * - Order tracking
 * 
 * TO ADD NEW FEATURES:
 * - Add API calls for order operations
 * - Implement order status updates
 * - Add order search and filtering
 * - Add bulk order operations
 * - Add order export functionality
 */
import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'

interface Order {
  order_id: number
  customer_name: string
  email: string
  total_amount: number
  status: string
  order_date: string
  items_count: number
}

function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    // Mock data - will be replaced with API call
    const mockOrders: Order[] = [
      {
        order_id: 1001,
        customer_name: 'John Doe',
        email: 'john.doe@example.com',
        total_amount: 299.99,
        status: 'pending',
        order_date: '2024-01-15',
        items_count: 2
      },
      {
        order_id: 1002,
        customer_name: 'Jane Smith',
        email: 'jane.smith@example.com',
        total_amount: 149.99,
        status: 'processing',
        order_date: '2024-01-14',
        items_count: 1
      },
      {
        order_id: 1003,
        customer_name: 'Bob Johnson',
        email: 'bob.johnson@example.com',
        total_amount: 599.98,
        status: 'shipped',
        order_date: '2024-01-13',
        items_count: 3
      },
      {
        order_id: 1004,
        customer_name: 'Alice Brown',
        email: 'alice.brown@example.com',
        total_amount: 79.99,
        status: 'delivered',
        order_date: '2024-01-12',
        items_count: 1
      }
    ]
    
    setTimeout(() => {
      setOrders(mockOrders)
      setLoading(false)
    }, 1000)
  }, [])

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.order_id.toString().includes(searchTerm)
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      pending: 'bg-warning',
      processing: 'bg-info',
      shipped: 'bg-primary',
      delivered: 'bg-success',
      cancelled: 'bg-danger'
    }
    return `badge ${statusClasses[status as keyof typeof statusClasses] || 'bg-secondary'}`
  }

  if (loading) {
    return (
      <AdminLayout currentPath="/admin/orders">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading orders...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout currentPath="/admin/orders">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Orders Management</h2>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-primary">
            <i className="bi bi-download me-2"></i>
            Export Orders
          </button>
          <button className="btn btn-primary">
            <i className="bi bi-plus-circle me-2"></i>
            New Order
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Search orders, customers, or order ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="col-md-3">
          <select
            className="form-select"
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
        <div className="col-md-3">
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary">
              <i className="bi bi-funnel me-1"></i>
              More Filters
            </button>
            <button className="btn btn-outline-secondary">
              <i className="bi bi-calendar me-1"></i>
              Date Range
            </button>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Order Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => (
                  <tr key={order.order_id}>
                    <td>
                      <strong>#{order.order_id}</strong>
                    </td>
                    <td>{order.customer_name}</td>
                    <td>{order.email}</td>
                    <td>${order.total_amount.toFixed(2)}</td>
                    <td>
                      <span className={getStatusBadge(order.status)}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark">
                        {order.items_count} item{order.items_count !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td>{new Date(order.order_date).toLocaleDateString()}</td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" title="View Details">
                          <i className="bi bi-eye"></i>
                        </button>
                        <button className="btn btn-outline-info" title="Edit Status">
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="btn btn-outline-success" title="Track Order">
                          <i className="bi bi-truck"></i>
                        </button>
                        <button className="btn btn-outline-secondary" title="Print Invoice">
                          <i className="bi bi-printer"></i>
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
            Showing {filteredOrders.length} of {orders.length} orders
          </p>
        </div>
        <nav>
          <ul className="pagination pagination-sm mb-0">
            <li className="page-item disabled">
              <span className="page-link">Previous</span>
            </li>
            <li className="page-item active">
              <span className="page-link">1</span>
            </li>
            <li className="page-item">
              <span className="page-link">2</span>
            </li>
            <li className="page-item">
              <span className="page-link">3</span>
            </li>
            <li className="page-item">
              <span className="page-link">Next</span>
            </li>
          </ul>
        </nav>
      </div>
    </AdminLayout>
  )
}

export default AdminOrders
