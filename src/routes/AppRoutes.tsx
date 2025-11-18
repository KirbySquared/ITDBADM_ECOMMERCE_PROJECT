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
import PcBuilder from '../pages/PcBuilder'
import Cart from '../pages/Cart'
import Checkout from '../pages/Checkout'
import OrderConfirmation from '../pages/OrderConfirmation'
import Login from '../pages/Login'
import Register from '../pages/Register'
import Profile from '../pages/Profile'
import AdminLogin from '../pages/AdminLogin'
import AdminDashboard from '../pages/AdminDashboard'
import AdminProducts from '../pages/AdminProducts'
import AdminOrders from '../pages/AdminOrders'
import AdminUsers from '../pages/AdminUsers'
import AdminCategories from '../pages/AdminCategories'
import AdminGenres from '../pages/AdminGenres'
import AdminBranches from '../pages/AdminBranches'
import AdminRoute from '../components/AdminRoute'
import { AdminNotificationProvider } from '../context/AdminNotificationContext'
import StaffLogin from '../pages/StaffLogin'
import StaffDashboard from '../pages/StaffDashboard'
import StaffOrders from '../pages/StaffOrders'
import StaffInventory from '../pages/StaffInventory'
import StaffRoute from '../components/StaffRoute'

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/products" element={<Products />} />
      <Route path="/products/:id" element={<ProductDetail />} />
      <Route path="/pc-builder" element={<PcBuilder />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/orders/:id" element={<OrderConfirmation />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/profile" element={<Profile />} />
      
      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={
        <AdminRoute>
          <AdminNotificationProvider>
            <AdminDashboard />
          </AdminNotificationProvider>
        </AdminRoute>
      } />
      
      {/* Admin Management Routes */}
      <Route path="/admin/products" element={
        <AdminRoute>
          <AdminNotificationProvider>
            <AdminProducts />
          </AdminNotificationProvider>
        </AdminRoute>
      } />
      
      <Route path="/admin/orders" element={
        <AdminRoute>
          <AdminNotificationProvider>
            <AdminOrders />
          </AdminNotificationProvider>
        </AdminRoute>
      } />
      
      <Route path="/admin/users" element={
        <AdminRoute>
          <AdminNotificationProvider>
            <AdminUsers />
          </AdminNotificationProvider>
        </AdminRoute>
      } />
      
      <Route path="/admin/categories" element={
        <AdminRoute>
          <AdminNotificationProvider>
            <AdminCategories />
          </AdminNotificationProvider>
        </AdminRoute>
      } />
      
      <Route path="/admin/genres" element={
        <AdminRoute>
          <AdminNotificationProvider>
            <AdminGenres />
          </AdminNotificationProvider>
        </AdminRoute>
      } />
      
      <Route path="/admin/branches" element={
        <AdminRoute>
          <AdminNotificationProvider>
            <AdminBranches />
          </AdminNotificationProvider>
        </AdminRoute>
      } />
      
      {/* Staff Routes */}
      <Route path="/staff/login" element={<StaffLogin />} />
      <Route path="/staff" element={
        <StaffRoute>
          <StaffDashboard />
        </StaffRoute>
      } />
      
      <Route path="/staff/orders" element={
        <StaffRoute>
          <StaffOrders />
        </StaffRoute>
      } />
      
      <Route path="/staff/inventory" element={
        <StaffRoute>
          <StaffInventory />
        </StaffRoute>
      } />
    </Routes>
  )
}

export default AppRoutes
