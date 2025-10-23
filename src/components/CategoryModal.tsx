/**
 * CATEGORY FORM MODAL COMPONENT
 * 
 * This component provides a modal form for creating and editing categories.
 * 
 * FEATURES:
 * - Create new categories
 * - Edit existing categories
 * - Form validation
 * - Loading states
 * - Error handling
 * 
 * USAGE:
 * <CategoryModal 
 *   show={showModal} 
 *   onHide={() => setShowModal(false)} 
 *   category={selectedCategory} 
 *   onSave={handleSaveCategory} 
 * />
 */
import { useState, useEffect } from 'react'

interface Category {
  category_id?: number
  category_name: string
  description?: string
  product_count?: number
  created_at?: string
}

interface CategoryModalProps {
  show: boolean
  onHide: () => void
  category?: Category | null
  onSave: (categoryData: Omit<Category, 'category_id' | 'product_count' | 'created_at'>) => Promise<void>
}

function CategoryModal({ show, onHide, category, onSave }: CategoryModalProps) {
  const [formData, setFormData] = useState<Category>({
    category_name: '',
    description: ''
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (category) {
      setFormData(category)
    } else {
      setFormData({
        category_name: '',
        description: ''
      })
    }
    setErrors({})
  }, [category, show])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.category_name.trim()) {
      newErrors.category_name = 'Category name is required'
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
      const { category_id, product_count, created_at, ...saveData } = formData
      
      await onSave(saveData)
      onHide()
    } catch (error) {
      console.error('Error saving category:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!show) return null

  return (
    <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {category ? 'Edit Category' : 'Add New Category'}
            </h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label htmlFor="category_name" className="form-label">Category Name *</label>
                <input
                  type="text"
                  className={`form-control ${errors.category_name ? 'is-invalid' : ''}`}
                  id="category_name"
                  name="category_name"
                  value={formData.category_name}
                  onChange={handleChange}
                  placeholder="Enter category name"
                  required
                />
                {errors.category_name && <div className="invalid-feedback">{errors.category_name}</div>}
              </div>
              
              <div className="mb-3">
                <label htmlFor="description" className="form-label">Description</label>
                <textarea
                  className="form-control"
                  id="description"
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter category description (optional)"
                />
              </div>
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
                  category ? 'Update Category' : 'Create Category'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CategoryModal
