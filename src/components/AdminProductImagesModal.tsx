/**
 * ADMIN PRODUCT IMAGES MODAL COMPONENT
 * 
 * This component provides a modal for managing multiple images for a product in the admin dashboard.
 * 
 * FEATURES:
 * - View all product images
 * - Add new images
 * - Set primary image
 * - Delete images
 * - Reorder images
 * 
 * USAGE:
 * <AdminProductImagesModal 
 *   show={showModal} 
 *   onHide={() => setShowModal(false)} 
 *   productId={productId}
 *   onImagesChange={handleImagesChange} 
 * />
 */
import { useState, useEffect } from 'react'

interface ProductImage {
  image_id: number
  image_url: string
  alt_text?: string
  is_primary: boolean
  sort_order: number
  created_at: string
}

interface AdminProductImagesModalProps {
  show: boolean
  onHide: () => void
  productId: number
  onImagesChange?: () => void
}

function AdminProductImagesModal({ show, onHide, productId, onImagesChange }: AdminProductImagesModalProps) {
  const [images, setImages] = useState<ProductImage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newImageUrl, setNewImageUrl] = useState('')
  const [newImageAlt, setNewImageAlt] = useState('')
  const [addingImage, setAddingImage] = useState(false)

  useEffect(() => {
    if (show && productId) {
      fetchImages()
    }
  }, [show, productId])

  const fetchImages = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:8000/api/admin/products/${productId}/images`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch images')
      }

      const data = await response.json()
      if (data.success) {
        setImages(data.data)
      } else {
        throw new Error(data.message || 'Failed to fetch images')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch images')
    } finally {
      setLoading(false)
    }
  }

  const addImage = async () => {
    if (!newImageUrl.trim()) return

    setAddingImage(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:8000/api/admin/products/${productId}/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_url: newImageUrl.trim(),
          alt_text: newImageAlt.trim() || null,
          is_primary: images.length === 0, // Set as primary if it's the first image
          sort_order: images.length
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add image')
      }

      const data = await response.json()
      if (data.success) {
        setNewImageUrl('')
        setNewImageAlt('')
        await fetchImages() // Refresh the images list
        onImagesChange?.() // Notify parent component
      } else {
        throw new Error(data.message || 'Failed to add image')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add image')
    } finally {
      setAddingImage(false)
    }
  }

  const setPrimaryImage = async (imageId: number) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:8000/api/admin/products/${productId}/images/${imageId}/primary`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to set primary image')
      }

      await fetchImages() // Refresh the images list
      onImagesChange?.() // Notify parent component
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set primary image')
    }
  }

  const deleteImage = async (imageId: number) => {
    if (!confirm('Are you sure you want to delete this image?')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:8000/api/admin/products/${productId}/images/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete image')
      }

      await fetchImages() // Refresh the images list
      onImagesChange?.() // Notify parent component
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image')
    }
  }

  if (!show) return null

  return (
    <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-images me-2"></i>
              Manage Product Images
            </h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>
          
          <div className="modal-body">
            {error && (
              <div className="alert alert-danger" role="alert">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}

            {/* Add New Image Form */}
            <div className="card mb-4">
              <div className="card-header">
                <h6 className="mb-0">
                  <i className="bi bi-plus-circle me-2"></i>
                  Add New Image
                </h6>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-8">
                    <label htmlFor="newImageUrl" className="form-label">Image URL *</label>
                    <input
                      type="url"
                      className="form-control"
                      id="newImageUrl"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label htmlFor="newImageAlt" className="form-label">Alt Text</label>
                    <input
                      type="text"
                      className="form-control"
                      id="newImageAlt"
                      value={newImageAlt}
                      onChange={(e) => setNewImageAlt(e.target.value)}
                      placeholder="Image description"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={addImage}
                    disabled={addingImage || !newImageUrl.trim()}
                  >
                    {addingImage ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Adding...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-plus me-2"></i>
                        Add Image
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Images Grid */}
            <div className="images-section">
              <h6 className="mb-3">
                <i className="bi bi-collection me-2"></i>
                Product Images ({images.length})
              </h6>
              
              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading images...</span>
                  </div>
                  <p className="mt-2 text-muted">Loading images...</p>
                </div>
              ) : images.length === 0 ? (
                <div className="text-center py-4">
                  <i className="bi bi-image text-muted" style={{fontSize: '3rem'}}></i>
                  <p className="text-muted mt-2">No images added yet</p>
                  <small className="text-muted">Add your first image using the form above</small>
                </div>
              ) : (
                <div className="row g-3">
                  {images.map(image => (
                    <div key={image.image_id} className="col-md-4 col-sm-6">
                      <div className="card">
                        <div className="position-relative">
                          <img 
                            src={image.image_url} 
                            alt={image.alt_text || `Product image ${image.image_id}`}
                            className="card-img-top"
                            style={{height: '150px', objectFit: 'cover'}}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
                            }}
                          />
                          {image.is_primary ? (
                            <span className="badge bg-warning position-absolute top-0 start-0 m-2">
                              <i className="bi bi-star-fill me-1"></i>
                              Primary
                            </span>
                          ) : null}
                        </div>
                        <div className="card-body p-2">
                          <div className="d-flex gap-1">
                            {!image.is_primary && (
                              <button
                                className="btn btn-sm btn-outline-primary flex-fill"
                                onClick={() => setPrimaryImage(image.image_id)}
                                title="Set as primary"
                              >
                                <i className="bi bi-star"></i>
                              </button>
                            )}
                            <button
                              className="btn btn-sm btn-outline-danger flex-fill"
                              onClick={() => deleteImage(image.image_id)}
                              title="Delete image"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                          {image.alt_text && (
                            <small className="text-muted d-block mt-1" title={image.alt_text}>
                              {image.alt_text.length > 20 ? `${image.alt_text.substring(0, 20)}...` : image.alt_text}
                            </small>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminProductImagesModal
