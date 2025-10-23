# Electronics Store - Admin Panel Documentation

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (for React frontend)
- PHP 8.0+ (for backend API)
- MySQL (remote database via SSH tunnel)
- Git (for version control)

### Setup Instructions
1. **Clone the repository** to your local machine
2. **Install dependencies**: `npm install`
3. **Start development servers**: Run `start-dev.bat` (Windows) or equivalent
4. **Access the application**:
   - Frontend: http://localhost:5173
   - Admin Panel: http://localhost:5173/admin/login
   - Backend API: http://localhost:8000

### Cleanup Instructions
- **Normal shutdown**: Let React frontend exit naturally → Close SSH tunnel window manually
- **Ctrl+C termination**: Press Ctrl+C → Close SSH tunnel window manually
- **Window closure**: Close the CMD window → Close SSH tunnel window manually
- **Manual SSH cleanup**: Simply close the SSH tunnel window when done with development

## 📁 Project Structure

```
ITDBADM_ECOMMERCE_PROJECT/
├── src/                          # React Frontend
│   ├── components/               # Reusable components
│   │   ├── Header.tsx           # Dynamic header (admin/user)
│   │   ├── Layout.tsx           # Main layout wrapper
│   │   └── AdminRoute.tsx       # Admin route protection
│   ├── pages/                   # Page components
│   │   ├── AdminLogin.tsx       # Admin login page
│   │   ├── AdminDashboard.tsx   # Admin dashboard
│   │   ├── Home.tsx             # Store homepage
│   │   ├── Products.tsx         # Products listing
│   │   └── ...                  # Other store pages
│   ├── hooks/                   # Custom React hooks
│   │   └── useAdminAuth.ts      # Admin authentication hook
│   └── routes/                  # Route definitions
│       └── AppRoutes.tsx        # Main routing configuration
├── backend/                     # PHP Backend API
│   ├── api/                     # API endpoints
│   │   ├── admin/               # Admin-specific endpoints
│   │   │   ├── admin_login.php  # Admin login API
│   │   │   ├── admin_dashboard.php # Dashboard data API
│   │   │   └── ...              # Other admin APIs
│   │   ├── auth/                # Authentication endpoints
│   │   ├── products/            # Product management
│   │   └── cart/                # Shopping cart
│   ├── config/                  # Configuration files
│   │   └── database.php         # Database connection
│   └── utils/                   # Utility functions
│       └── response.php         # API response helpers
└── start-dev.bat               # Development startup script
```

## 🔧 Backend API Endpoints

### Admin Endpoints
- `POST /api/admin/login` - Admin authentication
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/check_auth` - Verify admin token
- `POST /api/admin/logout` - Admin logout

### Store Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/products` - Get products
- `GET /api/categories` - Get categories
- `GET /api/cart` - Get user cart
- `POST /api/cart` - Add to cart

## 🎨 Frontend Components Guide

### Header Component (`src/components/Header.tsx`)
**Purpose**: Dynamic header that switches between admin and user interfaces

**Key Features**:
- Automatically detects admin status and current route
- Shows admin header on `/admin/*` pages
- Shows user header on all other pages
- Handles logout with redirection

**To Modify**:
- Add new navigation links in the appropriate section
- Update authentication logic if needed
- Modify logout behavior

### Admin Dashboard (`src/pages/AdminDashboard.tsx`)
**Purpose**: Main admin panel with statistics and navigation

**Key Features**:
- Statistics cards (users, products, orders, revenue)
- Recent orders table
- Low stock alerts
- Sidebar navigation

**To Add New Features**:
- Add new API calls in `fetchDashboardData()`
- Update the `DashboardStats` interface
- Add new UI components
- Update sidebar navigation

### Admin Authentication Hook (`src/hooks/useAdminAuth.ts`)
**Purpose**: Manages admin authentication state

**Key Features**:
- Checks authentication on mount
- Listens for auth state changes
- Validates admin role via API
- Provides logout functionality

**Usage**:
```typescript
const { isAdmin, isAuthenticated, user, logout, refreshAuth } = useAdminAuth()
```

## 🗄️ Database Schema

### Key Tables
- `users` - User accounts (with role: 'user' or 'admin')
- `products` - Product catalog
- `categories` - Product categories
- `orders` - Customer orders
- `cart` - Shopping cart items

### Admin User
- Email: `admin@electronicsstore.com`
- Password: `Dlsu1234!`
- Role: `admin`

## 🚀 Development Workflow

### Adding New Admin Features

1. **Backend API**:
   - Create new endpoint in `backend/api/admin/`
   - Add authentication checks
   - Update `backend/api/admin/index.php` routing
   - Test with Postman/curl

2. **Frontend Page**:
   - Create new component in `src/pages/`
   - Add route in `src/routes/AppRoutes.tsx`
   - Wrap with `AdminRoute` for protection
   - Add navigation link in `AdminDashboard.tsx`

3. **Integration**:
   - Update `useAdminAuth` hook if needed
   - Test authentication flow
   - Update header navigation if required

### Adding New Store Features

1. **Backend API**:
   - Create endpoint in appropriate `backend/api/` folder
   - Add to `backend/api/index.php` routing
   - Test API functionality

2. **Frontend Page**:
   - Create component in `src/pages/`
   - Add route in `src/routes/AppRoutes.tsx`
   - Update header navigation if needed

## 🔐 Authentication Flow

### Admin Login
1. User visits `/admin/login`
2. Enters admin credentials
3. API validates credentials and role
4. JWT token generated and stored
5. `authStateChanged` event fired
6. Header automatically switches to admin header
7. Redirect to `/admin` dashboard

### Admin Logout
1. User clicks logout button
2. API call to logout endpoint
3. Token removed from localStorage
4. Auth state updated
5. Redirect to home page
6. Header switches to user header

## 🐛 Common Issues & Solutions

### CORS Errors
- Ensure CORS headers are set in API endpoints
- Check that frontend URL matches CORS origin

### Authentication Issues
- Verify JWT token is being sent in headers
- Check that admin user exists in database
- Ensure password hash is correct

### Routing Issues
- Check that routes are properly defined in `AppRoutes.tsx`
- Verify `AdminRoute` wrapper is used for admin pages
- Ensure API routing is correct in `index.php` files

## 📝 Code Style Guidelines

### Frontend (React/TypeScript)
- Use functional components with hooks
- Define interfaces for all data types
- Use descriptive variable and function names
- Add comprehensive comments for complex logic

### Backend (PHP)
- Use PDO for database operations
- Always validate and sanitize input
- Return consistent JSON responses
- Add error logging for debugging

## 🚀 Deployment Notes

- Update database credentials in `backend/config/database.php`
- Change JWT secret in production
- Set up proper CORS origins
- Configure web server for PHP API
- Build React app for production

For questions or issues:
1. Check the code comments in each file
2. Review the API documentation above
3. Test with the provided admin credentials
4. Check browser console for frontend errors
5. Check PHP error logs for backend issues

---

