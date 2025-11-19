/**
 * ADMIN DASHBOARD PAGE
 * 
 * This is the main admin dashboard showing statistics and management options.
 * 
 * BACKEND API ENDPOINT: /api/admin/dashboard
 * - Method: GET
 * - Headers: { Authorization: "Bearer <token>" }
 * - Response: { success: boolean, data: { totalUsers, totalProducts, totalOrders, totalRevenue, recentOrders, lowStockProducts } }
 * 
 * FRONTEND FEATURES:
 * - Statistics cards (users, products, orders, revenue)
 * - Recent orders table
 * - Low stock alerts
 * - Sidebar navigation
 * - Responsive design
 * 
 * TO ADD NEW FEATURES:
 * - Add new API calls in fetchDashboardData()
 * - Update the DashboardStats interface
 * - Add new UI components in the return statement
 * - Update the sidebar navigation links
 * 
 * SIDEBAR NAVIGATION:
 * - /admin - Dashboard (current page)
 * - /admin/products - Products management (placeholder)
 * - /admin/orders - Orders management (placeholder)
 * - /admin/users - Users management (placeholder)
 * - /admin/categories - Categories management (placeholder)
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { useCurrency } from '../context/CurrencyContext'
import { formatPrice } from '../utils/currency'
import AdminAnalytics from './AdminAnalytics'
import './AdminDashboard.css'

interface DashboardStats {
  totalUsers: number
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  currency?: string
  recentOrders: Array<{
    order_id: number
    first_name: string
    last_name: string
    email: string
    total_amount: number
    currency?: string
    status: string
    created_at: string
  }>
  lowStockProducts: Array<{
    product_id: number
    product_name: string
    brand: string
    stock_quantity: number
  }>
}

function AdminDashboard() {
  const { currency } = useCurrency()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAnalytics, setShowAnalytics] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [currency]) // Refetch when currency changes

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('No authentication token found')
        setLoading(false)
        return
      }

      const response = await fetch(`http://localhost:8000/api/admin/dashboard?currency=${encodeURIComponent(currency)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          setError('Admin access required')
        } else {
          setError(data.message || 'Failed to fetch dashboard data')
        }
        setLoading(false)
        return
      }

      setStats(data.data)
      setLoading(false)
    } catch (err) {
      setError('Network error')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading admin dashboard...</p>
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="text-center py-5">
          <div className="alert alert-danger">
            <h4>Access Denied</h4>
            <p>{error}</p>
            <Link to="/" className="btn btn-primary">Go to Home</Link>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Dashboard Overview</h2>
        <div className="d-flex gap-2 align-items-center">
          <button
            className="btn btn-outline-primary"
            onClick={() => setShowAnalytics(!showAnalytics)}
          >
            <i className={`bi bi-${showAnalytics ? 'x' : 'graph-up'} me-2`}></i>
            {showAnalytics ? 'Hide Analytics' : 'Show Analytics & Reports'}
          </button>
          <span className="text-muted">Welcome, Admin</span>
        </div>
      </div>

      {showAnalytics && (
        <div className="mb-4">
          <AdminAnalytics />
        </div>
      )}

      {/* Statistics Cards */}
      <div className="row mb-4">
        <div className="col-md-3 mb-3">
          <div className="card stat-card bg-primary text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h4>{stats?.totalUsers || 0}</h4>
                  <p className="mb-0">Total Users</p>
                </div>
                <i className="bi bi-people fs-1"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card stat-card bg-success text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h4>{stats?.totalProducts || 0}</h4>
                  <p className="mb-0">Total Products</p>
                </div>
                <i className="bi bi-box fs-1"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card stat-card bg-warning text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h4>{stats?.totalOrders || 0}</h4>
                  <p className="mb-0">Total Orders</p>
                </div>
                <i className="bi bi-cart-check fs-1"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card stat-card bg-info text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h4>{formatPrice(stats?.totalRevenue || 0, stats?.currency || currency)}</h4>
                  <p className="mb-0">Total Revenue</p>
                </div>
                <i className="bi bi-currency-dollar fs-1"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        {/* Recent Orders */}
        <div className="col-md-8 mb-4">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Recent Orders</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.recentOrders.map(order => (
                      <tr key={order.order_id}>
                        <td>#{order.order_id}</td>
                        <td>{order.first_name} {order.last_name}</td>
                        <td>{formatPrice(order.total_amount, order.currency || currency)}</td>
                        <td>
                          <span className={`badge bg-${
                            order.status === 'delivered' ? 'success' : 
                            order.status === 'pending' ? 'warning' : 'info'
                          }`}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </td>
                        <td>{new Date(order.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="col-md-4 mb-4">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Low Stock Alert</h5>
            </div>
            <div className="card-body">
              {!stats?.lowStockProducts.length ? (
                <p className="text-success">All products are well stocked!</p>
              ) : (
                stats.lowStockProducts.map(product => (
                  <div key={product.product_id} className="d-flex justify-content-between align-items-center mb-2">
                    <div>
                      <strong>{product.product_name}</strong>
                      <br />
                      <small className="text-muted">{product.brand}</small>
                    </div>
                    <span className="badge bg-danger">{product.stock_quantity} left</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminDashboard
