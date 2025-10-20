import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import './ProductDetail.css'

interface Product {
  id: number
  name: string
  price: number
  image: string
  description: string
  category: string
  stock: number
}

function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    // Mock data - will be replaced with API call
    const mockProduct: Product = {
      id: parseInt(id || '1'),
      name: 'PlayStation 5',
      price: 499.99,
      image: '/placeholder-product.jpg',
      description: 'Experience lightning-fast loading with an ultra-high speed SSD, deeper immersion with support for haptic feedback, adaptive triggers and 3D Audio.',
      category: 'consoles',
      stock: 10
    }
    
    setTimeout(() => {
      setProduct(mockProduct)
      setLoading(false)
    }, 1000)
  }, [id])

  if (loading) {
    return (
      <div className="product-detail">
        <div className="container">
          <div className="loading">Loading product...</div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="product-detail">
        <div className="container">
          <div className="error">Product not found</div>
        </div>
      </div>
    )
  }

  return (
    <div className="product-detail">
      <div className="container">
        <div className="product-detail-content">
          <div className="product-image">
            <img src={product.image} alt={product.name} />
          </div>
          
          <div className="product-info">
            <h1>{product.name}</h1>
            <p className="price">${product.price}</p>
            <p className="description">{product.description}</p>
            
            <div className="product-meta">
              <p><strong>Category:</strong> {product.category}</p>
              <p><strong>Stock:</strong> {product.stock} available</p>
            </div>
            
            <div className="product-actions">
              <div className="quantity-selector">
                <label htmlFor="quantity">Quantity:</label>
                <select 
                  id="quantity" 
                  value={quantity} 
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                >
                  {Array.from({ length: Math.min(product.stock, 10) }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
              
              <button className="btn btn-primary btn-large">
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetail
