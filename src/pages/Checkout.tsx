import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Checkout.css'

type Branch = { id: number; name: string }
type CartItem = {
  cart_id: number
  product_id: number
  quantity: number
  product_name: string
  price: number
  currency: string
}

function Checkout() {
  const navigate = useNavigate()

  const [lock, setLock] = useState<null | {
    lock_id: string
    currency: string
    rate_to_php: number
    locked_at: string
    expires_at?: string
  }>(null)

  const [branches, setBranches] = useState<Branch[]>([])
  const [cart, setCart] = useState<{ items: CartItem[]; subtotal: number; currency: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    address: '',
    city: '',
    zipCode: '',
    fulfillment: 'pickup',      // 'pickup' | 'delivery'
    branchId: '',               // required (stock is per branch)
    paymentMethod: 'credit',    // 'credit' | 'debit' | 'paypal' | 'cod'
    notes: ''
  })

  // Load currency lock, cart contents, and branches
  useEffect(() => {
    const lockJson = sessionStorage.getItem('checkout_lock')
    if (!lockJson) {
      navigate('/cart')
      return
    }
    try {
      setLock(JSON.parse(lockJson))
    } catch {
      navigate('/cart')
      return
    }

    ;(async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          navigate('/login')
          return
        }

        const [cartRes, branchRes] = await Promise.all([
          fetch('http://localhost:8000/api/cart', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('http://localhost:8000/api/branches', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ])

        if (cartRes.status === 401 || branchRes.status === 401) {
          navigate('/login')
          return
        }

        const cartJson = cartRes.ok ? await cartRes.json() : null
        const branchJson = branchRes.ok ? await branchRes.json() : null

        if (cartJson?.success) {
          setCart({
            items: cartJson.data.items || [],
            subtotal: cartJson.data.total || 0,
            currency: cartJson.data.items?.[0]?.currency || 'USD'
          })
        } else {
          setError('Failed to load cart.')
        }

        if (branchJson?.success) {
          setBranches(branchJson.data.branches || [])
        } else {
          setError(prev => prev ?? 'Failed to load branches.')
        }
      } catch (e) {
        console.error(e)
        setError('Failed to load checkout data.')
      }
    })()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lock) return setError('Currency lock missing. Please return to the cart.')
    if (!formData.branchId) return setError('Please select a branch.')
    if (!cart || cart.items.length === 0) return setError('Your cart is empty.')

    setSubmitting(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        navigate('/login')
        return
      }

      // Build payload for the API. Backend will:
      // 1) Verify lock_id & fix the conversion rate
      // 2) Create Orders and Order_Items
      // 3) Deduct stock via DB triggers per branch
      // 4) Log transaction via stored procedure
      const payload = {
        lock_id: lock.lock_id,
        currency: lock.currency,
        customer: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email
        },
        fulfillment: {
          type: formData.fulfillment,              // 'pickup' | 'delivery'
          branch_id: Number(formData.branchId),
          address: formData.fulfillment === 'delivery' ? {
            line1: formData.address,
            city: formData.city,
            zip: formData.zipCode
          } : null
        },
        payment: { method: formData.paymentMethod },
        notes: formData.notes || null,
        items: cart.items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.price,                     // price in locked currency
          currency: i.currency
        }))
      }

      const res = await fetch('http://localhost:8000/api/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const err = await res.json().catch(()=> ({}))
        throw new Error(err?.message || 'Order failed')
      }

      const data = await res.json()
      // Clear the lock so it can't be reused
      sessionStorage.removeItem('checkout_lock')

      // Navigate to an order confirmation screen
      navigate(`/orders/${data.data?.order_id ?? 'success'}`)
    } catch (e) {
      console.error(e)
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const showDelivery = formData.fulfillment === 'delivery'

  return (
    <div className="checkout">
      <div className="container">
        <h1>Checkout</h1>

        {lock && (
          <div className="alert alert-info">
            <div><strong>Currency locked:</strong> {lock.currency}</div>
            <div><strong>Rate to PHP:</strong> {lock.rate_to_php}</div>
            {lock.expires_at && <div><strong>Expires:</strong> {new Date(lock.expires_at).toLocaleString()}</div>}
          </div>
        )}

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit} className="checkout-form">
          <div className="form-section">
            <h2>Fulfillment</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Method</label>
                <div className="d-flex gap-3">
                  <label>
                    <input
                      type="radio"
                      name="fulfillment"
                      value="pickup"
                      checked={formData.fulfillment === 'pickup'}
                      onChange={handleChange}
                    />{' '}
                    Store Pickup
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="fulfillment"
                      value="delivery"
                      checked={formData.fulfillment === 'delivery'}
                      onChange={handleChange}
                    />{' '}
                    Delivery
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="branchId">Branch</label>
                <select
                  id="branchId"
                  name="branchId"
                  value={formData.branchId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select branch</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>{showDelivery ? 'Shipping Information' : 'Contact Information'}</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            {showDelivery && (
              <>
                <div className="form-group">
                  <label htmlFor="address">Address</label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="city">City</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="zipCode">ZIP Code</label>
                    <input
                      type="text"
                      id="zipCode"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="form-section">
            <h2>Payment</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="paymentMethod">Payment Method</label>
                <select
                  id="paymentMethod"
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                >
                  <option value="credit">Credit Card</option>
                  <option value="debit">Debit Card</option>
                  <option value="paypal">PayPal</option>
                  <option value="cod">Cash on Delivery</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="notes">Order Notes (optional)</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-large" disabled={submitting}>
            {submitting ? 'Placing Order…' : 'Complete Order'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Checkout
