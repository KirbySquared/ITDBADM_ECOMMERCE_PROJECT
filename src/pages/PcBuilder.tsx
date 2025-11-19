// src/pages/PcBuilder.tsx
import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/config'
import { useCurrency } from '../context/CurrencyContext'
import { useNotification } from '../context/NotificationContext'
import { useAuth } from '../hooks/useAuth'
import { formatPrice } from '../utils/currency'

interface PcBuilderProduct {
  product_id: number
  product_name: string
  brand: string
  model?: string
  price: number
  price_php?: number // Base price in PHP
  currency: string
  primary_image_url?: string
}

interface PcBuilderCategory {
  category_id: number
  category_name: string
  products: PcBuilderProduct[]
}

interface ApiResponse {
  success: boolean
  message?: string
  data?: {
    categories: PcBuilderCategory[]
  }
}


function PcBuilder() {
  const { currency } = useCurrency()
  const { user } = useAuth()
  const { showSuccess, showError } = useNotification()
  const navigate = useNavigate()

  const [categories, setCategories] = useState<PcBuilderCategory[]>([])
  const [selected, setSelected] = useState<Record<number, PcBuilderProduct | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)


useEffect(() => {
  const fetchComponents = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(api(`/products?pc_builder=1&currency=${currency}`), {
        credentials: 'include', 
      })
      const json: ApiResponse = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to load PC builder components')
      }

      const cats = json.data?.categories || []
      setCategories(cats)

      const initial: Record<number, PcBuilderProduct | null> = {}
      cats.forEach(c => {
        initial[c.category_id] = null
      })
      setSelected(initial)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load PC builder components'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  fetchComponents()
}, [currency])


  // Selected components as array
  const selectedProducts = useMemo(
    () =>
      Object.values(selected).filter(
        (p): p is PcBuilderProduct => p !== null && p !== undefined
      ),
    [selected]
  )

  // Calculate subtotal: sum converted prices for display
  // Backend will recalculate from base prices (PHP) for accuracy
  const totalPrice = useMemo(() => {
    // Sum converted prices for display (p.price is already in selected currency)
    return selectedProducts.reduce((sum, p) => sum + (p.price || 0), 0)
  }, [selectedProducts])

  // Calculate discount based on number of selected components
  // 10% discount if at least 5 components selected (but not all 9)
  // 20% discount if all 9 components selected
  const discountInfo = useMemo(() => {
    const selectedCount = selectedProducts.length
    const totalCategories = categories.length
    let discountPercent = 0
    
    if (selectedCount === totalCategories && totalCategories === 9) {
      discountPercent = 20 // 20% discount for all 9 components
    } else if (selectedCount >= 5 && selectedCount < totalCategories) {
      discountPercent = 10 // 10% discount for 5+ components (but not all 9)
    }
    
    const discountAmount = (totalPrice * discountPercent) / 100
    const finalPrice = totalPrice - discountAmount
    
    return {
      discountPercent,
      discountAmount,
      finalPrice
    }
  }, [selectedProducts.length, totalPrice, categories.length])

  const handleSelect = (categoryId: number, productId: number | '') => {
    setSelected(prev => {
      const copy = { ...prev }
      if (!productId) {
        copy[categoryId] = null
        return copy
      }

      const cat = categories.find(c => c.category_id === categoryId)
      const prod = cat?.products.find(p => p.product_id === productId) || null
      copy[categoryId] = prod
      return copy
    })
  }

  const handleAddBuildToCart = async () => {
    if (selectedProducts.length < 2) {
      showError('Please select at least 2 components for your build.')
      return
    }

    const token = localStorage.getItem('token')
    if (!token) {
      showError('Please log in to add your build to cart.')
      navigate('/login')
      return
    }

    setSaving(true)
    try {
      // Prepare build items with category information
      // Use base price (PHP) for unit_price, backend will convert
      const buildItems = selectedProducts.map(product => {
        const category = categories.find(cat => 
          cat.products.some(p => p.product_id === product.product_id)
        )
        // Use base price in PHP for calculation
        const basePrice = (product as any).price_php || product.price || 0
        return {
          product_id: product.product_id,
          quantity: 1,
          unit_price: basePrice, // Send base price in PHP
          category_id: category?.category_id || null,
          category_name: category?.category_name || null
        }
      })
      
      // Calculate subtotal in PHP (sum of base prices)
      const subtotalInPhp = buildItems.reduce((sum, item) => sum + item.unit_price, 0)
      
      // Calculate discount in PHP
      const discountAmountInPhp = (subtotalInPhp * discountInfo.discountPercent) / 100
      const totalAmountInPhp = subtotalInPhp - discountAmountInPhp

      // Add build as a single bundle to cart
      const res = await fetch(api('/cart/pc-builder-build'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: buildItems,
          discount_percent: discountInfo.discountPercent,
          discount_amount: discountAmountInPhp, // Discount in PHP
          subtotal: subtotalInPhp, // Subtotal in PHP
          total_amount: totalAmountInPhp, // Total in PHP
          currency: currency, // Requested currency for conversion
          build_name: `Custom PC Build (${selectedProducts.length} components)`
        }),
      })

      const text = await res.text()
      let json: any = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        // ignore parse error, will fall back to generic message
      }

      if (!res.ok || json?.success === false) {
        // Handle expired token
        if (res.status === 401) {
          localStorage.removeItem('token')
          showError('Your session has expired. Please log in again.')
          navigate('/login')
          return
        }
        
        const msg =
          json?.message ||
          (typeof json === 'string' ? json : '') ||
          `Failed to add build to cart (HTTP ${res.status})`
        throw new Error(msg)
      }

      showSuccess('Your custom PC build has been added to cart!')
      window.dispatchEvent(new Event('cartUpdated'))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not add build to cart'
      showError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="py-5">
        <div className="container text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading PC builder components...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-5">
        <div className="container text-center">
          <div className="alert alert-danger">
            <h4>Unable to load PC Builder</h4>
            <p>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-5">
      <div className="container">
        <div className="mb-4 text-center">
          <h1 className="display-5 fw-bold">PC Builder</h1>
          <p className="text-muted mb-0">
            Choose one component per category to build your custom PC. Prices shown in{' '}
            <span className="badge bg-secondary">{currency}</span>.
          </p>
          {user && (
            <p className="text-muted small mt-2">
              Building as: <strong>{user.first_name ?? user.username}</strong>
            </p>
          )}
        </div>

        <div className="row">
          {/* Left: component selectors */}
          <div className="col-lg-8 mb-4">
            {categories.map(category => (
              <div key={category.category_id} className="card mb-3 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="card-title mb-0">{category.category_name}</h5>
                    <span className="badge bg-light text-muted">
                      {selected[category.category_id] ? 'Selected' : 'Not selected'}
                    </span>
                  </div>

                  <select
                    className="form-select mb-2"
                    value={selected[category.category_id]?.product_id ?? ''}
                    onChange={e =>
                      handleSelect(
                        category.category_id,
                        e.target.value ? Number(e.target.value) : ''
                      )
                    }
                  >
                    <option value="">— Choose {category.category_name} —</option>
                    {category.products.map(p => (
                      <option key={p.product_id} value={p.product_id}>
                        {p.product_name}
                        {p.brand ? ` (${p.brand})` : ''} — {formatPrice(p.price, p.currency)}
                      </option>
                    ))}
                  </select>

                  {selected[category.category_id] && (
                    <div className="d-flex align-items-center mt-2">
                      {selected[category.category_id]?.primary_image_url && (
                        <img
                          src={selected[category.category_id]!.primary_image_url}
                          alt={selected[category.category_id]!.product_name}
                          style={{
                            width: '64px',
                            height: '64px',
                            objectFit: 'contain',
                            marginRight: '12px',
                          }}
                          onError={e => {
                            const t = e.currentTarget as HTMLImageElement
                            t.style.display = 'none'
                          }}
                        />
                      )}
                      <div className="flex-grow-1">
                        <div className="fw-semibold">
                          {selected[category.category_id]!.product_name}
                        </div>
                        {selected[category.category_id]!.brand && (
                          <div className="text-muted small">
                            {selected[category.category_id]!.brand}{' '}
                            {selected[category.category_id]!.model &&
                              `• ${selected[category.category_id]!.model}`}
                          </div>
                        )}
                        <div className="text-primary fw-bold">
                          {formatPrice(
                            selected[category.category_id]!.price,
                            selected[category.category_id]!.currency
                          )}
                        </div>
                        <Link
                          to={`/products/${selected[category.category_id]!.product_id}`}
                          className="small"
                        >
                          View product details
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Right: summary */}
          <div className="col-lg-4">
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title">Build Summary</h5>
                {selectedProducts.length === 0 ? (
                  <p className="text-muted">No components selected yet.</p>
                ) : selectedProducts.length === 1 ? (
                  <p className="text-warning">
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    Please select at least 2 components to add to cart.
                  </p>
                ) : (
                  <>
                    <ul className="list-group mb-3">
                      {categories.map(category => {
                        const p = selected[category.category_id]
                        if (!p) return null
                        return (
                          <li
                            key={category.category_id}
                            className="list-group-item d-flex justify-content-between align-items-center"
                          >
                            <div className="d-flex align-items-center">
                              {p.primary_image_url ? (
                                <img
                                  src={p.primary_image_url}
                                  alt={p.product_name}
                                  style={{
                                    width: '48px',
                                    height: '48px',
                                    objectFit: 'cover',
                                    borderRadius: '0.25rem',
                                    marginRight: '0.75rem',
                                  }}
                                  onError={e => {
                                    const t = e.currentTarget as HTMLImageElement
                                    t.style.display = 'none'
                                  }}
                                />
                              ) : (
                                <div
                                  className="bg-light d-flex align-items-center justify-content-center text-muted"
                                  style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '0.25rem',
                                    marginRight: '0.75rem',
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  <i className="bi bi-image" />
                                </div>
                              )}
                              <div>
                                <div className="fw-semibold small">{category.category_name}</div>
                                <div className="small text-muted">{p.product_name}</div>
                              </div>
                            </div>
                            <span className="small fw-semibold">
                              {formatPrice(p.price, p.currency)}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                    <div className="border-top pt-3">
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">Subtotal:</span>
                        <span className="fw-semibold">
                          {formatPrice(totalPrice, currency)}
                        </span>
                      </div>
                      {discountInfo.discountPercent > 0 && (
                        <>
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-success">
                              <i className="bi bi-tag-fill me-1"></i>
                              Discount ({discountInfo.discountPercent}%):
                            </span>
                            <span className="fw-semibold text-success">
                              -{formatPrice(discountInfo.discountAmount, currency)}
                            </span>
                          </div>
                          <div className="alert alert-success py-2 px-3 mb-2">
                            <small>
                              <i className="bi bi-info-circle me-1"></i>
                              {discountInfo.discountPercent === 20 
                                ? 'Complete build discount applied!' 
                                : 'Multi-component discount applied!'}
                            </small>
                          </div>
                        </>
                      )}
                      <div className="d-flex justify-content-between mb-3 pt-2 border-top">
                        <span className="fw-bold fs-5">Total:</span>
                        <span className="fw-bold fs-5 text-primary">
                          {formatPrice(discountInfo.finalPrice, currency)}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <button
                  className="btn btn-primary w-100"
                  disabled={saving || selectedProducts.length < 2}
                  onClick={handleAddBuildToCart}
                >
                  {saving ? 'Adding build…' : 'Add Build to Cart'}
                </button>

                <p className="text-muted small mt-2 mb-0">
                  Each component is added to your cart as <strong>quantity 1</strong>. You can
                  adjust quantities from the cart page if needed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PcBuilder
