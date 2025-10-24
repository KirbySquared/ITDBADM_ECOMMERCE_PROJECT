import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../utils/currency'
import './Products.css'

interface Product {
  product_id: number
  product_name: string
  brand: string
  model?: string
  price: number
  currency: string
  primary_image_url?: string
  category_name: string
  stock_quantity: number
}

function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:8000/api/products')
      
      if (!response.ok) {
        throw new Error('Failed to fetch products')
      }

      const data = await response.json()
      if (data.success) {
        setProducts(data.data.products)
      } else {
        throw new Error(data.message || 'Failed to fetch products')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products')
    } finally {
      setLoading(false)
    }
  }
  const filteredProducts = filter === 'all' 
    ? products 
    : products.filter(product => product.category_name.toLowerCase() === filter)

  if (loading) {
    return (
      <div className="py-5">
        <div className="container">
          <div className="text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Loading products...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-5">
        <div className="container">
          <div className="text-center">
            <div className="alert alert-danger" role="alert">
              <h4>Error Loading Products</h4>
              <p>{error}</p>
              <button className="btn btn-primary" onClick={fetchProducts}>
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-5">
      <div className="container">
        <div className="row">
          <div className="col-12 text-center mb-5">
            <h1 className="display-4 fw-bold">Products</h1>
          </div>
        </div>
        
        {/* Filters */}
        <div className="row mb-5">
          <div className="col-12">
            <div className="d-flex justify-content-center flex-wrap gap-2">
              <button 
                className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setFilter('all')}
              >
                All Products
              </button>
              <button 
                className={`btn ${filter === 'consoles' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setFilter('consoles')}
              >
                Consoles
              </button>
              <button 
                className={`btn ${filter === 'accessories' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setFilter('accessories')}
              >
                Accessories
              </button>
              <button 
                className={`btn ${filter === 'games' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setFilter('games')}
              >
                Games
              </button>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="row g-4">
          {filteredProducts.map(product => (
            <div key={product.product_id} className="col-lg-4 col-md-6">
              <div className="card h-100 shadow-sm">
                  <div className="card-img-top" style={{height: '200px', overflow: 'hidden'}}>
                    {product.primary_image_url ? (
                      <img 
                        src={product.primary_image_url} 
                        alt={product.product_name}
                        className="w-100 h-100"
                        style={{objectFit: 'cover'}}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
                        }}
                      />
                    ) : (
                      <div className="bg-light d-flex align-items-center justify-content-center h-100">
                        <i className="bi bi-image text-muted fs-1"></i>
                      </div>
                    )}
                  </div>
                <div className="card-body d-flex flex-column">
                  <h5 className="card-title">{product.product_name}</h5>
                  {product.brand && <p className="card-text text-muted small">{product.brand}</p>}
                  <p className="card-text text-primary fw-bold fs-5">{formatPrice(product.price, product.currency)}</p>
                  <div className="mt-auto">
                    <div className="d-grid gap-2">
                      <Link to={`/products/${product.product_id}`} className="btn btn-outline-primary">
                        View Details
                      </Link>
                      <button 
                        className="btn btn-primary"
                        disabled={product.stock_quantity === 0}
                      >
                        {product.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Products
