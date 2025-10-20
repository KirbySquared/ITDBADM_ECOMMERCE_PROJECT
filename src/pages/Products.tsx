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
      <div className="products">
        <div className="container">
          <div className="loading">Loading products...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="products">
      <div className="container">
        <h1>Products</h1>
        
        {/* Filters */}
        <div className="filters">
          <button 
            className={filter === 'all' ? 'active' : ''} 
            onClick={() => setFilter('all')}
          >
            All Products
          </button>
          <button 
            className={filter === 'consoles' ? 'active' : ''} 
            onClick={() => setFilter('consoles')}
          >
            Consoles
          </button>
          <button 
            className={filter === 'accessories' ? 'active' : ''} 
            onClick={() => setFilter('accessories')}
          >
            Accessories
          </button>
          <button 
            className={filter === 'games' ? 'active' : ''} 
            onClick={() => setFilter('games')}
          >
            Games
          </button>
        </div>

        {/* Product Grid */}
        <div className="product-grid">
          {filteredProducts.map(product => (
            <div key={product.id} className="product-card">
              <div className="product-image">
                <img src={product.image} alt={product.name} />
              </div>
              <div className="product-info">
                <h3>{product.name}</h3>
                <p className="price">${product.price}</p>
                <div className="product-actions">
                  <Link to={`/products/${product.id}`} className="btn btn-outline">
                    View Details
                  </Link>
                  <button className="btn btn-primary">
                    Add to Cart
                  </button>
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
