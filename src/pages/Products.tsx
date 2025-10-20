import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Products.css'

interface Product {
  id: number
  name: string
  price: number
  image: string
  category: string
}

function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  // Mock data - will be replaced with API calls
  useEffect(() => {
    const mockProducts: Product[] = [
      { id: 1, name: 'PlayStation 5', price: 499.99, image: '/placeholder-product.jpg', category: 'consoles' },
      { id: 2, name: 'Xbox Series X', price: 499.99, image: '/placeholder-product.jpg', category: 'consoles' },
      { id: 3, name: 'Nintendo Switch', price: 299.99, image: '/placeholder-product.jpg', category: 'consoles' },
      { id: 4, name: 'Gaming Headset', price: 149.99, image: '/placeholder-product.jpg', category: 'accessories' },
      { id: 5, name: 'Gaming Mouse', price: 79.99, image: '/placeholder-product.jpg', category: 'accessories' },
      { id: 6, name: 'Gaming Keyboard', price: 129.99, image: '/placeholder-product.jpg', category: 'accessories' },
      { id: 7, name: 'Cyberpunk 2077', price: 59.99, image: '/placeholder-product.jpg', category: 'games' },
      { id: 8, name: 'Call of Duty', price: 69.99, image: '/placeholder-product.jpg', category: 'games' },
    ]
    
    setTimeout(() => {
      setProducts(mockProducts)
      setLoading(false)
    }, 1000)
  }, [])

  const filteredProducts = filter === 'all' 
    ? products 
    : products.filter(product => product.category === filter)

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
            <div key={product.id} className="col-lg-4 col-md-6">
              <div className="card h-100 shadow-sm">
                <div className="card-img-top bg-light" style={{height: '200px'}}>
                  <div className="d-flex align-items-center justify-content-center h-100">
                    <i className="bi bi-image text-muted fs-1"></i>
                  </div>
                </div>
                <div className="card-body d-flex flex-column">
                  <h5 className="card-title">{product.name}</h5>
                  <p className="card-text text-primary fw-bold fs-5">${product.price}</p>
                  <div className="mt-auto">
                    <div className="d-grid gap-2">
                      <Link to={`/products/${product.id}`} className="btn btn-outline-primary">
                        View Details
                      </Link>
                      <button className="btn btn-primary">
                        Add to Cart
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
