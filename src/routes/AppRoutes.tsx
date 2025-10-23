/**
 * MAIN ROUTING CONFIGURATION
 * 
 * This file defines all the routes for the React application.
 * 
 * ROUTE TYPES:
 * - PUBLIC ROUTES: Accessible to everyone (Home, Products, Login, Register)
 * - PROTECTED ROUTES: Require user authentication (Profile, Cart, Checkout)
 * - ADMIN ROUTES: Require admin authentication (all /admin/* routes)
 * 
 * ADMIN ROUTES:
 * - /admin/login - Admin login page (public)
 * - /admin - Admin dashboard (protected)
 * - /admin/products - Products management (protected, placeholder)
 * - /admin/orders - Orders management (protected, placeholder)
 * - /admin/users - Users management (protected, placeholder)
 * - /admin/categories - Categories management (protected, placeholder)
 * 
 * TO ADD NEW ROUTES:
 * 1. Import the component at the top
 * 2. Add the Route element in the appropriate section
 * 3. Wrap admin routes with <AdminRoute> component
 * 4. Update navigation links in Header.tsx and AdminDashboard.tsx
 */
import { Routes, Route } from 'react-router-dom'
import Home from '../pages/Home'
import Products from '../pages/Products'
import ProductDetail from '../pages/ProductDetail'
import Cart from '../pages/Cart'
import Checkout from '../pages/Checkout'
import Login from '../pages/Login'
import Register from '../pages/Register'
import Profile from '../pages/Profile'
import AdminLogin from '../pages/AdminLogin'
import AdminDashboard from '../pages/AdminDashboard'
import AdminProducts from '../pages/AdminProducts'
import AdminOrders from '../pages/AdminOrders'
import AdminUsers from '../pages/AdminUsers'
import AdminCategories from '../pages/AdminCategories'
import AdminRoute from '../components/AdminRoute'

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/products" element={<Products />} />
      <Route path="/products/:id" element={<ProductDetail />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/profile" element={<Profile />} />
      
      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      } />
      
      {/* Admin Management Routes */}
      <Route path="/admin/products" element={
        <AdminRoute>
          <AdminProducts />
        </AdminRoute>
      } />
      
      <Route path="/admin/orders" element={
        <AdminRoute>
          <AdminOrders />
        </AdminRoute>
      } />
      
      <Route path="/admin/users" element={
        <AdminRoute>
          <AdminUsers />
        </AdminRoute>
      } />
      
      <Route path="/admin/categories" element={
        <AdminRoute>
          <AdminCategories />
        </AdminRoute>
      } />
    </Routes>
  )
}

export default AppRoutes
