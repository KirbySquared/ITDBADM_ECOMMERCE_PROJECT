/**
 * ADMIN PRODUCT FORM MODAL COMPONENT
 * 
 * This component provides a modal form for creating and editing products in the admin dashboard.
 * 
 * FEATURES:
 * - Create new products
 * - Edit existing products
 * - Form validation
 * - Loading states
 * - Error handling
 * - Category selection
 * - Specifications management
 * - Image management
 * 
 * USAGE:
 * <AdminProductModal 
 *   show={showModal} 
 *   onHide={() => setShowModal(false)} 
 *   product={selectedProduct} 
 *   categories={categories}
 *   onSave={handleSaveProduct} 
 * />
 */
import { useState, useEffect } from 'react'
import { getCurrencyOptions } from '../utils/currency'
import AdminProductImagesModal from './AdminProductImagesModal'

interface Product {
  product_id?: number
  category_id: number
  product_name: string
  brand: string
  model?: string
  description?: string
  price: number
  currency: string
  stock_quantity: number
  specifications?: any
  images?: Array<{
    image_id: number
    image_url: string
    alt_text?: string
    is_primary: boolean
    sort_order: number
    created_at: string
  }>
  category_name?: string
  created_at?: string
  updated_at?: string
}

interface Category {
  category_id: number
  category_name: string
}

interface AdminProductModalProps {
  show: boolean
  onHide: () => void
  product?: Product | null
  categories: Category[]
  onSave: (productData: Omit<Product, 'product_id' | 'category_name' | 'created_at' | 'updated_at'>) => Promise<void>
}

function AdminProductModal({ show, onHide, product, categories, onSave }: AdminProductModalProps) {
  const [formData, setFormData] = useState<Product>({
    category_id: 0,
    product_name: '',
    brand: '',
    model: '',
    description: '',
    price: 0,
    currency: 'USD',
    stock_quantity: 0,
    specifications: {},
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showImagesModal, setShowImagesModal] = useState(false)
  const [specificationsText, setSpecificationsText] = useState('')

  useEffect(() => {
    if (product) {
      setFormData(product)
      // Convert specifications object to JSON string for editing
      setSpecificationsText(product.specifications ? JSON.stringify(product.specifications, null, 2) : '')
    } else {
      setFormData({
        category_id: categories.length > 0 ? categories[0].category_id : 0,
        product_name: '',
        brand: '',
        model: '',
        description: '',
        price: 0,
        currency: 'USD',
        stock_quantity: 0,
        specifications: {}
      })
      setSpecificationsText('')
    }
    setErrors({})
  }, [product, show, categories])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const handleSpecificationsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSpecificationsText(e.target.value)
    
    // Try to parse JSON and update formData
    try {
      const parsed = e.target.value.trim() ? JSON.parse(e.target.value) : {}
      setFormData(prev => ({
        ...prev,
        specifications: parsed
      }))
      
      // Clear error if JSON is valid
      if (errors.specifications) {
        setErrors(prev => ({
          ...prev,
          specifications: ''
        }))
      }
    } catch (err) {
      // Don't update formData if JSON is invalid
      // Error will be shown in validation
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.product_name.trim()) newErrors.product_name = 'Product name is required'
    if (!formData.brand.trim()) newErrors.brand = 'Brand is required'
    if (!formData.category_id || formData.category_id === 0) newErrors.category_id = 'Category is required'
    if (formData.price <= 0) newErrors.price = 'Price must be greater than 0'
    if (formData.stock_quantity < 0) newErrors.stock_quantity = 'Stock quantity cannot be negative'
    
    // Validate specifications JSON
    if (specificationsText.trim()) {
      try {
        JSON.parse(specificationsText)
      } catch (err) {
        newErrors.specifications = 'Specifications must be valid JSON format'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setLoading(true)
    try {
      // Prepare data for saving (exclude fields that shouldn't be sent)
      const { product_id, category_name, created_at, updated_at, ...saveData } = formData
      
      await onSave(saveData)
      onHide()
    } catch (error) {
      console.error('Error saving product:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!show) return null

  return (
    <>
      <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                {product ? 'Edit Product' : 'Add New Product'}
              </h5>
              <button type="button" className="btn-close" onClick={onHide}></button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label htmlFor="product_name" className="form-label">Product Name *</label>
                    <input
                      type="text"
                      className={`form-control ${errors.product_name ? 'is-invalid' : ''}`}
                      id="product_name"
                      name="product_name"
                      value={formData.product_name}
                      onChange={handleChange}
                      required
                    />
                    {errors.product_name && <div className="invalid-feedback">{errors.product_name}</div>}
                  </div>
                  
                  <div className="col-md-6 mb-3">
                    <label htmlFor="brand" className="form-label">Brand *</label>
                    <input
                      type="text"
                      className={`form-control ${errors.brand ? 'is-invalid' : ''}`}
                      id="brand"
                      name="brand"
                      value={formData.brand}
                      onChange={handleChange}
                      required
                    />
                    {errors.brand && <div className="invalid-feedback">{errors.brand}</div>}
                  </div>
                </div>
                
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label htmlFor="model" className="form-label">Model</label>
                    <input
                      type="text"
                      className="form-control"
                      id="model"
                      name="model"
                      value={formData.model}
                      onChange={handleChange}
                    />
                  </div>
                  
                  <div className="col-md-6 mb-3">
                    <label htmlFor="category_id" className="form-label">Category *</label>
                    <select
                      className={`form-select ${errors.category_id ? 'is-invalid' : ''}`}
                      id="category_id"
                      name="category_id"
                      value={formData.category_id}
                      onChange={handleChange}
                      required
                    >
                      <option value={0}>Select Category</option>
                      {categories.map(category => (
                        <option key={category.category_id} value={category.category_id}>
                          {category.category_name}
                        </option>
                      ))}
                    </select>
                    {errors.category_id && <div className="invalid-feedback">{errors.category_id}</div>}
                  </div>
                </div>
                
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <label htmlFor="price" className="form-label">Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={`form-control ${errors.price ? 'is-invalid' : ''}`}
                      id="price"
                      name="price"
                      value={formData.price}
                      onChange={handleNumberChange}
                      required
                    />
                    {errors.price && <div className="invalid-feedback">{errors.price}</div>}
                  </div>
                  
                  <div className="col-md-4 mb-3">
                    <label htmlFor="currency" className="form-label">Currency *</label>
                    <select
                      className={`form-select ${errors.currency ? 'is-invalid' : ''}`}
                      id="currency"
                      name="currency"
                      value={formData.currency}
                      onChange={handleChange}
                      required
                    >
                      {getCurrencyOptions().map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {errors.currency && <div className="invalid-feedback">{errors.currency}</div>}
                  </div>
                  
                  <div className="col-md-4 mb-3">
                    <label htmlFor="stock_quantity" className="form-label">Stock Quantity *</label>
                    <input
                      type="number"
                      min="0"
                      className={`form-control ${errors.stock_quantity ? 'is-invalid' : ''}`}
                      id="stock_quantity"
                      name="stock_quantity"
                      value={formData.stock_quantity}
                      onChange={handleNumberChange}
                      required
                    />
                    {errors.stock_quantity && <div className="invalid-feedback">{errors.stock_quantity}</div>}
                  </div>
                </div>
                
                <div className="mb-3">
                  <label htmlFor="description" className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    id="description"
                    name="description"
                    rows={3}
                    value={formData.description}
                    onChange={handleChange}
                  />
                </div>

                {/* Specifications Section */}
                <div className="mb-3">
                  <label htmlFor="specifications" className="form-label">
                    Specifications (JSON Format)
                    <small className="text-muted ms-2">
                      <i className="bi bi-info-circle"></i>
                      Enter product specifications as JSON (e.g., {"{"}"processor": "Intel i7", "ram": "16GB"{"}"})
                    </small>
                  </label>
                  <textarea
                    className={`form-control ${errors.specifications ? 'is-invalid' : ''}`}
                    id="specifications"
                    rows={6}
                    value={specificationsText}
                    onChange={handleSpecificationsChange}
                    placeholder='{"processor": "Intel i7", "ram": "16GB", "storage": "512GB SSD"}'
                    style={{fontFamily: 'monospace', fontSize: '0.9em'}}
                  />
                  {errors.specifications && <div className="invalid-feedback">{errors.specifications}</div>}
                  <div className="form-text">
                    <i className="bi bi-lightbulb me-1"></i>
                    Tip: Use JSON format for structured product specifications. Leave empty if not needed.
                  </div>
                </div>
                
                {/* Images Management Section */}
                {product && (
                  <div className="mb-3">
                    <label className="form-label">Product Images</label>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-primary"
                        onClick={() => setShowImagesModal(true)}
                      >
                        <i className="bi bi-images me-2"></i>
                        Manage Images
                      </button>
                      {product.images && product.images.length > 0 && (
                        <span className="text-muted align-self-center">
                          {product.images.length} image{product.images.length !== 1 ? 's' : ''} 
                          {product.images.some(img => img.is_primary) && ' (primary set)'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onHide}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Saving...
                    </>
                  ) : (
                    product ? 'Update Product' : 'Create Product'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      {/* Product Images Modal */}
      {product && product.product_id && (
        <AdminProductImagesModal
          show={showImagesModal}
          onHide={() => setShowImagesModal(false)}
          productId={product.product_id}
          onImagesChange={() => {
            // Refresh the product data to get updated images
            // This could be improved by refetching the product data
          }}
        />
      )}
    </>
  )
}

export default AdminProductModal
