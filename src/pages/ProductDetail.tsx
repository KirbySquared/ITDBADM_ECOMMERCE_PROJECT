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
  const { user } = useAuth()
  const { showSuccess, showError } = useNotification()
  // Get user's branch_id from profile
  const userBranchId = user?.branch_id || null
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [addingToCart, setAddingToCart] = useState(false)

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

    if (id) fetchProduct()
    // Re-run when branch or currency changes
  }, [id, currency, userBranchId])

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
          <div className="border rounded" style={{ height: 380, overflow: 'hidden' }}>
            {product.primary_image_url ? (
              <img
                src={product.primary_image_url}
                alt={product.product_name}
                className="w-100 h-100"
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <div className="bg-light h-100 d-flex align-items-center justify-content-center">
                <i className="bi bi-image text-muted fs-1"></i>
              </div>
            )}
          </div>

          {product.images && product.images.length > 1 && (
            <div className="d-flex gap-2 mt-3 flex-wrap">
              {product.images.map(img => (
                <img
                  key={img.image_id}
                  src={img.image_url}
                  alt={img.alt_text || ''}
                  style={{ width: 80, height: 80, objectFit: 'cover' }}
                  className="rounded border"
                />
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
