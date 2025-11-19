import { useState, useEffect } from 'react'
import { api } from '../api/config'
import { useNotification } from '../context/NotificationContext'

interface Product {
  product_id: number
  product_name: string
  brand?: string
  model?: string
  product_image?: string
  has_reviewed?: number
  review_id?: number
  review_rating?: number
}

interface ReviewModalProps {
  show: boolean
  onHide: () => void
  orderId: number
  products: Product[]
  onReviewSubmitted?: () => void
}

function ReviewModal({ show, onHide, orderId, products, onReviewSubmitted }: ReviewModalProps) {
  const { showSuccess, showError } = useNotification()
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset form when modal is shown/hidden or product changes
  useEffect(() => {
    if (!show) {
      setSelectedProduct(null)
      setRating(0)
      setHoveredRating(0)
      setComment('')
    }
  }, [show])

  // Auto-select first unreviewed product when modal opens
  useEffect(() => {
    if (show && products.length > 0 && !selectedProduct) {
      const unreviewedProduct = products.find(p => !p.has_reviewed || p.has_reviewed === 0)
      if (unreviewedProduct) {
        setSelectedProduct(unreviewedProduct)
      } else {
        // All products reviewed, select first one
        setSelectedProduct(products[0])
      }
    }
  }, [show, products, selectedProduct])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedProduct) {
      showError('Please select a product to review')
      return
    }

    if (rating < 1 || rating > 5) {
      showError('Please select a rating between 1 and 5 stars')
      return
    }

    setSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        showError('Please log in to submit a review')
        return
      }

      const response = await fetch(api('/reviews'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_id: selectedProduct.product_id,
          rating: rating,
          comment: comment.trim() || null
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit review')
      }

      showSuccess('Review submitted successfully!')
      
      // Reset form
      setRating(0)
      setHoveredRating(0)
      setComment('')
      
      // Mark product as reviewed
      if (selectedProduct) {
        selectedProduct.has_reviewed = 1
        selectedProduct.review_id = data.data.review_id
        selectedProduct.review_rating = rating
      }

      // Callback to refresh data
      if (onReviewSubmitted) {
        onReviewSubmitted()
      }

      // Auto-select next unreviewed product
      const nextUnreviewed = products.find(p => 
        p.product_id !== selectedProduct?.product_id && 
        (!p.has_reviewed || p.has_reviewed === 0)
      )
      
      if (nextUnreviewed) {
        setSelectedProduct(nextUnreviewed)
      } else {
        // All products reviewed, close modal
        onHide()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit review'
      console.error('Review submission error:', error)
      showError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  if (!show) return null

  const unreviewedProducts = products.filter(p => !p.has_reviewed || p.has_reviewed === 0)
  const reviewedProducts = products.filter(p => p.has_reviewed && p.has_reviewed === 1)

  return (
    <div 
      className="modal show d-block" 
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onHide()
        }
      }}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-star-fill text-warning me-2"></i>
              Review Products - Order #{orderId}
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onHide}
              aria-label="Close"
            ></button>
          </div>
          
          <div className="modal-body">
            {/* Product Selection */}
            <div className="mb-4">
              <label className="form-label fw-bold">Select Product to Review</label>
              <div className="list-group">
                {products.map((product) => (
                  <button
                    key={product.product_id}
                    type="button"
                    className={`list-group-item list-group-item-action ${
                      selectedProduct?.product_id === product.product_id ? 'active' : ''
                    } ${product.has_reviewed ? 'opacity-75' : ''}`}
                    onClick={() => setSelectedProduct(product)}
                  >
                    <div className="d-flex align-items-center gap-3">
                      {product.product_image && (
                        <img 
                          src={product.product_image} 
                          alt={product.product_name}
                          style={{ width: '60px', height: '60px', objectFit: 'cover' }}
                          className="rounded"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                          }}
                        />
                      )}
                      <div className="flex-grow-1">
                        <div className="fw-bold">{product.product_name}</div>
                        {(product.brand || product.model) && (
                          <small className="text-muted">
                            {product.brand} {product.model}
                          </small>
                        )}
                      </div>
                      {product.has_reviewed ? (
                        <span className="badge bg-success">
                          <i className="bi bi-check-circle me-1"></i>
                          Reviewed ({product.review_rating}/5)
                        </span>
                      ) : (
                        <span className="badge bg-warning text-dark">
                          <i className="bi bi-star me-1"></i>
                          Not Reviewed
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Review Form */}
            {selectedProduct && (
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label fw-bold">
                    Rating <span className="text-danger">*</span>
                  </label>
                  <div className="d-flex align-items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className="btn btn-link p-0 border-0"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        style={{ fontSize: '2rem', lineHeight: 1 }}
                      >
                        <i
                          className={`bi ${
                            star <= (hoveredRating || rating)
                              ? 'bi-star-fill text-warning'
                              : 'bi-star text-muted'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ms-2 text-muted">
                      {rating > 0 ? `${rating} out of 5 stars` : 'Select rating'}
                    </span>
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="reviewComment" className="form-label fw-bold">
                    Comment (Optional)
                  </label>
                  <textarea
                    className="form-control"
                    id="reviewComment"
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your experience with this product..."
                    maxLength={1000}
                  />
                  <div className="form-text">
                    {comment.length}/1000 characters
                  </div>
                </div>

                {selectedProduct.has_reviewed ? (
                  <div className="alert alert-success">
                    <i className="bi bi-check-circle me-2"></i>
                    You have already reviewed this product with {selectedProduct.review_rating} stars.
                  </div>
                ) : (
                  <div className="alert alert-light">
                    <i className="bi bi-lightbulb me-2"></i>
                    {unreviewedProducts.length > 1 
                      ? `${unreviewedProducts.length} products remaining to review`
                      : 'This is your last product to review!'}
                  </div>
                )}

                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onHide}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting || rating < 1 || (selectedProduct.has_reviewed === 1)}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>
                        Submit Review
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReviewModal

