/**
 * ADMIN VIEWS/REPORTS PAGE
 * 
 * Displays database views for reporting and analytics
 * 
 * FEATURES:
 * - View selector dropdown
 * - Filter options per view
 * - Data table with pagination
 * - Export functionality
 * - Real-time data from database views
 */

import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import { useCurrency } from '../context/CurrencyContext'
import { formatPrice } from '../utils/currency'
import './AdminViews.css'

interface ViewData {
  view: string
  data: any[]
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}

const AVAILABLE_VIEWS = [
  { value: 'v_product_catalog', label: 'Product Catalog', icon: '📦' },
  { value: 'v_product_availability_by_branch', label: 'Product Availability by Branch', icon: '🏪' },
  { value: 'v_branch_inventory_levels', label: 'Branch Inventory Levels', icon: '📊' },
  { value: 'v_daily_sales_totals', label: 'Daily Sales Totals', icon: '💰' },
  { value: 'v_order_summary', label: 'Order Summary', icon: '📋' },
  { value: 'v_order_details', label: 'Order Details', icon: '📝' },
  { value: 'v_order_dashboard', label: 'Order Dashboard', icon: '🎯' },
  { value: 'v_top_rated_products', label: 'Top Rated Products', icon: '⭐' },
  { value: 'v_low_stock_alerts', label: 'Low Stock Alerts', icon: '⚠️' },
  { value: 'v_customer_purchase_summary', label: 'Customer Purchase Summary', icon: '👥' },
  { value: 'v_orders_with_payment_details', label: 'Orders with Payment Details', icon: '💳' },
  { value: 'v_order_status_timeline', label: 'Order Status Timeline', icon: '📅' },
  { value: 'v_shopping_cart_details', label: 'Shopping Cart Details', icon: '🛒' },
  { value: 'v_transaction_log_activities', label: 'Transaction Log Activities', icon: '📜' },
]

