# Electronics Store - Development Setup Guide

## 🚀 Quick Start

### One-Click Setup
```cmd
start-dev.bat
```

This single command will start:
- SSH tunnel to remote MySQL server (separate window)
- PHP backend server (background)
- React frontend server (main window)

**Result**: Only 2 windows total - SSH tunnel window + main development window

## 📋 Prerequisites

### 1. Database Setup
1. Connect to your remote MySQL server using MySQL Workbench
2. Run the SQL script: `backend/database/electronics_store_group_9_schema-data.sql`
3. This creates the `electronics_store` database with all tables

### 2. Test Database Connection (Optional)
```cmd
cd backend
test-db.bat
```

## 🔧 Server Details

### PHP Backend
- **URL**: http://localhost:8000
- **Port**: 8000
- **Directory**: `backend/`
- **API Endpoints**: 
  - `GET /api/products` - Get all products
  - `GET /api/products/{id}` - Get single product
  - `POST /api/auth/login` - User login
  - `POST /api/auth/register` - User registration
  - `GET /api/cart` - Get user cart
  - `POST /api/cart` - Add to cart

### React Frontend
- **URL**: http://localhost:5173
- **Port**: 5173
- **Directory**: `src/`
- **Features**: Product browsing, cart, authentication, checkout

## 🛠️ Troubleshooting

### Common Issues
1. **SSH Password**: Enter your password when prompted in the SSH Tunnel window
2. **Database Not Created**: Run the SQL schema script on remote server first
3. **PHP Not Found**: Install PHP and add to system PATH
4. **Node.js Not Found**: Install Node.js from nodejs.org
5. **Dependencies Missing**: Run `npm install` first

## 🎯 Development Workflow
1. Run `start-dev.bat`
2. Enter SSH password in the SSH tunnel window
3. Wait for "Services Running" message
4. Open http://localhost:5173 in browser
5. Use Ctrl+C to stop backend and frontend (keep SSH tunnel open)
