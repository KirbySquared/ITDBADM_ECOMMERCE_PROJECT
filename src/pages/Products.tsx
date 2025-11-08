import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { formatPrice } from '../utils/currency'
import { useCurrency } from '../context/CurrencyContext'
import { useAuth } from '../hooks/useAuth'
import { useNotification } from '../context/NotificationContext'
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
  stock_quantity: number
}

type Pagination = {
  page: number
  limit: number
  total: number
  pages: number
}

const ENDPOINTS = {
  list: (currency: string, branchId: number | null) =>
    branchId != null
      ? api(`/products?branch_id=${branchId}&currency=${encodeURIComponent(currency)}`)
      : api(`/products?currency=${encodeURIComponent(currency)}`),
  search: (qs: string) => api(`/products/search?${qs}`),

  // Cart endpoints (match your Cart.tsx which calls the absolute URL)
  cartBase: 'http://localhost:8000/api/cart',
}

// Helper function to get category-based max quantity
function getMaxQuantity(categoryName: string | undefined): number {
  if (!categoryName) return 999 // No limit if category unknown
  const category = categoryName.toLowerCase()
  if (category === 'console') return 1
  if (category === 'game') return 5
  return 999 // No limit for other categories
}

function Products() {
  const { currency } = useCurrency()
  const { user } = useAuth()
  const { showSuccess, showError } = useNotification()
  // Get user's branch_id from profile (stored in localStorage)
  const userBranchId = user?.branch_id || null
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filter, setFilter] = useState<'all'|'consoles'|'accessories'|'games'>('all')

  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [platform, setPlatform] = useState<string[]>([])
  const [genreId, setGenreId] = useState<number | null>(null)
  const [year, setYear] = useState<number | ''>('')
  const [month, setMonth] = useState<number | ''>('')
  const [price, setPrice] = useState<[number, number]>([0, 0])
  const [inStock, setInStock] = useState(false)
  const [sort, setSort] = useState<'newest'|'price_asc'|'price_desc'>('newest')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<Pagination | null>(null)

  // UI state for add-to-cart
  const [addingId, setAddingId] = useState<number | null>(null)
  const [addedIds, setAddedIds] = useState<Record<number, boolean>>({})

  function buildQS() {
    const sp = new URLSearchParams()
    sp.set('currency', currency)
    // Only show products in user's branch if they have one set
    if (userBranchId != null) sp.set('branch_id', String(userBranchId))
    if (q) sp.set('q', q)
    if (platform.length) sp.set('platform', platform.join(','))
    if (genreId) sp.set('genre_id', String(genreId))
    if (year) sp.set('year', String(year))
    if (month) sp.set('month', String(month))
    if (price[0] > 0) sp.set('price_min', String(price[0]))
    if (price[1] > 0) sp.set('price_max', String(price[1]))
    if (inStock) sp.set('in_stock', '1')
    sp.set('sort', sort)
    sp.set('page', String(page))
    sp.set('limit', '12')
    return sp.toString()
  }

  // Client-side filter used only when we fall back to /products
  function applyClientFilters(rows: Product[]): Product[] {
    let out = [...rows]

    if (q) {
      const needle = q.toLowerCase()
      out = out.filter(p =>
        `${p.product_name} ${p.brand ?? ''} ${p.model ?? ''}`.toLowerCase().includes(needle)
      )
    }
    if (platform.length) {
      // soft match as noted
      out = out.filter(p =>
        platform.some(pl => (p.product_name || '').toLowerCase().includes(pl.toLowerCase()))
      )
    }
    if (inStock) {
      out = out.filter(p => (p.stock_quantity ?? 0) > 0)
    }
    const getAmount = (p: Product) => (p.display_price ?? p.price ?? 0)
    if (price[0] > 0) out = out.filter(p => getAmount(p) >= price[0])
    if (price[1] > 0) out = out.filter(p => getAmount(p) <= price[1])

    if (sort === 'price_asc') out.sort((a,b) => getAmount(a) - getAmount(b))
    if (sort === 'price_desc') out.sort((a,b) => getAmount(b) - getAmount(a))
    return out
  }

  async function fetchSearch() {
    setLoading(true)
    setError(null)
    try {
      const qs = buildQS()
      const res = await fetch(ENDPOINTS.search(qs), { credentials: 'include' })

      if (res.status === 404) {
        // fallback to list
        console.warn('[Products] /products/search not found. Falling back to /products list.')
        const listRes = await fetch(ENDPOINTS.list(currency, userBranchId), { credentials: 'include' })
        const listJson = await listRes.json()
        if (!listRes.ok || listJson.success === false) {
          throw new Error(listJson.message || 'Failed to load products')
        }
        const rows: Product[] = listJson.data?.products ?? listJson.products ?? []
        const filtered = applyClientFilters(rows)
        setProducts(filtered)
        setPagination(null)
        setParams(new URLSearchParams(qs))
        return
      }

      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Search failed')
      }
      setProducts(data.data.products || [])
      setPagination(data.data.pagination || null)
      setParams(new URLSearchParams(buildQS()))
    } catch (e: any) {
      setError(e.message || 'Failed to fetch products')
      setProducts([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, userBranchId, q, platform, genreId, year, month, price, inStock, sort, page])

  const filtered =
    filter === 'all'
      ? products
      : products.filter(p => (p.category_name || '').toLowerCase() === filter)

  // ---------- NEW: add-to-cart with category restrictions ----------
  const addToCart = async (product: Product, quantity: number = 1) => {
    if ((product.stock_quantity ?? 0) <= 0) {
      showError('Product is out of stock')
      return
    }
    
    // Check category-based quantity restrictions
    const maxQty = getMaxQuantity(product.category_name)
    if (quantity > maxQty) {
      showError(`Maximum quantity for ${product.category_name} category is ${maxQty}`)
      return
    }
    
    setAddingId(product.product_id)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        showError('Please log in to add items to cart')
        return
      }

      const res = await fetch('http://localhost:8000/api/cart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ product_id: product.product_id, quantity: quantity })
      })

      // decode body (even on errors) so we can show the real reason
      const text = await res.text()
      let json: any = {}
      try { 
        json = text ? JSON.parse(text) : {} 
      } catch (e) {
        console.error('Failed to parse cart response:', text)
      }

      if (!res.ok || json?.success === false) {
        console.error('Add to cart failed:', { 
          status: res.status, 
          statusText: res.statusText,
          body: text,
          json: json
        })
        const msg =
          json?.message ||
          (typeof json === 'string' ? json : '') ||
          `Failed to add to cart (HTTP ${res.status})`
        throw new Error(msg)
      }

      setAddedIds(prev => ({ ...prev, [product.product_id]: true }))
      setTimeout(() => {
        setAddedIds(prev => ({ ...prev, [product.product_id]: false }))
      }, 1200)

      showSuccess(`Added ${quantity} ${quantity === 1 ? 'item' : 'items'} to cart!`)
      window.dispatchEvent(new Event('cartUpdated'))
    } catch (e) {
      const errorMessage = (e as Error).message || 'Could not add to cart'
      console.error('Add to cart error:', e)
      showError(errorMessage)
    } finally {
      setAddingId(null)
    }
  }
  // ---------- END add-to-cart ----------

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
              <button className="btn btn-primary" onClick={fetchSearch}>
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
              {userBranchId != null && <span className="badge bg-info text-dark ms-2">Branch #{userBranchId}</span>}
            </h1>
          </div>
        </div>

        <div className="row">
          {/* Sidebar */}
          <aside className="col-lg-3 mb-4">
            <input className="form-control mb-3" value={q} onChange={e=>{ setPage(1); setQ(e.target.value) }} placeholder="Search…" />

            <div className="mb-3">
              <label className="form-label">Platform</label>
              {['PS5','Xbox','Switch','PC'].map(pl => (
                <div key={pl} className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id={`pl-${pl}`}
                    checked={platform.includes(pl)}
                    onChange={(e) => {
                      setPage(1)
                      setPlatform(prev => e.target.checked ? [...prev, pl] : prev.filter(p => p !== pl))
                    }}
                  />
                  <label htmlFor={`pl-${pl}`} className="form-check-label">{pl}</label>
                </div>
              ))}
            </div>

            <div className="mb-3">
              <label className="form-label">Genre</label>
              <select
                className="form-select"
                value={genreId ?? ''}
                onChange={e => { setPage(1); setGenreId(e.target.value ? Number(e.target.value) : null) }}
              >
                <option value="">All Genres</option>
                <option value="1">Action</option>
                <option value="2">RPG</option>
                <option value="3">Sports</option>
                <option value="4">Adventure</option>
                <option value="5">Shooter</option>
              </select>
            </div>

            <div className="d-flex gap-2 mb-3">
              <input type="number" placeholder="Year" className="form-control" value={year} onChange={e=>{ setPage(1); setYear(e.target.value ? Number(e.target.value) : '') }}/>
              <input type="number" placeholder="Month" className="form-control" value={month} onChange={e=>{ setPage(1); setMonth(e.target.value ? Number(e.target.value) : '') }}/>
            </div>

            <div className="d-flex gap-2 mb-3">
              <input type="number" className="form-control" placeholder={`Min (${currency})`} value={price[0] || ''} onChange={e=>{ setPage(1); setPrice([Number(e.target.value||0), price[1]]) }}/>
              <input type="number" className="form-control" placeholder={`Max (${currency})`} value={price[1] || ''} onChange={e=>{ setPage(1); setPrice([price[0], Number(e.target.value||0)]) }}/>
            </div>

            <div className="form-check mb-3">
              <input className="form-check-input" type="checkbox" id="instock" checked={inStock} onChange={e=>{ setPage(1); setInStock(e.target.checked) }} />
              <label className="form-check-label" htmlFor="instock">Only show in-stock</label>
            </div>

            <select className="form-select mb-4" value={sort} onChange={e => { setPage(1); setSort(e.target.value as any) }}>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>

            <div className="d-flex flex-wrap gap-2">
              {(['all','consoles','accessories','games'] as const).map(k => (
                <button
                  key={k}
                  className={`btn btn-sm ${filter === k ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => { setPage(1); setFilter(k) }}
                >
                  {k === 'all' ? 'All Products' : k[0].toUpperCase()+k.slice(1)}
                </button>
              ))}
            </div>
          </aside>

          <main className="col-lg-9">
            <div className="row g-4">
              {filtered.map(product => {
                const amount = product.display_price ?? product.price
                const inStockNow = (product.stock_quantity ?? 0) > 0
                const isAdding = addingId === product.product_id
                const isAdded = addedIds[product.product_id]

                return (
                  <div key={product.product_id} className="col-xl-4 col-md-6">
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
                          <span className={`badge ${inStockNow ? 'bg-success' : 'bg-danger'}`}>
                            {inStockNow ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </div>
                        {product.brand && <p className="card-text text-muted small mt-1">{product.brand}</p>}
                        <p className="card-text text-primary fw-bold fs-5">
                          {formatPrice(amount, product.currency)}
                        </p>
                        <p className="text-muted small mb-2">
                          Qty: {product.stock_quantity ?? 0}
                          {product.category_name && (
                            <span className="ms-2">
                              (Max: {getMaxQuantity(product.category_name)} per {product.category_name})
                            </span>
                          )}
                        </p>

                        <div className="mt-auto">
                          <div className="d-grid gap-2">
                            <Link to={`/products/${product.product_id}`} className="btn btn-outline-primary">
                              View Details
                            </Link>
                            <button
                              className="btn btn-primary"
                              disabled={!inStockNow || isAdding}
                              onClick={() => addToCart(product)}
                            >
                              {isAdding
                                ? 'Adding…'
                                : isAdded
                                  ? 'Added ✓'
                                  : (inStockNow ? 'Add to Cart' : 'Out of Stock')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {pagination && pagination.pages > 1 && (
              <div className="d-flex justify-content-center mt-4 gap-2">
                <button className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  ‹ Prev
                </button>
                <span className="align-self-center small">
                  Page {pagination.page} of {pagination.pages} — {pagination.total} results
                </span>
                <button className="btn btn-outline-secondary" disabled={page >= pagination.pages} onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}>
                  Next ›
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

export default Products
