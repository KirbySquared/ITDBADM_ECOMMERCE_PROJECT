// src/components/Cart.tsx
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatPrice } from '../utils/currency'
import { useCurrency } from '../context/CurrencyContext'
import { api } from '../api/config'
import './Cart.css'

interface CartItem {
  cart_id: number
  product_id: number
  quantity: number
  product_name: string
  brand: string
  model?: string
  price: number        // unit price in selected currency
  display_price?: number
  currency: string     // e.g. "PHP", "USD"
  primary_image_url?: string
  category_name?: string
  stock_quantity?: number
  line_total_display?: number
}

function Cart() {
  const { currency } = useCurrency()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<number | null>(null)
  const [locking, setLocking] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchCart()

    const handleCartUpdate = () => {
      console.log('Cart update event received, refreshing cart...')
      fetchCart()
    }
    window.addEventListener('cartUpdated', handleCartUpdate)
    return () => window.removeEventListener('cartUpdated', handleCartUpdate)
    // refetch when currency changes
  }, [currency]) //  important: refetch when currency changes

  const fetchCart = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        navigate('/login')
        return
      }

      const url = api(`/cart?currency=${encodeURIComponent(currency)}`)
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json().catch(() => ({} as any))

        if (data?.success) {
          const apiCurrency = data.data?.currency || 'PHP'
          const rawItems = data.data?.items || []
          
          console.log('Cart fetched successfully:', {
            itemCount: rawItems.length,
            currency: apiCurrency,
            total: data.data?.total
          })

          // Map backend fields → what the UI expects
          const mapped: CartItem[] = rawItems.map((it: any) => ({
            cart_id: Number(it.cart_id),
            product_id: Number(it.product_id),
            quantity: Number(it.quantity),
            product_name: it.product_name,
            brand: it.brand,
            model: it.model,
            primary_image_url: it.primary_image_url,
            category_name: it.category_name,
            stock_quantity: it.stock_quantity ? Number(it.stock_quantity) : undefined,
            // Use display_price (converted) if available, else fall back to base price
            price: Number(it.display_price ?? it.price ?? 0),
            display_price: it.display_price ? Number(it.display_price) : undefined,
            currency: apiCurrency,
            line_total_display: it.line_total_display ? Number(it.line_total_display) : undefined,
          }))

          setCartItems(mapped)
          setTotal(Number(data.data?.total || 0))
        } else {
          console.error('Cart error:', data?.message || 'Unknown error')
          setCartItems([])
          setTotal(0)
        }
      } else if (response.status === 401) {
        localStorage.removeItem('token')
        navigate('/login')
      } else {
        const text = await response.text()
        let errorData: any = {}
        try {
          errorData = text ? JSON.parse(text) : {}
        } catch {
          // ignore parse error
        }
        console.error('Cart fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          message: errorData?.message || text,
          body: text
        })
        setCartItems([])
        setTotal(0)
      }
    } catch (err) {
      console.error('Error fetching cart:', err)
      setCartItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const updateQuantity = async (cartId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      await removeItem(cartId)
      return
    }

    setUpdating(cartId)
    try {
      const token = localStorage.getItem('token')
      if (!token) return navigate('/login')

      const response = await fetch('http://localhost:8000/api/cart', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cart_id: cartId, quantity: newQuantity })
      })

      if (response.ok) {
        fetchCart()
        window.dispatchEvent(new Event('cartUpdated'))
      } else if (response.status === 401) {
        navigate('/login')
      } else {
        const text = await response.text()
        console.error('Update qty failed:', response.status, text)
      }
    } catch (err) {
      console.error('Error updating quantity:', err)
    } finally {
      setUpdating(null)
    }
  }

  const removeItem = async (cartId: number) => {
    setUpdating(cartId)
    try {
      const token = localStorage.getItem('token')
      if (!token) return navigate('/login')

      const response = await fetch('http://localhost:8000/api/cart', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cart_id: cartId })
      })

      if (response.ok) {
        fetchCart()
        window.dispatchEvent(new Event('cartUpdated'))
      } else if (response.status === 401) {
        navigate('/login')
      } else {
        const text = await response.text()
        console.error('Remove failed:', response.status, text)
      }
    } catch (err) {
      console.error('Error removing item:', err)
    } finally {
      setUpdating(null)
    }
  }

  const getCurrency = () => cartItems[0]?.currency || currency || 'PHP'

  // Currency lock + navigate to checkout (unchanged)
  const lockRateAndGo = async () => {
    if (cartItems.length === 0) return
    setLocking(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        navigate('/login')
        return
      }
      const cur = getCurrency()

      const res = await fetch('http://localhost:8000/api/checkout/lock-currency', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currency: cur })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || 'Failed to lock currency')
      }

      const data = await res.json()
      sessionStorage.setItem('checkout_lock', JSON.stringify(data.data))
      navigate('/checkout')
    } catch (e) {
      console.error(e)
      alert((e as Error).message || 'Could not start checkout.')
    } finally {
      setLocking(false)
    }
  }

  if (loading) {
    return (
      <div className="py-5">
        <div className="container">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading cart...</span>
            </div>
            <p className="mt-3">Loading your cart...</p>
          </div>
        </div>
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div className="py-5">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-md-8 text-center">
              <h1 className="display-4 fw-bold mb-4">Shopping Cart</h1>
              <div className="card shadow-sm">
                <div className="card-body py-5">
                  <i className="bi bi-cart-x text-muted" style={{ fontSize: '4rem' }}></i>
                  <h2 className="mt-3 mb-2">Your shop cart is empty</h2>
                  <p className="text-muted mb-4">Check out our products to start shopping!</p>
                  <Link to="/products" className="btn btn-primary btn-lg">
                    <i className="bi bi-arrow-left me-2"></i>
                    Check out our products
                  </Link>
                </div>
              </div>
            </div>
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
            <h1 className="display-4 fw-bold">Shopping Cart</h1>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-lg-8">
            <div className="card">
              <div className="card-body">
                {cartItems.map(item => (
                  <div key={item.cart_id} className="row align-items-center py-3 border-bottom">
                    <div className="col-md-2">
                      {item.primary_image_url ? (
                        <img
                          src={item.primary_image_url}
                          alt={item.product_name}
                          className="rounded"
                          style={{width: '80px', height: '80px', objectFit: 'cover'}}
                          onError={(e) => {
                            const t = e.target as HTMLImageElement
                            t.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
                          }}
                        />
                      ) : (
                        <div className="bg-light rounded" style={{ height: '80px', width: '80px' }}>
                          <div className="d-flex align-items-center justify-content-center h-100">
                            <i className="bi bi-image text-muted"></i>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="col-md-4">
                      <h5 className="mb-1">
                        <Link to={`/products/${item.product_id}`} className="text-decoration-none text-dark">
                          {item.product_name}
                        </Link>
                      </h5>
                      {item.brand && (
                        <p className="text-muted mb-1 small">
                          {item.brand} {item.model ? `- ${item.model}` : ''}
                        </p>
                      )}
                      {item.category_name && (
                        <span className="badge bg-info text-dark mb-2">{item.category_name}</span>
                      )}
                      <p className="text-primary fw-bold mb-0">
                        {formatPrice(item.display_price ?? item.price, item.currency)}
                      </p>
                      {item.stock_quantity !== undefined && (
                        <small className={`d-block ${item.stock_quantity > 0 ? 'text-success' : 'text-danger'}`}>
                          {item.stock_quantity > 0 ? `In Stock (${item.stock_quantity} available)` : 'Out of Stock'}
                        </small>
                      )}
                    </div>

                    <div className="col-md-3">
                      <div className="d-flex align-items-center gap-2">
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => updateQuantity(item.cart_id, item.quantity - 1)}
                          disabled={updating === item.cart_id}
                        >
                          {updating === item.cart_id ? (
                            <span className="spinner-border spinner-border-sm"></span>
                          ) : (
                            '-'
                          )}
                        </button>
                        <span className="fw-bold">{item.quantity}</span>
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => updateQuantity(item.cart_id, item.quantity + 1)}
                          disabled={updating === item.cart_id}
                        >
                          {updating === item.cart_id ? (
                            <span className="spinner-border spinner-border-sm"></span>
                          ) : (
                            '+'
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="col-md-2 text-end">
                      <p className="fw-bold mb-0">
                        {formatPrice(item.price * item.quantity, item.currency)}
                      </p>
                      <small className="text-muted">
                        ({formatPrice(item.price, item.currency)} × {item.quantity})
                      </small>
                    </div>

                    <div className="col-md-1 text-end">
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => removeItem(item.cart_id)}
                        disabled={updating === item.cart_id}
                      >
                        {updating === item.cart_id ? (
                          <span className="spinner-border spinner-border-sm"></span>
                        ) : (
                          <i className="bi bi-trash"></i>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title mb-4">Order Summary</h5>

                <div className="d-flex justify-content-between mb-2">
                  <span>Subtotal:</span>
                  <span>{formatPrice(total, getCurrency())}</span>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span>Shipping:</span>
                  <span className="text-success">Free</span>
                </div>
                <hr />
                <div className="d-flex justify-content-between mb-4">
                  <span className="fw-bold fs-5">Total:</span>
                  <span className="fw-bold fs-5">{formatPrice(total, getCurrency())}</span>
                </div>

                <div className="d-grid">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={lockRateAndGo}
                    disabled={locking}
                  >
                    {locking ? 'Locking rate…' : 'Proceed to Checkout'}
                  </button>
                </div>

                <p className="text-muted small mt-2 mb-0">
                  We’ll lock today’s rate and reserve items at your selected branch on the next step.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Cart
