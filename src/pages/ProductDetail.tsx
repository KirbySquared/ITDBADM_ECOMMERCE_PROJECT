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
  sold_count?: number
  category_name?: string
  images?: ProductImage[]
}

type Review = {
  review_id: number
  user_id: number
  product_id: number
  rating: number
  comment: string | null
  created_at: string
  username?: string
  email?: string
  first_name?: string
  last_name?: string
  verified_purchase?: number
  purchase_quantity?: number
  first_purchase_date?: string | null
}

type ReviewsData = {
  reviews: Review[]
  summary: {
    total_reviews: number
    average_rating: number
    rating_distribution: { [key: number]: number }
    rating_percentages: { [key: number]: number }
    verified_purchases?: number
    total_purchases_by_reviewers?: number
  }
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
  const [reviews, setReviews] = useState<ReviewsData | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(false)

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true)
        setError(null)

        // Use user's branch_id if available
        const url = api(`/products?id=${encodeURIComponent(id)}&currency=${encodeURIComponent(currency)}`)

        // Build fetch options - include auth header if user is logged in
        const token = localStorage.getItem('token')
        const fetchOptions: RequestInit = { credentials: 'include' }
        if (token) {
          fetchOptions.headers = {
            'Authorization': `Bearer ${token}`
          }
        }

        const res = await fetch(url, fetchOptions)
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

  // Fetch reviews for the product
  useEffect(() => {
    const fetchReviews = async () => {
      if (!id || !product) return
      
      try {
        setReviewsLoading(true)
        const url = api(`/reviews?product_id=${encodeURIComponent(id)}`)
        const res = await fetch(url, { credentials: 'include' })
        
        if (!res.ok) {
          throw new Error('Failed to fetch reviews')
        }
        
        const json = await res.json()
        if (json?.success === false) {
          throw new Error(json?.message || 'Failed to fetch reviews')
        }
        
        setReviews(json?.data || null)
      } catch (e: any) {
        console.error('Failed to fetch reviews:', e)
        // Don't show error to user, just set empty reviews
        setReviews({
          reviews: [],
          summary: {
            total_reviews: 0,
            average_rating: 0,
            rating_distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
            rating_percentages: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
          }
        })
      } finally {
        setReviewsLoading(false)
      }
    }

    if (product?.product_id) {
      fetchReviews()
    }
  }, [id, product?.product_id])

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

          {/* Stock and Sales Information */}
          <div className="mt-3 mb-3 p-3 bg-light rounded">
            <div className="row g-3">
              <div className="col-6">
                <div className="d-flex flex-column">
                  <span className="text-muted small">Sold</span>
                  <span className="fw-bold fs-5 text-success">
                    {product.sold_count ?? 0}
                  </span>
                </div>
              </div>
              <div className="col-6">
                <div className="d-flex flex-column">
                  <span className="text-muted small">
                    {user?.branch_name ? `In Stock at ${user.branch_name}` : 'In Stock (All Branches)'}
                  </span>
                  <span className={`fw-bold fs-5 ${availableStock > 0 ? 'text-primary' : 'text-danger'}`}>
                    {availableStock}
                  </span>
                </div>
              </div>
            </div>
          </div>

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
                Available{user?.branch_name ? ` at ${user.branch_name}` : ''}: {availableStock} units
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

      {/* Reviews Section */}
      <div className="row mt-5">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h3 className="card-title mb-4">Customer Reviews</h3>
              
              {reviewsLoading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading reviews...</span>
                  </div>
                </div>
              ) : reviews && reviews.summary.total_reviews > 0 ? (
                <>
                  {/* Average Rating and Distribution */}
                  <div className="row mb-4">
                    <div className="col-md-4 text-center mb-3 mb-md-0">
                      <div className="d-flex flex-column align-items-center">
                        <div className="display-4 fw-bold text-primary mb-2">
                          {reviews.summary.average_rating.toFixed(1)}
                        </div>
                        <div className="mb-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <i
                              key={star}
                              className={`bi ${
                                star <= Math.round(reviews.summary.average_rating)
                                  ? 'bi-star-fill text-warning'
                                  : 'bi-star text-muted'
                              }`}
                              style={{ fontSize: '1.2rem' }}
                            />
                          ))}
                        </div>
                        <div className="text-muted small">
                          Based on {reviews.summary.total_reviews}{' '}
                          {reviews.summary.total_reviews === 1 ? 'review' : 'reviews'}
                        </div>
                        {reviews.summary.verified_purchases !== undefined && reviews.summary.verified_purchases > 0 && (
                          <div className="text-success small mt-1">
                            <i className="bi bi-check-circle-fill me-1"></i>
                            {reviews.summary.verified_purchases} verified {reviews.summary.verified_purchases === 1 ? 'purchase' : 'purchases'}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="col-md-8">
                      <div className="rating-distribution">
                        {[5, 4, 3, 2, 1].map((rating) => {
                          const count = reviews.summary.rating_distribution[rating] || 0
                          const percentage = reviews.summary.rating_percentages[rating] || 0
                          
                          return (
                            <div key={rating} className="d-flex align-items-center">
                              <div className="text-end me-2" style={{ width: '35px' }}>
                                <span className="small fw-bold">{rating}</span>
                                <i className="bi bi-star-fill text-warning ms-1" style={{ fontSize: '0.75rem' }}></i>
                              </div>
                              <div className="flex-grow-1 me-2">
                                <div className="progress">
                                  <div
                                    className="progress-bar bg-warning"
                                    role="progressbar"
                                    style={{ width: `${percentage}%` }}
                                    aria-valuenow={percentage}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                  >
                                  </div>
                                </div>
                              </div>
                              <div className="text-muted small" style={{ width: '40px', textAlign: 'right', fontSize: '0.85rem' }}>
                                {count}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <hr className="my-4" />

                  {/* Individual Reviews */}
                  <div className="reviews-list">
                    <h5 className="mb-3">All Reviews</h5>
                    {reviews.reviews.map((review) => (
                      <div key={review.review_id} className="border-bottom pb-3 mb-3">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <span className="fw-bold">
                                {review.first_name && review.last_name
                                  ? `${review.first_name} ${review.last_name}`
                                  : review.username || review.email || 'Anonymous User'}
                              </span>
                              {review.verified_purchase === 1 && (
                                <span className="badge bg-success" title="Verified Purchase">
                                  <i className="bi bi-check-circle-fill me-1"></i>
                                  Verified Purchase
                                </span>
                              )}
                              {review.purchase_quantity && review.purchase_quantity > 0 && (
                                <span className="text-muted small">
                                  ({review.purchase_quantity} {review.purchase_quantity === 1 ? 'purchase' : 'purchases'})
                                </span>
                              )}
                            </div>
                            <div className="d-flex align-items-center mb-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <i
                                  key={star}
                                  className={`bi ${
                                    star <= review.rating
                                      ? 'bi-star-fill text-warning'
                                      : 'bi-star text-muted'
                                  }`}
                                  style={{ fontSize: '0.9rem' }}
                                />
                              ))}
                              <span className="ms-2 text-muted small">{review.rating}/5</span>
                            </div>
                          </div>
                          <div className="text-muted small text-end">
                            <div>
                              {new Date(review.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </div>
                            {review.first_purchase_date && (
                              <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                Purchased: {new Date(review.first_purchase_date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="mb-0 text-muted mt-2">{review.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-muted">
                  <i className="bi bi-chat-left-text fs-1 d-block mb-2"></i>
                  <p className="mb-0">No reviews yet. Be the first to review this product!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
