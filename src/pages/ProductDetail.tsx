import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
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
  const [addingToCart, setAddingToCart] = useState(false)
  const [addToCartMessage, setAddToCartMessage] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      fetchProduct()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [id])

  const fetchProduct = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`http://localhost:8000/api/products?id=${id}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch product')
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        console.error('Non-JSON response:', text)
        throw new Error('Server returned invalid response')
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch product')
      }
      
      setProduct(data.data)
    } catch (err) {
      console.error('Product fetch error:', err)
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

  const handleQuantityChange = (increase: boolean) => {
    if (!product) return
    const maxQty = Math.min(product.stock_quantity, 10)
    if (increase && quantity < maxQty) {
      setQuantity(quantity + 1)
    } else if (!increase && quantity > 1) {
      setQuantity(quantity - 1)
    }
  }

  const handleAddToCart = async () => {
    if (!product) return
    
    // Check if user is logged in
    const token = localStorage.getItem('token')
    if (!token) {
      // Redirect to login page
      window.location.href = '/login'
      return
    }

    setAddingToCart(true)
    setAddToCartMessage(null)

    try {
      const response = await fetch('http://localhost:8000/api/cart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_id: product.product_id,
          quantity: quantity
        })
      })

      const data = await response.json()
      
      if (response.ok && data.success) {
        setAddToCartMessage('Item added to cart!')
        // Trigger cart update event
        window.dispatchEvent(new Event('cartUpdated'))
        setTimeout(() => setAddToCartMessage(null), 3000)
      } else {
        setAddToCartMessage(data.message || 'Failed to add item to cart')
      }
    } catch (err) {
      console.error('Add to cart error:', err)
      setAddToCartMessage('Failed to add item to cart. Please try again.')
    } finally {
      setAddingToCart(false)
    }
  }

  return (
    <div className="product-detail py-5">
      <div className="container">
        {/* Breadcrumb - only show when product is loaded */}
        {product && (
          <nav aria-label="breadcrumb" className="mb-4">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <Link to="/" className="text-decoration-none">
                  <i className="bi bi-house-door me-1"></i>
                  Home
                </Link>
              </li>
              <li className="breadcrumb-item">
                <Link to="/products" className="text-decoration-none">Products</Link>
              </li>
              <li className="breadcrumb-item">
                <Link to={`/products?category=${product.category_name}`} className="text-decoration-none">
                  {product.category_name}
                </Link>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                {product.product_name}
              </li>
            </ol>
          </nav>
        )}

        <div className="row g-4">
          {/* Product Images */}
          <div className="col-lg-6">
            <div className="product-image-container">
              {currentImage ? (
                <div className="main-image-wrapper d-flex align-items-center justify-content-center bg-light" style={{height: '700px', padding: '3rem'}}>
                  <img 
                    src={currentImage} 
                    alt={product.product_name}
                    className="img-fluid"
                    style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'}}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
                    }}
                  />
                </div>
              ) : (
                <div className="main-image-wrapper d-flex align-items-center justify-content-center bg-light" style={{height: '700px'}}>
                  <i className="bi bi-image text-muted" style={{fontSize: '4rem'}}></i>
                </div>
              )}
              
              {/* Image thumbnails */}
              {allImages.length > 1 && (
                <div className="image-thumbnails px-4 py-3 border-top bg-white">
                  <div className="d-flex gap-2 justify-content-center flex-wrap">
                    {allImages.map((imageUrl, index) => (
                      <button
                        key={index}
                        className={`btn btn-outline-secondary p-1 border-2 ${selectedImageIndex === index ? 'border-primary' : 'border-secondary'}`}
                        onClick={() => setSelectedImageIndex(index)}
                        style={{width: '55px', height: '55px', padding: '2px', transition: 'all 0.2s', flexShrink: 0}}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <img 
                          src={imageUrl} 
                          alt={`${product.product_name} ${index + 1}`}
                          className="w-100 h-100 rounded"
                          style={{objectFit: 'cover'}}
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
          </div>
          
          {/* Product Info */}
          <div className="col-lg-6">
            <div className="bg-white rounded shadow-sm p-4">
              <h1 className="display-5 fw-bold mb-3">{product.product_name}</h1>
              
              <div className="d-flex align-items-center gap-3 mb-4">
                {product.stock_quantity > 0 ? (
                  <span className="badge bg-success rounded px-3 py-2">
                    <i className="bi bi-check-circle me-1"></i>
                    In Stock
                  </span>
                ) : (
                  <span className="badge bg-danger rounded px-3 py-2">
                    <i className="bi bi-x-circle me-1"></i>
                    Out of Stock
                  </span>
                )}
                <span className="badge bg-primary rounded px-3 py-2">
                  {product.category_name}
                </span>
              </div>

              {product.brand && (
                <p className="mb-2">
                  <span className="text-muted">Brand: </span>
                  <span className="fw-semibold">{product.brand}</span>
                </p>
              )}
              
              {product.model && (
                <p className="mb-4">
                  <span className="text-muted">Model: </span>
                  <span className="fw-semibold">{product.model}</span>
                </p>
              )}
              
              <div className="mb-4 pb-3 border-bottom">
                <div className="mb-3">
                  <span className="text-primary fw-bold" style={{fontSize: '2.5rem'}}>
                    {formatPrice(product.price, product.currency)}
                  </span>
                </div>
                <p className="text-muted mb-0 small">
                  <i className="bi bi-truck me-2"></i>
                  Free Shipping Available
                </p>
              </div>
              
              {product.description && (
                <div className="mb-4 pb-3 border-bottom">
                  <h6 className="fw-bold mb-2">Description</h6>
                  <p className="text-muted mb-0">{product.description}</p>
                </div>
              )}
              
              <div className="mb-4 pb-3 border-bottom">
                <div className="d-flex justify-content-between align-items-center py-3">
                  <span className="fw-semibold">
                    <i className="bi bi-box me-2"></i>
                    Available Stock
                  </span>
                  <span className="badge bg-secondary rounded px-3 py-2 fs-6">
                    {product.stock_quantity}
                  </span>
                </div>
              </div>
              
              {/* Success/Error Message */}
              {addToCartMessage && (
                <div className={`alert ${addToCartMessage.includes('added') ? 'alert-success' : 'alert-danger'} mb-3`}>
                  {addToCartMessage}
                </div>
              )}

              {/* Quantity Selector with Buttons */}
              <div className="product-actions">
                {product.stock_quantity > 0 ? (
                  <>
                    <label className="form-label mb-2">Quantity</label>
                    <div className="d-flex align-items-center gap-4 mb-4">
                      <div className="input-group" style={{width: '180px'}}>
                        <button 
                          className="btn btn-outline-secondary"
                          type="button"
                          onClick={() => handleQuantityChange(false)}
                          disabled={quantity <= 1}
                        >
                          <i className="bi bi-dash-lg"></i>
                        </button>
                        <input 
                          type="number" 
                          className="form-control text-center fw-bold" 
                          value={quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1
                            const maxQty = Math.min(product.stock_quantity, 10)
                            setQuantity(Math.max(1, Math.min(val, maxQty)))
                          }}
                          min="1"
                          max={Math.min(product.stock_quantity, 10)}
                        />
                        <button 
                          className="btn btn-outline-secondary"
                          type="button"
                          onClick={() => handleQuantityChange(true)}
                          disabled={quantity >= Math.min(product.stock_quantity, 10)}
                        >
                          <i className="bi bi-plus-lg"></i>
                        </button>
                      </div>
                      <button 
                        className="btn btn-primary fw-bold px-4"
                        style={{fontSize: '1rem'}}
                        onClick={handleAddToCart}
                        disabled={addingToCart}
                      >
                        {addingToCart ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Adding...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-cart-plus me-2"></i>
                            Add to Cart
                          </>
                        )}
                      </button>
                      <a 
                        href="#"
                        className="text-danger text-decoration-none"
                        onClick={(e) => { e.preventDefault(); }}
                      >
                        <i className="bi bi-heart me-1"></i>
                        Add to Wishlist
                      </a>
                    </div>
                  </>
                ) : (
                  <button 
                    className="btn btn-secondary w-100"
                    disabled
                  >
                    <i className="bi bi-x-circle me-2"></i>
                    Out of Stock
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetail
