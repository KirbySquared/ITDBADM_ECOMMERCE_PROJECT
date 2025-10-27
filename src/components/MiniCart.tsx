import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../utils/currency'
import { calculateModalPositionAbsolute } from '../utils/modalPosition'
import './MiniCart.css'

interface CartItem {
  cart_id: number
  product_id: number
  quantity: number
  product_name: string
  price: number
  currency: string
  image_url?: string
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
  }, [show, triggerElement])

  const fetchCart = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setCartItems([])
        setTotal(0)
        return
      }

      const response = await fetch('http://localhost:8000/api/cart', {
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
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.product_name} />
                    ) : (
                      <i className="bi bi-image text-muted"></i>
                    )}
                  </div>
                  <div className="minicart-item-info">
                    <h6 className="mb-1">{item.product_name}</h6>
                    <p className="text-primary fw-bold mb-2">{formatPrice(item.price, item.currency)}</p>
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
                <span className="fw-bold text-primary">{formatPrice(total, cartItems[0]?.currency || 'USD')}</span>
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

