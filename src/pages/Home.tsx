import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../utils/currency'
import { useCurrency } from '../context/CurrencyContext'
import { useBranch } from '../context/BranchContext'   // ✅ added
import { api } from '../api/config'
import './Home.css'

interface Product {
  product_id: number
  product_name: string
  brand: string
  price: number
  display_price?: number
  currency: string
  primary_image_url?: string
  category_name: string
  stock_quantity: number
}

function Home() {
  const { currency } = useCurrency()
  const { branchId } = useBranch()                     // ✅ added
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFeaturedProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, branchId])                              // ✅ re-fetch when branch or currency changes

  const fetchFeaturedProducts = async () => {
    try {
      setLoading(true)
      const url = branchId
        ? api(`/products?limit=6&branch_id=${branchId}&currency=${encodeURIComponent(currency)}`)
        : api(`/products?limit=6&currency=${encodeURIComponent(currency)}`)

      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setFeaturedProducts(data?.data?.products ?? data?.products ?? [])
    } catch (err) {
      console.error('Error fetching featured products:', err)
      setFeaturedProducts([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="home">
      {/* Hero Section */}
      <section
        className="hero py-5 text-white"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div
          className="position-absolute top-0 start-0 w-100 h-100"
          style={{ opacity: 0.1, zIndex: 1 }}
        >
          <div
            style={{
              position: 'absolute',
              top: '10%',
              left: '10%',
              fontSize: '200px',
              fontFamily: 'monospace'
            }}
          >
            🎮
          </div>
          <div
            style={{
              position: 'absolute',
              top: '60%',
              right: '15%',
              fontSize: '150px'
            }}
          >
            🎮
          </div>
        </div>
        <div className="container position-relative" style={{ zIndex: 2 }}>
          <div className="row justify-content-center text-center align-items-center">
            <div className="col-lg-8">
              <div
                className="mb-4"
                style={{ fontSize: '4rem', animation: 'pulse 2s ease-in-out infinite' }}
              >
                🎮
              </div>
              <h1 className="display-3 fw-bold mb-4">Welcome to GameStore</h1>
              <p className="lead fs-4 mb-5 opacity-90">
                Discover the latest gaming products, consoles, and accessories
              </p>
              <div className="d-flex gap-3 justify-content-center flex-wrap">
                <Link to="/products" className="btn btn-warning btn-lg px-5 py-3 fw-bold">
                  <i className="bi bi-cart3 me-2"></i> Shop Now
                </Link>
                <Link to="/products" className="btn btn-light btn-lg px-5 py-3 fw-bold">
                  <i className="bi bi-search me-2"></i> Browse Products
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-5 bg-light">
        <div className="container">
          <div className="row mb-5">
            <div className="col-12 text-center">
              <div
                className="d-inline-block p-3 mb-3"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '20px'
                }}
              >
                <i className="bi bi-star-fill text-warning" style={{ fontSize: '2rem' }}></i>
              </div>
              <h2 className="display-4 fw-bold mb-3">Featured Products</h2>
              <p className="lead text-muted">
                {branchId
                  ? `Showing featured products for branch #${branchId}`
                  : 'Check out our latest and most popular items'}
              </p>
              <div
                className="mx-auto"
                style={{
                  width: '100px',
                  height: '4px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '2px'
                }}
              ></div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3">Loading featured products...</p>
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="text-center py-5">
              <div className="alert alert-info">
                <h5>No Products Available</h5>
                <p>Check back soon for exciting new products!</p>
              </div>
            </div>
          ) : (
            <div className="row g-4">
              {featuredProducts.map((product) => (
                <div key={product.product_id} className="col-lg-4 col-md-6">
                  <Link to={`/products/${product.product_id}`} className="text-decoration-none">
                    <div
                      className="card h-100 border-0 shadow-lg hover-lift"
                      style={{ borderRadius: '15px', overflow: 'hidden' }}
                    >
                      <div
                        className="position-relative"
                        style={{
                          height: '250px',
                          overflow: 'hidden',
                          background: '#f8f9fa'
                        }}
                      >
                        {product.primary_image_url ? (
                          <img
                            src={product.primary_image_url}
                            alt={product.product_name}
                            className="w-100 h-100"
                            style={{ objectFit: 'cover', transition: 'transform 0.3s ease' }}
                            onError={(e) => {
                              const t = e.target as HTMLImageElement
                              t.src =
                                'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
                            }}
                          />
                        ) : (
                          <div
                            className="bg-gradient d-flex align-items-center justify-content-center h-100"
                            style={{
                              background:
                                'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            }}
                          >
                            <i className="bi bi-controller text-white" style={{ fontSize: '4rem' }}></i>
                          </div>
                        )}
                        <div className="position-absolute top-0 end-0 m-3">
                          {product.stock_quantity > 0 ? (
                            <span className="badge bg-success rounded-pill px-3 py-2 shadow-sm">
                              <i className="bi bi-check-circle me-1"></i> In Stock
                            </span>
                          ) : (
                            <span className="badge bg-danger rounded-pill px-3 py-2 shadow-sm">
                              <i className="bi bi-x-circle me-1"></i> Out of Stock
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="card-body d-flex flex-column p-4">
                        <div className="mb-2">
                          <span className="badge bg-info text-dark mb-2">
                            {product.category_name}
                          </span>
                        </div>
                        <h5
                          className="card-title text-dark fw-bold mb-2"
                          style={{ minHeight: '3rem' }}
                        >
                          {product.product_name}
                        </h5>
                        <p className="text-muted mb-3 small">{product.brand}</p>
                        <div className="mt-auto">
                          <p className="mb-3">
                            <span className="text-primary fw-bold fs-3">
                              {formatPrice(product.display_price ?? product.price, product.currency)}
                            </span>
                          </p>
                          <button className="btn btn-primary w-100 fw-bold">
                            <i className="bi bi-cart-plus me-2"></i> View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {featuredProducts.length > 0 && (
            <div className="row mt-5">
              <div className="col-12 text-center">
                <Link
                  to="/products"
                  className="btn btn-lg px-5 py-3 fw-bold text-white"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: '50px'
                  }}
                >
                  <i className="bi bi-arrow-right me-2"></i> View All Products
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default Home
