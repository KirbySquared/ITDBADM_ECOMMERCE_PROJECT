import { useState, useEffect } from 'react'
import StaffLayout from '../components/StaffLayout'
import { useStaffAuth } from '../hooks/useStaffAuth'
import { useCurrency } from '../context/CurrencyContext'
import { formatPrice } from '../utils/currency'
import './AdminDashboard.css'

interface DashboardStats {
  branch: {
    branch_id: number
    branch_name: string
    address: string
  }
  newOrders: number
  totalOrders: number
  pendingOrders: number
  recentOrders: Array<{
    order_id: number
    first_name: string
    last_name: string
    email: string
    total_amount: number
    currency: string
    status: string
    order_date: string
  }>
  lowStockProducts: Array<{
    product_id: number
    product_name: string
    brand: string
    stock_quantity: number
  }>
}

function StaffDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { user } = useStaffAuth()
  const { currency } = useCurrency()

  useEffect(() => {
    fetchDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency])

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('No authentication token found')
        setLoading(false)
        return
      }

      const response = await fetch(`http://localhost:8000/api/staff/dashboard?currency=${currency}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          setError('Staff access required')
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <StaffLayout>
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading dashboard...</p>
        </div>
      </StaffLayout>
    )
  }

  if (error) {
    return (
      <StaffLayout>
        <div className="text-center py-5">
          <div className="alert alert-danger">
            <h4>Error</h4>
            <p>{error}</p>
          </div>
        </div>
      </StaffLayout>
    )
  }

  return (
    <StaffLayout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>Branch Dashboard</h2>
          {stats?.branch && (
            <p className="text-muted mb-0">
              <i className="bi bi-shop me-2"></i>
              {stats.branch.branch_name}
            </p>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="row mb-4">
        <div className="col-md-4 mb-3">
          <div className="card stat-card bg-primary text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h4>{stats?.newOrders || 0}</h4>
                  <p className="mb-0">New Orders</p>
                </div>
                <i className="bi bi-cart-plus fs-1"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4 mb-3">
          <div className="card stat-card bg-warning text-white">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <h4>{stats?.pendingOrders || 0}</h4>
                  <p className="mb-0">Pending Orders</p>
                </div>
                <i className="bi bi-clock-history fs-1"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4 mb-3">
          <div className="card stat-card bg-info text-white">
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
      </div>

      <div className="row">
        {/* Recent Orders */}
        <div className="col-md-8 mb-4">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="bi bi-clock-history me-2"></i>
                Recent Orders
              </h5>
            </div>
            <div className="card-body p-0">
              {stats?.recentOrders && stats.recentOrders.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Order ID</th>
                        <th>Customer</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentOrders.map(order => (
                        <tr key={order.order_id}>
                          <td>
                            <strong>#{order.order_id}</strong>
                          </td>
                          <td>
                            {order.first_name} {order.last_name}
                            <br />
                            <small className="text-muted">{order.email}</small>
                          </td>
                          <td>{formatPrice(order.total_amount, order.currency)}</td>
                          <td>{getStatusBadge(order.status)}</td>
                          <td>{formatDate(order.order_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted">No recent orders</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="col-md-4 mb-4">
          <div className="card">
            <div className="card-header bg-warning text-white">
              <h5 className="mb-0">
                <i className="bi bi-exclamation-triangle me-2"></i>
                Low Stock Alerts
              </h5>
            </div>
            <div className="card-body">
              {stats?.lowStockProducts && stats.lowStockProducts.length > 0 ? (
                <ul className="list-unstyled mb-0">
                  {stats.lowStockProducts.map(product => (
                    <li key={product.product_id} className="mb-3 pb-3 border-bottom">
                      <div className="fw-bold">{product.product_name}</div>
                      <small className="text-muted">{product.brand}</small>
                      <div className="mt-1">
                        <span className="badge bg-danger">
                          {product.stock_quantity} units left
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted mb-0">No low stock items</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </StaffLayout>
  )
}

export default StaffDashboard