function AdminViews() {
  const { currency } = useCurrency()
  const [selectedView, setSelectedView] = useState<string>('v_product_catalog')
  const [viewData, setViewData] = useState<ViewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const itemsPerPage = 50

  useEffect(() => {
    if (selectedView) {
      fetchViewData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedView, currentPage, filters, searchQuery])

  const fetchViewData = async () => {
    setLoading(true)
    setError('')
    
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('No authentication token found')
        setLoading(false)
        return
      }

      // When searching, fetch more data (1000 records) for better search results
      // Otherwise use pagination
      const limit = searchQuery ? 1000 : itemsPerPage
      const offset = searchQuery ? 0 : (currentPage - 1) * itemsPerPage
      
      const queryParams = new URLSearchParams({
        view: selectedView,
        limit: limit.toString(),
        offset: offset.toString(),
        currency: currency,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '' && v !== null)
        )
      })

      const response = await fetch(
        `http://localhost:8000/api/admin/views?${queryParams.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Failed to fetch view data')
        setLoading(false)
        return
      }

      setViewData(data.data)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  const handleViewChange = (view: string) => {
    setSelectedView(view)
    setFilters({})
    setSearchQuery('')
    setCurrentPage(1)
  }

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  const getFilterInputs = () => {
    switch (selectedView) {
      case 'v_product_catalog':
        return (
          <div className="row g-2 mb-3">
            <div className="col-md-4">
              <input
                type="text"
                className="form-control"
                placeholder="Category Name"
                value={filters.category_name || ''}
                onChange={(e) => handleFilterChange('category_name', e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <input
                type="number"
                className="form-control"
                placeholder="Min Stock"
                value={filters.min_stock || ''}
                onChange={(e) => handleFilterChange('min_stock', e.target.value)}
              />
            </div>
          </div>
        )
        
      case 'v_product_availability_by_branch':
      case 'v_branch_inventory_levels':
      case 'v_low_stock_alerts':
        return (
          <div className="row g-2 mb-3">
            <div className="col-md-4">
              <input
                type="number"
                className="form-control"
                placeholder="Branch ID"
                value={filters.branch_id || ''}
                onChange={(e) => handleFilterChange('branch_id', e.target.value)}
              />
            </div>
            {selectedView === 'v_low_stock_alerts' && (
              <div className="col-md-4">
                <select
                  className="form-select"
                  value={filters.alert_level || ''}
                  onChange={(e) => handleFilterChange('alert_level', e.target.value)}
                >
                  <option value="">All Alert Levels</option>
                  <option value="Out of Stock">Out of Stock</option>
                  <option value="Critical Low Stock">Critical Low Stock</option>
                  <option value="Low Stock">Low Stock</option>
                </select>
              </div>
            )}
          </div>
        )
        
      case 'v_daily_sales_totals':
        return (
          <div className="row g-2 mb-3">
            <div className="col-md-3">
              <input
                type="number"
                className="form-control"
                placeholder="Branch ID"
                value={filters.branch_id || ''}
                onChange={(e) => handleFilterChange('branch_id', e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <input
                type="date"
                className="form-control"
                placeholder="Date From"
                value={filters.date_from || ''}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <input
                type="date"
                className="form-control"
                placeholder="Date To"
                value={filters.date_to || ''}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <input
                type="text"
                className="form-control"
                placeholder="Currency"
                value={filters.currency || ''}
                onChange={(e) => handleFilterChange('currency', e.target.value.toUpperCase())}
              />
            </div>
          </div>
        )
        
      case 'v_order_summary':
      case 'v_order_dashboard':
      case 'v_orders_with_payment_details':
        return (
          <div className="row g-2 mb-3">
            <div className="col-md-3">
              <input
                type="text"
                className="form-control"
                placeholder="Customer Name"
                value={filters.customer_name || ''}
                onChange={(e) => handleFilterChange('customer_name', e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={filters.order_status || ''}
                onChange={(e) => handleFilterChange('order_status', e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={filters.payment_status || ''}
                onChange={(e) => handleFilterChange('payment_status', e.target.value)}
              >
                <option value="">All Payment Statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div className="col-md-3">
              <input
                type="date"
                className="form-control"
                placeholder="Date From"
                value={filters.date_from || ''}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
              />
            </div>
          </div>
        )
        
      case 'v_shopping_cart_details':
        return (
          <div className="row g-2 mb-3">
            <div className="col-md-4">
              <input
                type="number"
                className="form-control"
                placeholder="User ID"
                value={filters.user_id || ''}
                onChange={(e) => handleFilterChange('user_id', e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <input
                type="number"
                className="form-control"
                placeholder="Days in Cart (min)"
                value={filters.days_in_cart || ''}
                onChange={(e) => handleFilterChange('days_in_cart', e.target.value)}
              />
            </div>
          </div>
        )
        
      case 'v_transaction_log_activities':
        return (
          <div className="row g-2 mb-3">
            <div className="col-md-4">
              <input
                type="number"
                className="form-control"
                placeholder="Performed By (User ID)"
                value={filters.performed_by || ''}
                onChange={(e) => handleFilterChange('performed_by', e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <select
                className="form-select"
                value={filters.activity_type || ''}
                onChange={(e) => handleFilterChange('activity_type', e.target.value)}
              >
                <option value="">All Activity Types</option>
                <option value="Creation">Creation</option>
                <option value="Modification">Modification</option>
                <option value="Deletion">Deletion</option>
                <option value="Status Change">Status Change</option>
                <option value="Transfer">Transfer</option>
                <option value="Payment">Payment</option>
              </select>
            </div>
            <div className="col-md-4">
              <input
                type="number"
                className="form-control"
                placeholder="Hours Ago (max)"
                value={filters.hours_ago || ''}
                onChange={(e) => handleFilterChange('hours_ago', e.target.value)}
              />
            </div>
          </div>
        )
        
      default:
        return null
    }
  }

  // Filter data based on search query
  const filterDataBySearch = (data: any[]) => {
    if (!searchQuery.trim()) {
      return data
    }

    const query = searchQuery.toLowerCase().trim()
    return data.filter(row => {
      // Search across all columns/fields in the row
      return Object.values(row).some(value => {
        if (value === null || value === undefined) {
          return false
        }
        // Convert to string and search (handles numbers, dates, objects, etc.)
        const stringValue = typeof value === 'object' 
          ? JSON.stringify(value).toLowerCase()
          : String(value).toLowerCase()
        return stringValue.includes(query)
      })
    })
  }

  const renderTable = () => {
    if (!viewData || !viewData.data || viewData.data.length === 0) {
      return (
        <div className="alert alert-info">
          No data available for this view
        </div>
      )
    }

    // Filter data based on search query
    const filteredData = filterDataBySearch(viewData.data)
    
    if (filteredData.length === 0) {
      return (
        <div className="alert alert-warning">
          <i className="bi bi-search me-2"></i>
          No results found for "{searchQuery}". Try a different search term.
        </div>
      )
    }

    const columns = Object.keys(filteredData[0])

    return (
      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead className="table-dark">
            <tr>
              {columns.map(col => (
                <th key={col}>{col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Apply pagination to filtered data when searching
              if (searchQuery) {
                const startIndex = (currentPage - 1) * itemsPerPage
                const endIndex = startIndex + itemsPerPage
                return filteredData.slice(startIndex, endIndex).map((row, idx) => (
                  <tr key={idx}>
                    {columns.map(col => {
                      const value = row[col]
                      // Format currency values
                      if (col.includes('price') || col.includes('amount') || col.includes('revenue') || col.includes('total') || col.includes('spent')) {
                        return (
                          <td key={col}>
                            {typeof value === 'number' && value > 0 
                              ? formatPrice(value, currency) 
                              : value}
                          </td>
                        )
                      }
                      // Format dates
                      if (col.includes('date') || col.includes('_at') || col.includes('since')) {
                        return (
                          <td key={col}>
                            {value ? new Date(value).toLocaleString() : '-'}
                          </td>
                        )
                      }
                      // Format JSON
                      if (typeof value === 'object' && value !== null) {
                        return (
                          <td key={col}>
                            <code>{JSON.stringify(value)}</code>
                          </td>
                        )
                      }
                      // Highlight search matches
                      if (searchQuery && typeof value === 'string') {
                        const regex = new RegExp(`(${searchQuery})`, 'gi')
                        const highlighted = value.replace(regex, '<mark>$1</mark>')
                        return <td key={col} dangerouslySetInnerHTML={{ __html: highlighted }} />
                      }
                      return <td key={col}>{value ?? '-'}</td>
                    })}
                  </tr>
                ))
              } else {
                return filteredData.map((row, idx) => (
              <tr key={idx}>
                {columns.map(col => {
                  const value = row[col]
                  // Format currency values
                  if (col.includes('price') || col.includes('amount') || col.includes('revenue') || col.includes('total') || col.includes('spent')) {
                    return (
                      <td key={col}>
                        {typeof value === 'number' && value > 0 
                          ? formatPrice(value, currency) 
                          : value}
                      </td>
                    )
                  }
                  // Format dates
                  if (col.includes('date') || col.includes('_at') || col.includes('since')) {
                    return (
                      <td key={col}>
                        {value ? new Date(value).toLocaleString() : '-'}
                      </td>
                    )
                  }
                  // Format JSON
                  if (typeof value === 'object' && value !== null) {
                    return (
                      <td key={col}>
                        <code>{JSON.stringify(value)}</code>
                      </td>
                    )
                  }
                      // Highlight search matches in string values (for non-search pagination)
                      if (searchQuery && typeof value === 'string' && value.toLowerCase().includes(searchQuery.toLowerCase())) {
                        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                        const regex = new RegExp(`(${escapedQuery})`, 'gi')
                        const highlighted = value.replace(regex, '<mark>$1</mark>')
                        return <td key={col} dangerouslySetInnerHTML={{ __html: highlighted }} />
                      }
                      return <td key={col}>{value ?? '-'}</td>
                    })}
                  </tr>
                ))
              }
            })()}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <AdminLayout>
      <div className="admin-views-page">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h3 mb-0">
            <i className="bi bi-bar-chart me-2"></i>
            Views & Reports
          </h1>
        </div>

        {error && (
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            {error}
            <button
              type="button"
              className="btn-close"
              onClick={() => setError('')}
            ></button>
          </div>
        )}

        <div className="card mb-4">
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label fw-bold">Select View</label>
              <select
                className="form-select"
                value={selectedView}
                onChange={(e) => handleViewChange(e.target.value)}
              >
                {AVAILABLE_VIEWS.map(view => (
                  <option key={view.value} value={view.value}>
                    {view.icon} {view.label}
                  </option>
                ))}
              </select>
            </div>

            {getFilterInputs()}

            <div className="mb-3">
              <div className="row g-2 align-items-end">
                <div className="col-md-6">
                  <label className="form-label fw-bold">
                    <i className="bi bi-search me-2"></i>
                    Search All Columns
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search across all columns and fields..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setCurrentPage(1) // Reset to first page when searching
                    }}
                  />
                  {searchQuery && (
                    <small className="text-muted">
                      Searching in all columns for: <strong>"{searchQuery}"</strong>
                    </small>
                  )}
                </div>
                <div className="col-md-6 text-end">
                  <button
                    className="btn btn-primary me-2"
                    onClick={fetchViewData}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Loading...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-arrow-clockwise me-2"></i>
                        Refresh
                      </>
                    )}
                  </button>
                  {searchQuery && (
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => {
                        setSearchQuery('')
                        setCurrentPage(1)
                      }}
                    >
                      <i className="bi bi-x-circle me-2"></i>
                      Clear Search
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-3">
              {viewData && (
                <div className="text-muted">
                  {searchQuery ? (
                    <>
                      Showing {filterDataBySearch(viewData.data).length} of {viewData.pagination.total} records
                      {filterDataBySearch(viewData.data).length !== viewData.pagination.total && (
                        <span className="text-warning ms-2">
                          (filtered from {viewData.pagination.total} total)
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      Showing {viewData.pagination.offset + 1} - {Math.min(
                        viewData.pagination.offset + viewData.pagination.limit,
                        viewData.pagination.total
                      )} of {viewData.pagination.total} records
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {loading && !viewData ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <>
            {renderTable()}
            
            {viewData && (() => {
              const filteredData = filterDataBySearch(viewData.data)
              const totalFiltered = filteredData.length
              const totalPages = Math.ceil(totalFiltered / itemsPerPage)
              const startIndex = (currentPage - 1) * itemsPerPage
              const endIndex = startIndex + itemsPerPage
              const paginatedData = filteredData.slice(startIndex, endIndex)
              
              // Update the displayed data to use paginated filtered data
              if (searchQuery && totalPages > 1) {
                return (
                  <nav className="mt-4">
                    <ul className="pagination justify-content-center">
                      <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                        <button
                          className="page-link"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </button>
                      </li>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => 
                          page === 1 || 
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 2
                        )
                        .map((page, idx, arr) => (
                          <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                            {idx > 0 && arr[idx - 1] !== page - 1 && (
                              <span className="page-link">...</span>
                            )}
                            <button
                              className="page-link"
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </button>
                          </li>
                        ))}
                      <li className={`page-item ${currentPage >= totalPages ? 'disabled' : ''}`}>
                        <button
                          className="page-link"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage >= totalPages}
                        >
                          Next
                        </button>
                      </li>
                    </ul>
                  </nav>
                )
              } else if (!searchQuery && viewData.pagination.total > itemsPerPage) {
                return (
                  <nav className="mt-4">
                    <ul className="pagination justify-content-center">
                      <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                        <button
                          className="page-link"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </button>
                      </li>
                      {Array.from({ length: Math.ceil(viewData.pagination.total / itemsPerPage) }, (_, i) => i + 1)
                        .filter(page => 
                          page === 1 || 
                          page === Math.ceil(viewData.pagination.total / itemsPerPage) ||
                          Math.abs(page - currentPage) <= 2
                        )
                        .map((page, idx, arr) => (
                          <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                            {idx > 0 && arr[idx - 1] !== page - 1 && (
                              <span className="page-link">...</span>
                            )}
                            <button
                              className="page-link"
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </button>
                          </li>
                        ))}
                      <li className={`page-item ${!viewData.pagination.has_more ? 'disabled' : ''}`}>
                        <button
                          className="page-link"
                          onClick={() => setCurrentPage(prev => prev + 1)}
                          disabled={!viewData.pagination.has_more}
                        >
                          Next
                        </button>
                      </li>
                    </ul>
                  </nav>
                )
              }
              return null
            })()}
          </>
        )}
      </div>
    </AdminLayout>
  )
}

export default AdminViews

