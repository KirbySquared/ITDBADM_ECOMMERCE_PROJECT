import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useCurrency } from '../context/CurrencyContext'
import { formatPrice } from '../utils/currency'
import { api } from '../api/config'
import './ProductDetail.css'

// ✅ NEW: branch context
import { useBranch } from '../context/BranchContext'

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
  const { branchId } = useBranch() // ✅ NEW
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true)
        setError(null)

        // ✅ NEW: branch-aware URL
        const url =
          branchId != null
            ? api(`/products?id=${encodeURIComponent(id)}&branch_id=${branchId}&currency=${encodeURIComponent(currency)}`)
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
    // ✅ NEW: re-run when branch changes
  }, [id, currency, branchId])

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

          <div className="mt-4 d-flex gap-2">
            <button className="btn btn-primary" disabled={product.stock_quantity === 0}>
              {product.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
            <Link to="/products" className="btn btn-outline-secondary">Back to Products</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
