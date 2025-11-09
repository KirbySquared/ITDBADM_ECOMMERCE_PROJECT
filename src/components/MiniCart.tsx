import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../utils/currency'
import { useCurrency } from '../context/CurrencyContext'
import { api } from '../api/config'
import { calculateModalPositionAbsolute } from '../utils/modalPosition'
import './MiniCart.css'

interface CartItem {
  cart_id: number
  product_id: number
  quantity: number
  product_name: string
  brand?: string
  model?: string
  price: number
  display_price?: number
  currency: string
  primary_image_url?: string
  line_total_display?: number
}

interface MiniCartProps {
  show: boolean
  onHide: () => void
  onCartUpdate?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: (e: React.MouseEvent) => void
  triggerElement?: HTMLElement | null
}

function MiniCart({ show, onHide, onCartUpdate, onMouseEnter, onMouseLeave, triggerElement }: MiniCartProps) {
  const { currency } = useCurrency()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [modalPosition, setModalPosition] = useState({ top: '0px', right: '0px', arrowRight: '50px' })
  
  useEffect(() => {
    if (show) {
      fetchCart()
      // Calculate position relative to trigger element
      const position = calculateModalPositionAbsolute(triggerElement || null)
      setModalPosition(position)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, triggerElement, currency])

  const fetchCart = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setCartItems([])
        setTotal(0)
        return
      }

      const url = api(`/cart?currency=${encodeURIComponent(currency)}`)
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setCartItems(data.data.items || [])
          setTotal(data.data.total || 0)
        }
      }
    } catch (err) {
      console.error('Error fetching cart:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateQuantity = async (cartId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      await removeItem(cartId)
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:8000/api/cart', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cart_id: cartId,
          quantity: newQuantity
        })
      })

      if (response.ok) {
        fetchCart()
        onCartUpdate?.()
      }
    } catch (err) {
      console.error('Error updating quantity:', err)
    }
  }

  const removeItem = async (cartId: number) => {
    try {
      const token = localStorage.getItem('token')
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
        onCartUpdate?.()
      }
    } catch (err) {
      console.error('Error removing item:', err)
    }
  }

  if (!show) return null

  return (
    <>
      <div className="minicart-overlay" onClick={onHide}></div>
      <div 
        className="minicart-modal" 
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          top: modalPosition.top,
          right: modalPosition.right,
          position: 'fixed'
        }}
      >
        <div 
          className="minicart-arrow"
          style={{ right: modalPosition.arrowRight }}
        ></div>
        
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : cartItems.length === 0 ? (
          <div className="minicart-empty text-center py-5">
            <i className="bi bi-cart-x text-muted" style={{fontSize: '3rem'}}></i>
            <p className="mt-3 mb-1 fw-semibold">Your shop cart is empty</p>
            <p className="text-muted mb-3 small">Check out our products to start shopping!</p>
            <Link to="/products" className="btn btn-primary" onClick={onHide}>
              Check out our products
            </Link>
          </div>
        ) : (
          <>
            <div className="minicart-items">
              {cartItems.map(item => (
                <div key={item.cart_id} className="minicart-item">
                  <div className="minicart-item-image">
                    {item.primary_image_url ? (
                      <img 
                        src={item.primary_image_url} 
                        alt={item.product_name}
                        onError={(e) => {
                          const t = e.target as HTMLImageElement
                          t.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
                        }}
                      />
                    ) : (
                      <i className="bi bi-image text-muted"></i>
                    )}
                  </div>
                  <div className="minicart-item-info">
                    <h6 className="mb-1">
                      <Link to={`/products/${item.product_id}`} className="text-decoration-none text-dark">
                        {item.product_name}
                      </Link>
                    </h6>
                    {item.brand && (
                      <small className="text-muted d-block">{item.brand} {item.model ? `- ${item.model}` : ''}</small>
                    )}
                    <p className="text-primary fw-bold mb-2">{formatPrice(item.display_price ?? item.price, item.currency)}</p>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => updateQuantity(item.cart_id, item.quantity - 1)}
                      >
                        <i className="bi bi-dash"></i>
                      </button>
                      <span className="fw-bold">{item.quantity}</span>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => updateQuantity(item.cart_id, item.quantity + 1)}
                      >
                        <i className="bi bi-plus"></i>
                      </button>
                    </div>
                    <a
                      href="#"
                      className="text-danger small text-decoration-none"
                      onClick={(e) => {
                        e.preventDefault()
                        removeItem(item.cart_id)
                      }}
                    >
                      Remove
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="minicart-divider"></div>

            <div className="minicart-total">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span className="fw-bold">Total</span>
                <span className="fw-bold text-primary">{formatPrice(total, cartItems[0]?.currency || currency)}</span>
              </div>
              <div className="d-grid gap-2">
                <Link to="/cart" className="btn btn-primary" onClick={onHide}>
                  View Cart
                </Link>
                <Link to="/checkout" className="btn btn-outline-primary" onClick={onHide}>
                  Checkout
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default MiniCart

