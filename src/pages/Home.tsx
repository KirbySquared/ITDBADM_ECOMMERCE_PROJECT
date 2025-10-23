import { Link } from 'react-router-dom'
import { formatPrice } from '../utils/currency'
import './Home.css'

function Home() {
  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero bg-primary text-white py-5">
        <div className="container">
          <div className="row justify-content-center text-center">
            <div className="col-lg-8">
              <h1 className="display-4 fw-bold mb-4">Welcome to GameStore</h1>
              <p className="lead mb-4">Discover the latest gaming products, consoles, and accessories</p>
              <Link to="/products" className="btn btn-light btn-lg px-4">
                Shop Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-5">
        <div className="container">
          <div className="row">
            <div className="col-12 text-center mb-5">
              <h2 className="display-5 fw-bold">Featured Products</h2>
            </div>
          </div>
          <div className="row g-4">
            {/* Placeholder products - will be replaced with real data */}
            <div className="col-lg-4 col-md-6">
              <div className="card h-100 shadow-sm">
                <div className="card-img-top bg-light" style={{height: '200px'}}>
                  <div className="d-flex align-items-center justify-content-center h-100">
                    <i className="bi bi-image text-muted fs-1"></i>
                  </div>
                </div>
                <div className="card-body d-flex flex-column">
                  <h5 className="card-title">Gaming Console</h5>
                  <p className="card-text text-primary fw-bold fs-5">{formatPrice(299.99, 'USD')}</p>
                  <div className="mt-auto">
                    <button className="btn btn-primary w-100">Add to Cart</button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="col-lg-4 col-md-6">
              <div className="card h-100 shadow-sm">
                <div className="card-img-top bg-light" style={{height: '200px'}}>
                  <div className="d-flex align-items-center justify-content-center h-100">
                    <i className="bi bi-image text-muted fs-1"></i>
                  </div>
                </div>
                <div className="card-body d-flex flex-column">
                  <h5 className="card-title">Gaming Headset</h5>
                  <p className="card-text text-primary fw-bold fs-5">{formatPrice(149.99, 'USD')}</p>
                  <div className="mt-auto">
                    <button className="btn btn-primary w-100">Add to Cart</button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="col-lg-4 col-md-6">
              <div className="card h-100 shadow-sm">
                <div className="card-img-top bg-light" style={{height: '200px'}}>
                  <div className="d-flex align-items-center justify-content-center h-100">
                    <i className="bi bi-image text-muted fs-1"></i>
                  </div>
                </div>
                <div className="card-body d-flex flex-column">
                  <h5 className="card-title">Gaming Mouse</h5>
                  <p className="card-text text-primary fw-bold fs-5">{formatPrice(79.99, 'USD')}</p>
                  <div className="mt-auto">
                    <button className="btn btn-primary w-100">Add to Cart</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-5 bg-light">
        <div className="container">
          <div className="row">
            <div className="col-12 text-center mb-5">
              <h2 className="display-5 fw-bold">Shop by Category</h2>
            </div>
          </div>
          <div className="row g-4">
            <div className="col-lg-3 col-md-6">
              <Link to="/products?category=consoles" className="text-decoration-none">
                <div className="card h-100 shadow-sm text-center p-4">
                  <div className="card-body">
                    <i className="bi bi-controller text-primary fs-1 mb-3"></i>
                    <h5 className="card-title">Consoles</h5>
                  </div>
                </div>
              </Link>
            </div>
            <div className="col-lg-3 col-md-6">
              <Link to="/products?category=accessories" className="text-decoration-none">
                <div className="card h-100 shadow-sm text-center p-4">
                  <div className="card-body">
                    <i className="bi bi-headphones text-primary fs-1 mb-3"></i>
                    <h5 className="card-title">Accessories</h5>
                  </div>
                </div>
              </Link>
            </div>
            <div className="col-lg-3 col-md-6">
              <Link to="/products?category=games" className="text-decoration-none">
                <div className="card h-100 shadow-sm text-center p-4">
                  <div className="card-body">
                    <i className="bi bi-disc text-primary fs-1 mb-3"></i>
                    <h5 className="card-title">Games</h5>
                  </div>
                </div>
              </Link>
            </div>
            <div className="col-lg-3 col-md-6">
              <Link to="/products?category=pc" className="text-decoration-none">
                <div className="card h-100 shadow-sm text-center p-4">
                  <div className="card-body">
                    <i className="bi bi-pc-display text-primary fs-1 mb-3"></i>
                    <h5 className="card-title">PC Gaming</h5>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
