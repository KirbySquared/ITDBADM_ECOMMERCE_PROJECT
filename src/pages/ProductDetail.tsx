import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useCurrency } from '../context/CurrencyContext'
import { useAuth } from '../hooks/useAuth'
import { useNotification } from '../context/NotificationContext'
import { formatPrice } from '../utils/currency'
import { api } from '../api/config'
import './ProductDetail.css'

// Helper function to get category-based max quantity
function getMaxQuantity(categoryName: string | undefined): number {
  if (!categoryName) return 999 // No limit if category unknown
  const category = categoryName.toLowerCase()
  if (category === 'console') return 1
  if (category === 'game') return 5
  return 999 // No limit for other categories
}

type ProductImage = {
  image_id: number
  image_url: string
  alt_text?: string
  is_primary: 0 | 1
  sort_order?: number
  created_at?: string
}

type Product = {
  product_id: number
  product_name: string
  brand?: string
  model?: string
  description?: string
  price_php?: number
  currency: string
  display_price?: number
  primary_image_url?: string
  stock_quantity?: number
  category_name?: string
  images?: ProductImage[]
}

export default function ProductDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const { currency } = useCurrency()
  const { user, loading: authLoading } = useAuth()
  const { showSuccess, showError } = useNotification()
  // Get user's branch_id from profile - check if it exists (including 0 as valid)
  const userBranchId = user?.branch_id !== undefined && user?.branch_id !== null ? user.branch_id : null
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [addingToCart, setAddingToCart] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [zoomLevel, setZoomLevel] = useState(1)

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true)
        setError(null)

        // Use user's branch_id if available
        const url =
          userBranchId != null
            ? api(`/products?id=${encodeURIComponent(id)}&branch_id=${userBranchId}&currency=${encodeURIComponent(currency)}`)
            : api(`/products?id=${encodeURIComponent(id)}&currency=${encodeURIComponent(currency)}`)

        const res = await fetch(url, { credentials: 'include' })
        const ct = res.headers.get('content-type') || ''
        const parse = async () =>
          ct.includes('application/json') ? res.json() : JSON.parse(await res.text())

        if (!res.ok) {
          const body = await parse().catch(() => ({}))
          throw new Error(body?.message || `${res.status} ${res.statusText}`)
        }

        const json = await parse()
        if (json?.success === false) throw new Error(json?.message || 'API error')

        const p: Product = json?.data?.product ?? json?.data ?? json?.product
        if (!p) throw new Error('Product not found')

        setProduct(p)
      } catch (e: any) {
        setError(e?.message || 'Failed to load product')
      } finally {
        setLoading(false)
      }
    }

    // Wait for auth to finish loading before fetching product
    if (id && !authLoading) {
      fetchProduct()
    }
    // Re-run when branch or currency changes
  }, [id, currency, userBranchId, authLoading])

  // Reset quantity when product changes or when it exceeds max
  // This must be before any early returns to follow Rules of Hooks
  useEffect(() => {
    if (product) {
      const maxQuantity = getMaxQuantity(product.category_name)
      const availableStock = product.stock_quantity ?? 0
      const max = Math.min(maxQuantity, availableStock)
      if (quantity > max) {
        setQuantity(Math.max(1, max))
      }
      // Reset selected image and zoom when product changes
      setSelectedImageIndex(0)
      setZoomLevel(1)
    }
  }, [product, quantity])

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status" />
        <p className="mt-3">Loading product…</p>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-danger" style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>
          <h4 className="mb-2">Error</h4>
          <p className="mb-3">{error || 'Product not found'}</p>
          <Link className="btn btn-primary" to="/products">Back to Products</Link>
        </div>
      </div>
    )
  }

  const amount = product.display_price ?? product.price_php ?? 0
  const maxQuantity = getMaxQuantity(product.category_name)
  const availableStock = product.stock_quantity ?? 0
  const effectiveMax = Math.min(maxQuantity, availableStock)

  // Get all available images
  const allImages: ProductImage[] = product.images && product.images.length > 0
    ? product.images
    : product.primary_image_url
      ? [{ image_id: 0, image_url: product.primary_image_url, is_primary: 1 } as ProductImage]
      : []

  const currentImage = allImages[selectedImageIndex] || allImages[0]

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3))
  }

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5))
  }

  const handleResetZoom = () => {
    setZoomLevel(1)
  }

  const handleQuantityChange = (newQty: number) => {
    const max = Math.min(maxQuantity, availableStock)
    if (newQty < 1) {
      setQuantity(1)
    } else if (newQty > max) {
      setQuantity(max)
      showError(`Maximum quantity for ${product.category_name} category is ${maxQuantity}, and only ${availableStock} available in stock.`)
    } else {
      setQuantity(newQty)
    }
  }

  const addToCart = async () => {
    if (availableStock <= 0) {
      showError('Product is out of stock')
      return
    }

    if (quantity > maxQuantity) {
      showError(`Maximum quantity for ${product.category_name} category is ${maxQuantity}`)
      return
    }

    if (quantity > availableStock) {
      showError(`Only ${availableStock} units available in stock`)
      return
    }

    setAddingToCart(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        showError('Please log in to add items to cart')
        return
      }

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

      // Get response text first to handle errors better
      const responseText = await response.text()
      let data: any = {}
      
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        console.error('Failed to parse response:', responseText)
        throw new Error('Invalid response from server')
      }

      if (!response.ok || !data.success) {
        const errorMessage = data.message || `Failed to add to cart (HTTP ${response.status})`
        console.error('Cart API Error:', {
          status: response.status,
          statusText: response.statusText,
          data: data,
          responseText: responseText
        })
        throw new Error(errorMessage)
      }

      showSuccess(`Added ${quantity} ${quantity === 1 ? 'item' : 'items'} to cart!`)
      window.dispatchEvent(new Event('cartUpdated'))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add to cart'
      console.error('Add to cart error:', error)
      showError(errorMessage)
    } finally {
      setAddingToCart(false)
    }
  }

  return (
    <div className="container py-5">
      <div className="row g-4">
        <div className="col-md-6">
          <div className="product-image-container">
            <div 
              className="main-image-wrapper"
              style={{ 
                minHeight: '500px', 
                minWidth: '100%',
                height: '500px',
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              {currentImage ? (
                <>
                  <img
                    src={currentImage.image_url}
                    alt={currentImage.alt_text || product.product_name}
                    style={{ 
                      objectFit: 'contain',
                      transform: `scale(${zoomLevel})`,
                      transition: 'transform 0.3s ease',
                      width: '100%',
                      height: '100%'
                    }}
                    onError={(e) => {
                      const t = e.target as HTMLImageElement
                      t.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
                    }}
                  />
                  {/* Zoom Controls */}
                  <div 
                    className="position-absolute top-0 end-0 m-2 d-flex flex-column gap-1"
                    style={{ zIndex: 10 }}
                  >
                    <button
                      className="btn btn-sm btn-light shadow-sm"
                      onClick={handleZoomIn}
                      disabled={zoomLevel >= 3}
                      title="Zoom In"
                    >
                      <i className="bi bi-zoom-in"></i>
                    </button>
                    <button
                      className="btn btn-sm btn-light shadow-sm"
                      onClick={handleZoomOut}
                      disabled={zoomLevel <= 0.5}
                      title="Zoom Out"
                    >
                      <i className="bi bi-zoom-out"></i>
                    </button>
                    <button
                      className="btn btn-sm btn-light shadow-sm"
                      onClick={handleResetZoom}
                      disabled={zoomLevel === 1}
                      title="Reset Zoom"
                    >
                      <i className="bi bi-arrow-clockwise"></i>
                    </button>
                  </div>
                </>
              ) : (
                <div className="bg-light h-100 d-flex align-items-center justify-content-center">
                  <i className="bi bi-image text-muted fs-1"></i>
                </div>
              )}
            </div>
          </div>

          {/* Image Thumbnails */}
          {allImages.length > 1 && (
            <div className="image-thumbnails d-flex gap-2 mt-3 flex-wrap">
              {allImages.map((img, index) => (
                <button
                  key={img.image_id}
                  onClick={() => {
                    setSelectedImageIndex(index)
                    setZoomLevel(1) // Reset zoom when changing image
                  }}
                  className={`rounded border p-0 ${selectedImageIndex === index ? 'border-primary' : ''}`}
                  style={{ 
                    width: '80px', 
                    height: '80px', 
                    overflow: 'hidden',
                    background: 'white'
                  }}
                  title={img.alt_text || `Image ${index + 1}`}
                >
                  <img
                    src={img.image_url}
                    alt={img.alt_text || ''}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover',
                      pointerEvents: 'none'
                    }}
                    onError={(e) => {
                      const t = e.target as HTMLImageElement
                      t.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="col-md-6">
          <h2 className="fw-bold">{product.product_name}</h2>
          {product.brand && <p className="text-muted mb-1">{product.brand} {product.model}</p>}

          <div className="d-flex align-items-baseline gap-2 my-3">
            <span className="fs-3 fw-bold text-primary">
              {formatPrice(amount, product.currency)}
            </span>
            <span className="text-muted small">
              (Base in PHP: {formatPrice(product.price_php ?? 0, 'PHP')})
            </span>
          </div>

          <p className="mt-3">{product.description || 'No description provided.'}</p>

          <div className="mt-4">
            <div className="mb-3">
              <label htmlFor="quantity" className="form-label">
                Quantity
              </label>
              <div className="input-group" style={{ maxWidth: '200px' }}>
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={quantity <= 1 || availableStock === 0}
                >
                  <i className="bi bi-dash"></i>
                </button>
                <input
                  type="number"
                  className="form-control text-center"
                  id="quantity"
                  min="1"
                  max={effectiveMax}
                  value={quantity}
                  onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                  disabled={availableStock === 0}
                  style={{
                    WebkitAppearance: 'none',
                    MozAppearance: 'textfield'
                  }}
                />
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => handleQuantityChange(quantity + 1)}
                  disabled={quantity >= effectiveMax || availableStock === 0}
                >
                  <i className="bi bi-plus"></i>
                </button>
              </div>
              <div className="form-text">
                Available: {availableStock} units
                {product.category_name && ` • Max per ${product.category_name}: ${maxQuantity}`}
              </div>
            </div>

            <div className="d-flex gap-2">
              <button
                className="btn btn-primary"
                disabled={availableStock === 0 || addingToCart}
                onClick={addToCart}
              >
                {addingToCart ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Adding...
                  </>
                ) : availableStock === 0 ? (
                  'Out of Stock'
                ) : (
                  'Add to Cart'
                )}
              </button>
              <Link to="/products" className="btn btn-outline-secondary">Back to Products</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
