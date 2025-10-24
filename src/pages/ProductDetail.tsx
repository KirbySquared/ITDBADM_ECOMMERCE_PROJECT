import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { formatPrice } from '../utils/currency'
import './ProductDetail.css'

interface ProductImage {
  image_id: number
  image_url: string
  alt_text?: string
  is_primary: boolean
  sort_order: number
  created_at: string
}

interface Product {
  product_id: number
  product_name: string
  brand: string
  model?: string
  price: number
  currency: string
  description?: string
  category_name: string
  stock_quantity: number
  images?: ProductImage[]
}

function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  useEffect(() => {
    if (id) {
      fetchProduct()
    }
  }, [id])

  const fetchProduct = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`http://localhost:8000/api/products?id=${id}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch product')
      }

      const data = await response.json()
      if (data.success) {
        setProduct(data.data)
      } else {
        throw new Error(data.message || 'Failed to fetch product')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch product')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="product-detail">
        <div className="container">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Loading product...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="product-detail">
        <div className="container">
          <div className="text-center py-5">
            <div className="alert alert-danger" role="alert">
              <h4>Error Loading Product</h4>
              <p>{error}</p>
              <button className="btn btn-primary" onClick={fetchProduct}>
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="product-detail">
        <div className="container">
          <div className="text-center py-5">
            <div className="alert alert-warning" role="alert">
              <h4>Product Not Found</h4>
              <p>The product you're looking for doesn't exist.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Get all available images (from images array or fallback to image_url)
  const allImages = product.images && product.images.length > 0 
    ? product.images.map(img => img.image_url)
    : []

  const currentImage = allImages[selectedImageIndex] || ''

  return (
    <div className="product-detail">
      <div className="container">
        <div className="product-detail-content">
          <div className="product-image">
            {currentImage ? (
              <img 
                src={currentImage} 
                alt={product.product_name}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
                }}
              />
            ) : (
              <div className="bg-light d-flex align-items-center justify-content-center h-100">
                <i className="bi bi-image text-muted" style={{fontSize: '4rem'}}></i>
              </div>
            )}
            
            {/* Image thumbnails */}
            {allImages.length > 1 && (
              <div className="image-thumbnails mt-3">
                <div className="d-flex gap-2 flex-wrap">
                  {allImages.map((imageUrl, index) => (
                    <button
                      key={index}
                      className={`btn btn-outline-secondary p-1 ${selectedImageIndex === index ? 'active' : ''}`}
                      onClick={() => setSelectedImageIndex(index)}
                      style={{width: '60px', height: '60px', padding: '2px'}}
                    >
                      <img 
                        src={imageUrl} 
                        alt={`${product.product_name} ${index + 1}`}
                        className="w-100 h-100"
                        style={{objectFit: 'cover', borderRadius: '4px'}}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="product-info">
            <h1>{product.product_name}</h1>
            {product.brand && <p className="text-muted">{product.brand}</p>}
            {product.model && <p className="text-muted">{product.model}</p>}
            <p className="price">{formatPrice(product.price, product.currency)}</p>
            {product.description && <p className="description">{product.description}</p>}
            
            <div className="product-meta">
              <p><strong>Category:</strong> {product.category_name}</p>
              <p><strong>Stock:</strong> {product.stock_quantity} available</p>
            </div>
            
            <div className="product-actions">
              <div className="quantity-selector">
                <label htmlFor="quantity">Quantity:</label>
                <select 
                  id="quantity" 
                  value={quantity} 
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                >
                  {Array.from({ length: Math.min(product.stock_quantity, 10) }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
              
              <button 
                className="btn btn-primary btn-large"
                disabled={product.stock_quantity === 0}
              >
                {product.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetail
