/**
 * ADMIN GENRES PAGE WITH CRUD FUNCTIONALITY
 * 
 * This page provides complete genre management functionality for admins.
 * 
 * FEATURES:
 * - Genre listing with search
 * - Create new genres
 * - Edit existing genres
 * - Delete genres (with product count validation)
 * - Real-time data updates
 * 
 * API ENDPOINTS:
 * - GET /api/admin/genres - List genres with pagination/filters
 * - POST /api/admin/genres - Create new genre
 * - PUT /api/admin/genres/{id} - Update genre
 * - DELETE /api/admin/genres/{id} - Delete genre
 */
import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import GenreModal from '../components/GenreModal'
import { useAdminNotification } from '../context/AdminNotificationContext'
import { api } from '../api/config'

interface Genre {
  genre_id: number
  genre_name: string
  description?: string
  product_count: number
  created_at: string
}

interface GenresResponse {
  genres: Genre[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

function AdminGenres() {
  const { showSuccess } = useAdminNotification()
  const [genres, setGenres] = useState<Genre[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null)
  const [error, setError] = useState('')

  const fetchGenres = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      if (!token) {
        setError('No authentication token found')
        return
      }

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10'
      })
      
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(api(`/admin/genres?${params}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch genres')
      }

      setGenres(data.data.genres)
      setTotalPages(data.data.pagination.pages)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch genres')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGenres()
  }, [currentPage])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchGenres()
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setCurrentPage(1)
    fetchGenres()
  }

  const handleCreateGenre = () => {
    setSelectedGenre(null)
    setShowModal(true)
  }

  const handleEditGenre = (genre: Genre) => {
    setSelectedGenre(genre)
    setShowModal(true)
  }

  const handleSaveGenre = async (genreData: Omit<Genre, 'genre_id' | 'product_count' | 'created_at'>) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const url = selectedGenre 
        ? api(`/admin/genres/${selectedGenre.genre_id}`)
        : api('/admin/genres')
      
      const method = selectedGenre ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(genreData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save genre')
      }

      // Refresh the genres list
      await fetchGenres()
      showSuccess(selectedGenre ? 'Genre updated successfully!' : 'Genre created successfully!')
    } catch (err) {
      throw err // Re-throw to be handled by the modal
    }
  }

  const handleDeleteGenre = async (genre: Genre) => {
    if (!window.confirm(`Are you sure you want to delete "${genre.genre_name}"? This action cannot be undone.`)) {
      return
    }

    if (genre.product_count > 0) {
      alert(`Cannot delete genre "${genre.genre_name}" because it has ${genre.product_count} associated product(s). Please update or delete those products first.`)
      return
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(api(`/admin/genres/${genre.genre_id}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete genre')
      }

      // Refresh the genres list
      await fetchGenres()
      showSuccess('Genre deleted successfully!')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete genre')
    }
  }

  return (
    <AdminLayout currentPath="/admin/genres">
      <div className="container-fluid">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h3 mb-0">
            <i className="bi bi-tags me-2"></i>
            Genres Management
          </h1>
          <button className="btn btn-primary" onClick={handleCreateGenre}>
            <i className="bi bi-plus-circle me-2"></i>
            Add New Genre
          </button>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
          </div>
        )}

        {/* Search Bar */}
        <div className="card mb-4">
          <div className="card-body">
            <form onSubmit={handleSearch}>
              <div className="row g-3">
                <div className="col-md-8">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search genres by name or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-primary flex-fill">
                      <i className="bi bi-search me-2"></i>
                      Search
                    </button>
                    {searchTerm && (
                      <button type="button" className="btn btn-outline-secondary" onClick={handleClearSearch}>
                        <i className="bi bi-x-lg"></i>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Genres Table */}
        <div className="card">
          <div className="card-body">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3">Loading genres...</p>
              </div>
            ) : genres.length === 0 ? (
              <div className="text-center py-5">
                <i className="bi bi-inbox text-muted" style={{fontSize: '3rem'}}></i>
                <p className="mt-3 text-muted">No genres found</p>
                {searchTerm && (
                  <button className="btn btn-outline-primary" onClick={handleClearSearch}>
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Genre Name</th>
                        <th>Description</th>
                        <th>Products</th>
                        <th>Created At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {genres.map(genre => (
                        <tr key={genre.genre_id}>
                          <td>{genre.genre_id}</td>
                          <td>
                            <strong>{genre.genre_name}</strong>
                          </td>
                          <td>
                            {genre.description ? (
                              <span className="text-muted">{genre.description}</span>
                            ) : (
                              <span className="text-muted fst-italic">No description</span>
                            )}
                          </td>
                          <td>
                            <span className="badge bg-info">{genre.product_count}</span>
                          </td>
                          <td>
                            {new Date(genre.created_at).toLocaleDateString()}
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => handleEditGenre(genre)}
                                title="Edit genre"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDeleteGenre(genre)}
                                disabled={genre.product_count > 0}
                                title={genre.product_count > 0 ? 'Cannot delete genre with products' : 'Delete genre'}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="d-flex justify-content-between align-items-center mt-4">
                    <div>
                      <p className="text-muted mb-0">
                        Page {currentPage} of {totalPages}
                      </p>
                    </div>
                    <nav>
                      <ul className="pagination mb-0">
                        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                          <button
                            className="page-link"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </button>
                        </li>
                        <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                          <button
                            className="page-link"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                          >
                            Next
                          </button>
                        </li>
                      </ul>
                    </nav>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Genre Modal */}
      <GenreModal
        show={showModal}
        onHide={() => {
          setShowModal(false)
          setSelectedGenre(null)
        }}
        genre={selectedGenre}
        onSave={handleSaveGenre}
      />
    </AdminLayout>
  )
}

export default AdminGenres

