import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../utils/currency'
import { useCurrency } from '../context/CurrencyContext'
import { useBranch } from '../context/BranchContext'   // ⬅️ NEW
import { api } from '../api/config'
import './Products.css'

interface Product {
  product_id: number
  product_name: string
  brand: string
  model?: string
  price: number
  price_php?: number
  display_price?: number
  currency: string
  primary_image_url?: string
  category_name: string
  stock_quantity: number   // ⬅️ this comes from the API (branch-aware or total)
}

const ENDPOINTS = {
  list: (currency: string, branchId: number | null) =>
    branchId != null
      ? api(`/products?branch_id=${branchId}&currency=${encodeURIComponent(currency)}`)
      : api(`/products?currency=${encodeURIComponent(currency)}`),
}

function Products() {
  const { currency } = useCurrency()
  const { branchId } = useBranch()                     // ⬅️ NEW
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all'|'consoles'|'accessories'|'games'>('all')

  useEffect(() => {
    fetchProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, branchId])                             // ⬅️ refetch when branch changes

  const fetchProducts = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = ENDPOINTS.list(currency, branchId)
      const res = await fetch(url, { credentials: 'include' })
      const ct = res.headers.get('content-type') || ''
      const parse = async () =>
        ct.includes('application/json') ? res.json() : JSON.parse(await res.text())

      if (!res.ok) {
        const body = await parse().catch(() => ({}))
        throw new Error(body?.message || `${res.status} ${res.statusText}`)
      }

      const data = await parse()
      const rows: Product[] = data?.data?.products ?? data?.products ?? []
      setProducts(rows)
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch products')
    } finally {
      setLoading(false)
    }
  }

  const filtered =
    filter === 'all'
      ? products
      : products.filter(p => (p.category_name || '').toLowerCase() === filter)

  if (loading) {
    return (
      <div className="py-5">
        <div className="container">
          <div className="text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Loading products...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-5">
        <div className="container">
          <div className="text-center">
            <div className="alert alert-danger" role="alert">
              <h4>Error Loading Products</h4>
              <p>{error}</p>
              <button className="btn btn-primary" onClick={fetchProducts}>
                Try Again
              </button>
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
            <h1 className="display-4 fw-bold">
              Products{' '}
              <span className="badge bg-secondary">{currency}</span>
              {branchId != null && <span className="badge bg-info text-dark ms-2">Branch #{branchId}</span>}
            </h1>
          </div>
        </div>

        {/* Filters */}
        <div className="row mb-5">
          <div className="col-12">
            <div className="d-flex justify-content-center flex-wrap gap-2">
              {(['all','consoles','accessories','games'] as const).map(k => (
                <button
                  key={k}
                  className={`btn ${filter === k ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setFilter(k)}
                >
                  {k === 'all' ? 'All Products' : k[0].toUpperCase()+k.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="row g-4">
          {filtered.map(product => {
            const amount = product.display_price ?? product.price
            const inStock = (product.stock_quantity ?? 0) > 0
            return (
              <div key={product.product_id} className="col-lg-4 col-md-6">
                <div className="card h-100 shadow-sm">
                  <div className="card-img-top" style={{ height: '200px', overflow: 'hidden' }}>
                    {product.primary_image_url ? (
                      <img
                        src={product.primary_image_url}
                        alt={product.product_name}
                        className="w-100 h-100"
                        style={{ objectFit: 'cover' }}
                        onError={(e) => {
                          const t = e.currentTarget as HTMLImageElement
                          t.src =
                            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
                        }}
                      />
                    ) : (
                      <div className="bg-light d-flex align-items-center justify-content-center h-100">
                        <i className="bi bi-image text-muted fs-1"></i>
                      </div>
                    )}
                  </div>

                  <div className="card-body d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start">
                      <h5 className="card-title mb-0">{product.product_name}</h5>
                      <span className={`badge ${inStock ? 'bg-success' : 'bg-danger'}`}>
                        {inStock ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </div>
                    {product.brand && <p className="card-text text-muted small mt-1">{product.brand}</p>}
                    <p className="card-text text-primary fw-bold fs-5">
                      {formatPrice(amount, product.currency)}
                    </p>
                    {/* show exact qty if you like */}
                    <p className="text-muted small mb-2">
                      Qty: {product.stock_quantity ?? 0}{branchId != null ? '' : ' (all branches)'}
                    </p>

                    <div className="mt-auto">
                      <div className="d-grid gap-2">
                        <Link to={`/products/${product.product_id}`} className="btn btn-outline-primary">
                          View Details
                        </Link>
                        <button className="btn btn-primary" disabled={!inStock}>
                          {inStock ? 'Add to Cart' : 'Out of Stock'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Products
