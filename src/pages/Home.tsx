import { Link } from 'react-router-dom'
import './Home.css'

function Home() {
  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1>Welcome to GameStore</h1>
            <p>Discover the latest gaming products, consoles, and accessories</p>
            <Link to="/products" className="btn btn-primary btn-large">
              Shop Now
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="featured-products">
        <div className="container">
          <h2>Featured Products</h2>
          <div className="product-grid">
            {/* Placeholder products - will be replaced with real data */}
            <div className="product-card">
              <div className="product-image">
                <img src="/placeholder-product.jpg" alt="Gaming Console" />
              </div>
              <div className="product-info">
                <h3>Gaming Console</h3>
                <p className="price">$299.99</p>
                <button className="btn btn-primary">Add to Cart</button>
              </div>
            </div>
            
            <div className="product-card">
              <div className="product-image">
                <img src="/placeholder-product.jpg" alt="Gaming Headset" />
              </div>
              <div className="product-info">
                <h3>Gaming Headset</h3>
                <p className="price">$149.99</p>
                <button className="btn btn-primary">Add to Cart</button>
              </div>
            </div>
            
            <div className="product-card">
              <div className="product-image">
                <img src="/placeholder-product.jpg" alt="Gaming Mouse" />
              </div>
              <div className="product-info">
                <h3>Gaming Mouse</h3>
                <p className="price">$79.99</p>
                <button className="btn btn-primary">Add to Cart</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="categories">
        <div className="container">
          <h2>Shop by Category</h2>
          <div className="category-grid">
            <Link to="/products?category=consoles" className="category-card">
              <h3>Consoles</h3>
            </Link>
            <Link to="/products?category=accessories" className="category-card">
              <h3>Accessories</h3>
            </Link>
            <Link to="/products?category=games" className="category-card">
              <h3>Games</h3>
            </Link>
            <Link to="/products?category=pc" className="category-card">
              <h3>PC Gaming</h3>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
