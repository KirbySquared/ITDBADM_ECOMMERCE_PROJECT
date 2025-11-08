import './Footer.css'

function Footer() {
  return (
    <footer className="bg-dark text-light mt-auto">
      <div className="container py-5">
        <div className="row g-4">
          <div className="col-lg-4 col-md-6">
            <h5 className="text-white mb-3">GameStore</h5>
            <p className="text-light">Your one-stop shop for gaming products and accessories.</p>
          </div>
          
          <div className="col-lg-2 col-md-6">
            <h6 className="text-white mb-3">Quick Links</h6>
            <ul className="list-unstyled">
              <li className="mb-2"><a href="/products" className="text-light text-decoration-none">Products</a></li>
              <li className="mb-2"><a href="/cart" className="text-light text-decoration-none">Cart</a></li>
              <li className="mb-2"><a href="/login" className="text-light text-decoration-none">Login</a></li>
            </ul>
          </div>
          
          <div className="col-lg-2 col-md-6">
            <h6 className="text-white mb-3">Support</h6>
            <ul className="list-unstyled">
              <li className="mb-2"><a href="/contact" className="text-light text-decoration-none">Contact Us</a></li>
              <li className="mb-2"><a href="/shipping" className="text-light text-decoration-none">Shipping Info</a></li>
              <li className="mb-2"><a href="/returns" className="text-light text-decoration-none">Returns</a></li>
            </ul>
          </div>
        </div>
        
        <hr className="my-4 border-secondary" />
        
        <div className="row">
          <div className="col-12 text-center">
            <p className="text-light mb-0">&copy; 2025-2026 ITDBADM GameStore. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
