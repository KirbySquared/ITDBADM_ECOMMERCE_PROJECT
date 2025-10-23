import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../utils/currency'
import './Cart.css'

interface CartItem {
  id: number
  name: string
  price: number
  currency: string
  image: string
  quantity: number
}

function Cart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([
    // Mock data - will be replaced with real cart state
    { id: 1, name: 'PlayStation 5', price: 499.99, currency: 'USD', image: '/placeholder-product.jpg', quantity: 1 },
    { id: 2, name: 'Gaming Headset', price: 149.99, currency: 'USD', image: '/placeholder-product.jpg', quantity: 2 },
  ])

  const updateQuantity = (id: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(id)
    } else {
      setCartItems(items => 
        items.map(item => 
          item.id === id ? { ...item, quantity: newQuantity } : item
        )
      )
    }
  }

  const removeItem = (id: number) => {
    setCartItems(items => items.filter(item => item.id !== id))
  }

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0)
  }

  if (cartItems.length === 0) {
    return (
      <div className="py-5">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-md-8 text-center">
              <h1 className="display-4 fw-bold mb-4">Shopping Cart</h1>
              <div className="card">
                <div className="card-body py-5">
                  <i className="bi bi-cart-x text-muted" style={{fontSize: '4rem'}}></i>
                  <h2 className="mt-3 mb-3">Your cart is empty</h2>
                  <p className="text-muted mb-4">Add some products to get started!</p>
                  <Link to="/products" className="btn btn-primary btn-lg">
                    Continue Shopping
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
                  <div key={item.id} className="row align-items-center py-3 border-bottom">
                    <div className="col-md-2">
                      <div className="bg-light rounded" style={{height: '80px', width: '80px'}}>
                        <div className="d-flex align-items-center justify-content-center h-100">
                          <i className="bi bi-image text-muted"></i>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-md-4">
                      <h5 className="mb-1">{item.name}</h5>
                      <p className="text-primary fw-bold mb-0">{formatPrice(item.price, item.currency)}</p>
                    </div>
                    
                    <div className="col-md-3">
                      <div className="d-flex align-items-center gap-2">
                        <button 
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          -
                        </button>
                        <span className="fw-bold">{item.quantity}</span>
                        <button 
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    
                    <div className="col-md-2">
                      <p className="fw-bold mb-0">{formatPrice(item.price * item.quantity, item.currency)}</p>
                    </div>
                    
                    <div className="col-md-1">
                      <button 
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => removeItem(item.id)}
                      >
                        <i className="bi bi-trash"></i>
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
                  <span>{formatPrice(getTotalPrice(), 'USD')}</span>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span>Shipping:</span>
                  <span className="text-success">Free</span>
                </div>
                <hr />
                <div className="d-flex justify-content-between mb-4">
                  <span className="fw-bold fs-5">Total:</span>
                  <span className="fw-bold fs-5">{formatPrice(getTotalPrice(), 'USD')}</span>
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
