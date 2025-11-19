/**
 * ADMIN ANALYTICS & REPORTS PAGE
 * 
 * Displays visually appealing charts and graphs based on database views
 * 
 * FEATURES:
 * - Sales trends (line charts)
 * - Revenue breakdown (pie charts)
 * - Product performance (bar charts)
 * - Order status distribution (pie charts)
 * - Inventory alerts (bar charts)
 * - Customer insights (bar charts)
 */

import { useState, useEffect } from 'react'
import { useCurrency } from '../context/CurrencyContext'
import { formatPrice, getCurrencySymbol } from '../utils/currency'
import './AdminAnalytics.css'

// Chart.js imports
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface AnalyticsData {
  dailySales: any[]
  topSellingProducts: any[]
  topProducts: any[]
  orderStatusDistribution: any[]
  lowStockAlerts: any[]
  customerPurchaseSummary: any[]
  monthlySales: any[]
  branchSales: any[]
  allProducts: any[]
}

function AdminAnalytics() {
  const { currency } = useCurrency()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0] // today
  })

  useEffect(() => {
    fetchAnalyticsData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, dateRange.start, dateRange.end])

  const fetchAnalyticsData = async () => {
    setLoading(true)
    setError('')
    
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('No authentication token found')
        setLoading(false)
        return
      }

      // Fetch all analytics data in parallel
      const [
        dailySalesRes,
        orderDetailsRes,
        topProductsRes,
        orderStatusRes,
        lowStockRes,
        customerSummaryRes,
        monthlySalesRes,
        branchSalesRes,
        allProductsRes
      ] = await Promise.all([
        fetch(`http://localhost:8000/api/admin/views?view=v_daily_sales_totals&date_from=${dateRange.start}&date_to=${dateRange.end}&limit=1000&currency=${currency}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:8000/api/admin/views?view=v_order_details&date_from=${dateRange.start}&date_to=${dateRange.end}&limit=1000&currency=${currency}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:8000/api/admin/views?view=v_top_rated_products&limit=10&currency=${currency}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:8000/api/admin/views?view=v_order_summary&limit=1000&currency=${currency}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:8000/api/admin/views?view=v_low_stock_alerts&limit=100&currency=${currency}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:8000/api/admin/views?view=v_customer_purchase_summary&limit=20&currency=${currency}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:8000/api/admin/views?view=v_daily_sales_totals&date_from=${dateRange.start}&date_to=${dateRange.end}&limit=1000&currency=${currency}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:8000/api/admin/views?view=v_daily_sales_totals&date_from=${dateRange.start}&date_to=${dateRange.end}&limit=1000&currency=${currency}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:8000/api/products?limit=10000&currency=${currency}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      const [
        dailySalesData,
        orderDetailsData,
        topProductsData,
        orderStatusData,
        lowStockData,
        customerSummaryData,
        monthlySalesData,
        branchSalesData,
        allProductsData
      ] = await Promise.all([
        dailySalesRes.json(),
        orderDetailsRes.json(),
        topProductsRes.json(),
        orderStatusRes.json(),
        lowStockRes.json(),
        customerSummaryRes.json(),
        monthlySalesRes.json(),
        branchSalesRes.json(),
        allProductsRes.json()
      ])

      // Check for API errors in responses (exclude products API as it has different structure)
      const responses = [
        { name: 'dailySales', data: dailySalesData },
        { name: 'orderDetails', data: orderDetailsData },
        { name: 'topProducts', data: topProductsData },
        { name: 'orderStatus', data: orderStatusData },
        { name: 'lowStock', data: lowStockData },
        { name: 'customerSummary', data: customerSummaryData },
        { name: 'monthlySales', data: monthlySalesData },
        { name: 'branchSales', data: branchSalesData }
      ]

      // Check if any response has an error (products API checked separately)
      const hasError = responses.some(r => r.data && !r.data.success)
      if (hasError) {
        const errorResponse = responses.find(r => r.data && !r.data.success)
        throw new Error(errorResponse?.data.message || 'Failed to fetch analytics data')
      }
      
      // Check products API separately (it returns { success: true, data: { products: [...] } })
      if (allProductsData && allProductsData.success === false) {
        console.warn('Products API returned error, but continuing with other data')
      }

      // Process products data - aggregate stock across all branches
      const productsMap = new Map()
      
      // Handle different API response structures
      // Products API returns: { success: true, data: { products: [...] }, message: "OK" }
      let productsList: any[] = []
      if (Array.isArray(allProductsData)) {
        productsList = allProductsData
      } else if (allProductsData && allProductsData.data && Array.isArray(allProductsData.data.products)) {
        productsList = allProductsData.data.products
      } else if (allProductsData && Array.isArray(allProductsData.products)) {
        productsList = allProductsData.products
      } else if (allProductsData && Array.isArray(allProductsData.data)) {
        productsList = allProductsData.data
      } else if (allProductsData && allProductsData.success && allProductsData.data && Array.isArray(allProductsData.data.products)) {
        productsList = allProductsData.data.products
      } else if (allProductsData && allProductsData.success && Array.isArray(allProductsData.data)) {
        productsList = allProductsData.data
      } else if (allProductsData && allProductsData.success && Array.isArray(allProductsData.products)) {
        productsList = allProductsData.products
      }
      
      console.log('Products data structure:', { 
        isArray: Array.isArray(allProductsData),
        hasData: !!allProductsData?.data,
        hasProducts: !!allProductsData?.data?.products,
        productsCount: productsList.length
      })
      
      // Only process if we have a valid array
      if (Array.isArray(productsList) && productsList.length > 0) {
        productsList.forEach((product: any) => {
          const productId = product.product_id
          if (!productsMap.has(productId)) {
            productsMap.set(productId, {
              product_id: productId,
              product_name: product.product_name,
              brand: product.brand || 'N/A',
              model: product.model || 'N/A',
              category_name: product.category_name || 'N/A',
              price: product.display_price || product.price || 0,
              total_stock: 0,
              sold_count: parseInt(product.sold_count || 0)
            })
          }
          // Aggregate stock from all branches
          const currentStock = parseInt(product.stock_quantity || 0)
          const existing = productsMap.get(productId)
          if (existing) {
            existing.total_stock += currentStock
          }
        })
      }
      
      const allProductsWithStock = Array.from(productsMap.values())

      // Calculate top selling products by quantity from order details
      const orderDetails = orderDetailsData.data?.data || []
      const productQuantities: Record<number, { name: string; quantity: number; revenue: number }> = {}
      
      orderDetails.forEach((order: any) => {
        if (order.product_id && order.quantity) {
          const productId = order.product_id
          if (!productQuantities[productId]) {
            productQuantities[productId] = {
              name: order.product_name || 'Unknown Product',
              quantity: 0,
              revenue: 0
            }
          }
          productQuantities[productId].quantity += parseInt(order.quantity || 0)
          productQuantities[productId].revenue += parseFloat(order.subtotal || 0)
        }
      })
      
      const topSellingProducts = Object.entries(productQuantities)
        .map(([productId, data]) => ({
          product_id: parseInt(productId),
          product_name: data.name,
          total_quantity: data.quantity,
          total_revenue: data.revenue
        }))
        .sort((a, b) => b.total_quantity - a.total_quantity)
        .slice(0, 10)

      setData({
        dailySales: dailySalesData.data?.data || [],
        topSellingProducts: topSellingProducts,
        topProducts: topProductsData.data?.data || [],
        orderStatusDistribution: orderStatusData.data?.data || [],
        lowStockAlerts: lowStockData.data?.data || [],
        customerPurchaseSummary: customerSummaryData.data?.data || [],
        monthlySales: monthlySalesData.data?.data || [],
        branchSales: branchSalesData.data?.data || [],
        allProducts: allProductsWithStock
      })
      
      setLoading(false)
    } catch (err) {
      console.error('Analytics fetch error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while loading analytics')
      setLoading(false)
      // Set empty data to prevent crashes
      setData({
        dailySales: [],
        topSellingProducts: [],
        topProducts: [],
        orderStatusDistribution: [],
        lowStockAlerts: [],
        customerPurchaseSummary: [],
        monthlySales: [],
        branchSales: [],
        allProducts: []
      })
    }
  }

  // Prepare chart data
  const prepareDailySalesChart = () => {
    if (!data?.dailySales.length) return null

    // Group by date and sum revenue
    const salesByDate: Record<string, number> = {}
    data.dailySales.forEach(sale => {
      const date = sale.sale_date
      if (!salesByDate[date]) {
        salesByDate[date] = 0
      }
      salesByDate[date] += parseFloat(sale.total_revenue || 0)
    })

    const dates = Object.keys(salesByDate).sort()
    const revenues = dates.map(date => salesByDate[date])

    return {
      labels: dates.map(date => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [{
        label: `Daily Revenue (${currency})`,
        data: revenues,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: true,
        tension: 0.4
      }]
    }
  }

  const prepareTopSellingProductsChart = () => {
    if (!data?.topSellingProducts || data.topSellingProducts.length === 0) return null

    const products = data.topSellingProducts.slice(0, 10)
    
    const colors = [
      'rgba(54, 162, 235, 0.8)',
      'rgba(255, 99, 132, 0.8)',
      'rgba(255, 206, 86, 0.8)',
      'rgba(75, 192, 192, 0.8)',
      'rgba(153, 102, 255, 0.8)',
      'rgba(255, 159, 64, 0.8)',
      'rgba(199, 199, 199, 0.8)',
      'rgba(83, 102, 255, 0.8)',
      'rgba(255, 99, 255, 0.8)',
      'rgba(99, 255, 132, 0.8)',
    ]

    return {
      labels: products.map(p => p.product_name?.substring(0, 25) || 'Unknown'),
      datasets: [{
        label: 'Units Sold',
        data: products.map(p => p.total_quantity),
        backgroundColor: colors.slice(0, products.length),
        borderColor: colors.slice(0, products.length).map(c => c.replace('0.8', '1')),
        borderWidth: 2
      }]
    }
  }

  const prepareTopProductsChart = () => {
    if (!data?.topProducts.length) return null

    const products = data.topProducts.slice(0, 10)
    
    const chartData = {
      labels: products.map(p => p.product_name?.substring(0, 20) || 'Unknown'),
      datasets: [{
        label: 'Average Rating',
        data: products.map(p => parseFloat(p.average_rating || 0)),
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }],
      // Store product data for tooltip access
      products: products
    }
    
    return chartData
  }

  const prepareOrderStatusChart = () => {
    if (!data?.orderStatusDistribution.length) return null

    const statusCounts: Record<string, number> = {}
    data.orderStatusDistribution.forEach(order => {
      const status = order.order_status || 'unknown'
      statusCounts[status] = (statusCounts[status] || 0) + 1
    })

    const colors: Record<string, string> = {
      'pending': 'rgba(255, 206, 86, 0.8)',
      'processing': 'rgba(54, 162, 235, 0.8)',
      'shipped': 'rgba(75, 192, 192, 0.8)',
      'delivered': 'rgba(75, 192, 192, 0.8)',
      'cancelled': 'rgba(255, 99, 132, 0.8)'
    }

    return {
      labels: Object.keys(statusCounts).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
      datasets: [{
        label: 'Orders by Status',
        data: Object.values(statusCounts),
        backgroundColor: Object.keys(statusCounts).map(s => colors[s] || 'rgba(153, 102, 255, 0.8)'),
        borderColor: Object.keys(statusCounts).map(s => colors[s]?.replace('0.8', '1') || 'rgba(153, 102, 255, 1)'),
        borderWidth: 2
      }]
    }
  }

  const prepareLowStockChart = () => {
    if (!data?.lowStockAlerts.length) return null

    // Group by alert level
    const alertsByLevel: Record<string, number> = {}
    data.lowStockAlerts.forEach(alert => {
      const level = alert.alert_level || 'Unknown'
      alertsByLevel[level] = (alertsByLevel[level] || 0) + 1
    })

    return {
      labels: Object.keys(alertsByLevel),
      datasets: [{
        label: 'Low Stock Alerts',
        data: Object.values(alertsByLevel),
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',   // Out of Stock
          'rgba(255, 159, 64, 0.8)',   // Critical Low Stock
          'rgba(255, 206, 86, 0.8)',   // Low Stock
          'rgba(75, 192, 192, 0.8)'    // Adequate Stock
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)'
        ],
        borderWidth: 2
      }]
    }
  }

  const prepareTopCustomersChart = () => {
    if (!data?.customerPurchaseSummary.length) return null

    const customers = data.customerPurchaseSummary.slice(0, 10)
    
    return {
      labels: customers.map(c => `${c.first_name} ${c.last_name}`.substring(0, 15)),
      datasets: [{
        label: 'Total Spent',
        data: customers.map(c => parseFloat(c.total_spent || 0)),
        backgroundColor: 'rgba(153, 102, 255, 0.8)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1
      }]
    }
  }

  const prepareBranchSalesChart = () => {
    if (!data?.branchSales.length) return null

    // Aggregate sales by branch
    const salesByBranch: Record<string, number> = {}
    data.branchSales.forEach(sale => {
      const branch = sale.branch_name || 'Unknown'
      if (!salesByBranch[branch]) {
        salesByBranch[branch] = 0
      }
      salesByBranch[branch] += parseFloat(sale.total_revenue || 0)
    })

    return {
      labels: Object.keys(salesByBranch),
      datasets: [{
        label: 'Revenue by Branch',
        data: Object.values(salesByBranch),
        backgroundColor: 'rgba(75, 192, 192, 0.8)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    }
  }

  const prepareProductsStockVsSoldChart = () => {
    if (!data?.allProducts || data.allProducts.length === 0) return null

    // Sort products by total stock (descending) and limit to top 20 for readability
    const sortedProducts = [...data.allProducts]
      .sort((a: any, b: any) => (b.total_stock + b.sold_count) - (a.total_stock + a.sold_count))
      .slice(0, 20)

    return {
      labels: sortedProducts.map((p: any) => p.product_name.substring(0, 30)),
      datasets: [
        {
          label: 'Stock',
          data: sortedProducts.map((p: any) => p.total_stock),
          backgroundColor: 'rgba(54, 162, 235, 0.8)', // Blue
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        },
        {
          label: 'Sold',
          data: sortedProducts.map((p: any) => p.sold_count),
          backgroundColor: 'rgba(255, 99, 132, 0.8)', // Red
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }
      ]
    }
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        font: {
          size: 16,
          weight: 'bold' as const
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading analytics data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-warning">
        <h5 className="alert-heading">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Unable to Load Analytics
        </h5>
        <p className="mb-0">{error}</p>
        <hr />
        <button className="btn btn-sm btn-primary" onClick={fetchAnalyticsData}>
          <i className="bi bi-arrow-clockwise me-2"></i>
          Try Again
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="alert alert-info">
        <p className="mb-0">No analytics data available. Please try refreshing.</p>
      </div>
    )
  }

  return (
    <div className="admin-analytics-page">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h3 mb-0">
            <i className="bi bi-graph-up me-2"></i>
            Analytics & Reports
          </h1>
          
          <div className="d-flex gap-2">
            <input
              type="date"
              className="form-control"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
            <input
              type="date"
              className="form-control"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
            <button
              className="btn btn-primary"
              onClick={fetchAnalyticsData}
            >
              <i className="bi bi-arrow-clockwise me-2"></i>
              Refresh
            </button>
          </div>
        </div>

        <div className="row g-4">
          {/* Daily Sales Trend - Line Chart */}
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-graph-up me-2"></i>
                  Daily Sales Trend
                </h5>
              </div>
              <div className="card-body">
                <div className="chart-container">
                  {prepareDailySalesChart() ? (
                    <Line data={prepareDailySalesChart()!} options={{
                      ...chartOptions,
                      plugins: {
                        ...chartOptions.plugins,
                        title: { display: true, text: `Revenue Over Time (${currency})` },
                        tooltip: {
                          callbacks: {
                            label: (context: any) => {
                              const value = context.parsed.y
                              return `${context.dataset.label}: ${formatPrice(value, currency)}`
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: (value: any) => {
                              return formatPrice(value, currency)
                            }
                          },
                          title: {
                            display: true,
                            text: `Revenue (${currency})`
                          }
                        }
                      }
                    }} />
                  ) : (
                    <div className="text-center text-muted py-5">
                      <i className="bi bi-graph-up fs-1 d-block mb-2"></i>
                      <p>No sales data available for the selected date range</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Top Selling Products by Quantity - Bar Chart */}
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-bar-chart me-2"></i>
                  Top Selling Products 
                </h5>
              </div>
              <div className="card-body">
                <div className="chart-container">
                  {prepareTopSellingProductsChart() ? (
                    <Bar data={prepareTopSellingProductsChart()!} options={{
                      ...chartOptions,
                      indexAxis: 'y',
                      plugins: {
                        ...chartOptions.plugins,
                        title: { display: true, text: 'Top 10 Products by Units Sold' },
                        legend: { display: false }
                      },
                      scales: {
                        x: {
                          beginAtZero: true,
                          ticks: {
                            stepSize: 1
                          },
                          title: {
                            display: true,
                            text: 'Units Sold'
                          }
                        },
                        y: {
                          title: {
                            display: true,
                            text: 'Products'
                          }
                        }
                      }
                    }} />
                  ) : (
                    <div className="text-center text-muted py-5">
                      <i className="bi bi-bar-chart fs-1 d-block mb-2"></i>
                      <p>No sales data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Order Status Distribution - Doughnut Chart */}
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-pie-chart-fill me-2"></i>
                  Order Status Distribution
                </h5>
              </div>
              <div className="card-body">
                <div className="chart-container">
                  {prepareOrderStatusChart() ? (
                    <Doughnut data={prepareOrderStatusChart()!} options={{
                      ...chartOptions,
                      plugins: {
                        ...chartOptions.plugins,
                        title: { display: true, text: 'Orders by Status' }
                      }
                    }} />
                  ) : (
                    <div className="text-center text-muted py-5">
                      <i className="bi bi-pie-chart-fill fs-1 d-block mb-2"></i>
                      <p>No order data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Top Rated Products - Bar Chart */}
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-bar-chart me-2"></i>
                  Top Rated Products
                </h5>
              </div>
              <div className="card-body">
                <div className="chart-container">
                  {prepareTopProductsChart() ? (
                    <Bar data={prepareTopProductsChart()!} options={{
                      ...chartOptions,
                      plugins: {
                        ...chartOptions.plugins,
                        title: { display: true, text: 'Top Rated Products' },
                        tooltip: {
                          callbacks: {
                            label: (context: any) => {
                              const chartData = prepareTopProductsChart()
                              const product = chartData?.products?.[context.dataIndex]
                              const rating = context.parsed.y
                              let label = `Rating: ${rating.toFixed(1)}/5.0`
                              // Check for price in various possible fields (converted price, display_price, or price_php)
                              const price = product?.price || product?.display_price || product?.price_php
                              if (product && price) {
                                label += ` | Price: ${formatPrice(price, currency)}`
                              }
                              return label
                            },
                            afterLabel: (context: any) => {
                              const chartData = prepareTopProductsChart()
                              const product = chartData?.products?.[context.dataIndex]
                              if (product && product.review_count) {
                                return `Reviews: ${product.review_count}`
                              }
                              return ''
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          max: 5,
                          ticks: {
                            stepSize: 0.5
                          },
                          title: {
                            display: true,
                            text: 'Average Rating (out of 5)'
                          }
                        }
                      }
                    }} />
                  ) : (
                    <div className="text-center text-muted py-5">
                      <i className="bi bi-bar-chart fs-1 d-block mb-2"></i>
                      <p>No product rating data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Low Stock Alerts - Bar Chart */}
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Low Stock Alerts
                </h5>
              </div>
              <div className="card-body">
                <div className="chart-container">
                  {prepareLowStockChart() ? (
                    <Bar data={prepareLowStockChart()!} options={{
                      ...chartOptions,
                      plugins: {
                        ...chartOptions.plugins,
                        title: { display: true, text: 'Stock Alert Levels' }
                      }
                    }} />
                  ) : (
                    <div className="text-center text-muted py-5">
                      <i className="bi bi-exclamation-triangle fs-1 d-block mb-2"></i>
                      <p>No stock alert data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Top Customers - Bar Chart */}
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-people me-2"></i>
                  Top Customers by Purchase Value
                </h5>
              </div>
              <div className="card-body">
                <div className="chart-container">
                  {prepareTopCustomersChart() ? (
                    <Bar data={prepareTopCustomersChart()!} options={{
                      ...chartOptions,
                      plugins: {
                        ...chartOptions.plugins,
                        title: { display: true, text: 'Customer Lifetime Value' }
                      }
                    }} />
                  ) : (
                    <div className="text-center text-muted py-5">
                      <i className="bi bi-people fs-1 d-block mb-2"></i>
                      <p>No customer data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Branch Sales Comparison - Bar Chart */}
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-shop me-2"></i>
                  Sales by Branch
                </h5>
              </div>
              <div className="card-body">
                <div className="chart-container">
                  {prepareBranchSalesChart() ? (
                    <Bar data={prepareBranchSalesChart()!} options={{
                      ...chartOptions,
                      plugins: {
                        ...chartOptions.plugins,
                        title: { display: true, text: 'Branch Performance' }
                      }
                    }} />
                  ) : (
                    <div className="text-center text-muted py-5">
                      <i className="bi bi-shop fs-1 d-block mb-2"></i>
                      <p>No branch sales data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* All Products Stock vs Sold - Combined Chart and Table */}
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-bar-chart me-2"></i>
                  All Products: Stock vs Sold
                </h5>
              </div>
              <div className="card-body">
                {/* Bar Chart Section */}
                <div className="mb-4">
                  <h6 className="mb-3">
                    <i className="bi bi-graph-up me-2"></i>
                    Visual Overview
                  </h6>
                  {prepareProductsStockVsSoldChart() ? (
                    <div className="chart-container" style={{ height: '500px' }}>
                      <Bar 
                        data={prepareProductsStockVsSoldChart()!} 
                        options={{
                          ...chartOptions,
                          indexAxis: 'y' as const, // Horizontal bars
                          plugins: {
                            ...chartOptions.plugins,
                            title: { display: true, text: 'Stock (Blue) vs Sold (Red) by Product' },
                            legend: {
                              display: true,
                              position: 'top' as const
                            }
                          },
                          scales: {
                            x: {
                              beginAtZero: true,
                              stacked: false,
                              title: {
                                display: true,
                                text: 'Quantity'
                              }
                            },
                            y: {
                              beginAtZero: true,
                              title: {
                                display: true,
                                text: 'Products'
                              }
                            }
                          }
                        }} 
                      />
                    </div>
                  ) : (
                    <div className="text-center text-muted py-5">
                      <i className="bi bi-bar-chart fs-1 d-block mb-2"></i>
                      <p>No product data available for chart</p>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <hr className="my-4" />

                {/* Detailed Table Section */}
                <div>
                  <h6 className="mb-3">
                    <i className="bi bi-table me-2"></i>
                    Detailed Data
                  </h6>
                {data.allProducts && data.allProducts.length > 0 ? (
                  <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    <table className="table table-striped table-hover">
                      <thead className="table-dark sticky-top">
                        <tr>
                          <th>Product ID</th>
                          <th>Product Name</th>
                          <th>Brand</th>
                          <th>Model</th>
                          <th>Category</th>
                          <th>Price</th>
                          <th className="text-center">Total Stock</th>
                          <th className="text-center">Sold</th>
                          <th className="text-center">Remaining</th>
                          <th className="text-center">Stock Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.allProducts.map((product: any) => {
                          const remaining = product.total_stock - product.sold_count
                          const stockPercentage = product.total_stock > 0 
                            ? ((remaining / product.total_stock) * 100).toFixed(1) 
                            : '0.0'
                          const stockStatus = remaining <= 0 
                            ? 'danger' 
                            : remaining <= 10 
                            ? 'warning' 
                            : 'success'
                          
                          return (
                            <tr key={product.product_id}>
                              <td>#{product.product_id}</td>
                              <td><strong>{product.product_name}</strong></td>
                              <td>{product.brand}</td>
                              <td>{product.model}</td>
                              <td>{product.category_name}</td>
                              <td>{formatPrice(product.price, currency)}</td>
                              <td className="text-center">
                                <span className="badge bg-info">{product.total_stock}</span>
                              </td>
                              <td className="text-center">
                                <span className="badge bg-secondary">{product.sold_count}</span>
                              </td>
                              <td className="text-center">
                                <span className={`badge bg-${stockStatus}`}>{remaining}</span>
                              </td>
                              <td className="text-center">
                                <div className="progress" style={{ height: '20px', minWidth: '100px' }}>
                                  <div 
                                    className={`progress-bar bg-${stockStatus}`}
                                    role="progressbar"
                                    style={{ width: `${Math.min(100, parseFloat(stockPercentage))}%` }}
                                    aria-valuenow={stockPercentage}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                  >
                                    {stockPercentage}%
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="table-secondary">
                        <tr>
                          <td colSpan={6}><strong>Totals:</strong></td>
                          <td className="text-center">
                            <strong>{data.allProducts.reduce((sum: number, p: any) => sum + p.total_stock, 0)}</strong>
                          </td>
                          <td className="text-center">
                            <strong>{data.allProducts.reduce((sum: number, p: any) => sum + p.sold_count, 0)}</strong>
                          </td>
                          <td className="text-center">
                            <strong>
                              {data.allProducts.reduce((sum: number, p: any) => sum + (p.total_stock - p.sold_count), 0)}
                            </strong>
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-muted py-5">
                    <i className="bi bi-table fs-1 d-block mb-2"></i>
                    <p>No product data available</p>
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

export default AdminAnalytics

