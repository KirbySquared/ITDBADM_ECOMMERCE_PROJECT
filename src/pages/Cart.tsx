import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatPrice } from '../utils/currency'
import './Cart.css'

interface CartItem {
  cart_id: number
  product_id: number
  quantity: number
  product_name: string
  price: number
  currency: string
  image_url?: string
}

function Cart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<number | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchCart()
    
    // Listen for cart update events
    const handleCartUpdate = () => {
      fetchCart()
    }
    
    window.addEventListener('cartUpdated', handleCartUpdate)
    return () => window.removeEventListener('cartUpdated', handleCartUpdate)
  }, [])

  const fetchCart = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        // Redirect to login if not authenticated
        navigate('/login')
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
      } else if (response.status === 401) {
        // Token expired, redirect to login
        navigate('/login')
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

    setUpdating(cartId)
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
        window.dispatchEvent(new Event('cartUpdated'))
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
      }
    } catch (err) {
      console.error('Error removing item:', err)
    } finally {
      setUpdating(null)
    }
  }

  const getCurrency = () => {
    return cartItems[0]?.currency || 'USD'
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
                  <i className="bi bi-cart-x text-muted" style={{fontSize: '4rem'}}></i>
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
                      {item.image_url ? (
                        <img 
                          src={item.image_url} 
                          alt={item.product_name}
                          className="rounded"
                          style={{width: '80px', height: '80px', objectFit: 'cover'}}
                        />
                      ) : (
                        <div className="bg-light rounded" style={{height: '80px', width: '80px'}}>
                          <div className="d-flex align-items-center justify-content-center h-100">
                            <i className="bi bi-image text-muted"></i>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="col-md-4">
                      <h5 className="mb-1">{item.product_name}</h5>
                      <p className="text-primary fw-bold mb-0">{formatPrice(item.price, item.currency)}</p>
                    </div>
                    
                    <div className="col-md-3">
                      <div className="d-flex align-items-center gap-2">
                        <button 
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => updateQuantity(item.cart_id, item.quantity - 1)}
                          disabled={updating === item.cart_id}
                        >
                          {updating === item.cart_id ? <span className="spinner-border spinner-border-sm"></span> : '-'}
                        </button>
                        <span className="fw-bold">{item.quantity}</span>
                        <button 
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => updateQuantity(item.cart_id, item.quantity + 1)}
                          disabled={updating === item.cart_id}
                        >
                          {updating === item.cart_id ? <span className="spinner-border spinner-border-sm"></span> : '+'}
                        </button>
                      </div>
                    </div>
                    
                    <div className="col-md-2">
                      <p className="fw-bold mb-0">{formatPrice(item.price * item.quantity, item.currency)}</p>
                    </div>
                    
                    <div className="col-md-1">
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
                  <Link to="/checkout" className="btn btn-primary btn-lg">
                    Proceed to Checkout
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Cart
