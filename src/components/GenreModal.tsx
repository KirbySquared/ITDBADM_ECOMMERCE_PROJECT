/**
 * GENRE FORM MODAL COMPONENT
 * 
 * This component provides a modal form for creating and editing genres.
 * 
 * FEATURES:
 * - Create new genres
 * - Edit existing genres
 * - Form validation
 * - Loading states
 * - Error handling
 * 
 * USAGE:
 * <GenreModal 
 *   show={showModal} 
 *   onHide={() => setShowModal(false)} 
 *   genre={selectedGenre} 
 *   onSave={handleSaveGenre} 
 */
import { useState, useEffect } from 'react'

interface Genre {
  genre_id?: number
  genre_name: string
  description?: string
  product_count?: number
  created_at?: string
}

interface GenreModalProps {
  show: boolean
  onHide: () => void
  genre?: Genre | null
  onSave: (genreData: Omit<Genre, 'genre_id' | 'product_count' | 'created_at'>) => Promise<void>
}

function GenreModal({ show, onHide, genre, onSave }: GenreModalProps) {
  const [formData, setFormData] = useState<Genre>({
    genre_name: '',
    description: ''
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (genre) {
      setFormData(genre)
    } else {
      setFormData({
        genre_name: '',
        description: ''
      })
    }
    setErrors({})
  }, [genre, show])

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
    
    if (!formData.genre_name.trim()) {
      newErrors.genre_name = 'Genre name is required'
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
      const { genre_id, product_count, created_at, ...saveData } = formData
      
      await onSave(saveData)
      onHide()
    } catch (error) {
      console.error('Error saving genre:', error)
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
              {genre ? 'Edit Genre' : 'Add New Genre'}
            </h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label htmlFor="genre_name" className="form-label">Genre Name *</label>
                <input
                  type="text"
                  className={`form-control ${errors.genre_name ? 'is-invalid' : ''}`}
                  id="genre_name"
                  name="genre_name"
                  value={formData.genre_name}
                  onChange={handleChange}
                  placeholder="Enter genre name"
                  required
                />
                {errors.genre_name && <div className="invalid-feedback">{errors.genre_name}</div>}
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
                  placeholder="Enter genre description (optional)"
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
                  genre ? 'Update Genre' : 'Create Genre'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default GenreModal

