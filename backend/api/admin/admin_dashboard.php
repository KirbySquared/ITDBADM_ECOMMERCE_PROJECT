<?php
/**
 * ADMIN DASHBOARD API ENDPOINT
 * 
 * This endpoint provides dashboard statistics and data for the admin panel.
 * 
 * ROUTE: /api/admin/dashboard
 * METHOD: GET
 * HEADERS: { "Authorization": "Bearer <jwt_token>" }
 * 
 * RESPONSE SUCCESS:
 * {
 *   "success": true,
 *   "message": "Admin dashboard data retrieved successfully",
 *   "data": {
 *     "totalUsers": 150,
 *     "totalProducts": 25,
 *     "totalOrders": 89,
 *     "totalRevenue": 12500.50,
 *     "recentOrders": [
 *       { "order_id": 1, "first_name": "John", "last_name": "Doe", "email": "john@example.com", "total_amount": 299.99, "status": "delivered", "created_at": "2024-01-15 10:30:00" }
 *     ],
 *     "lowStockProducts": [
 *       { "product_id": 5, "product_name": "Gaming Mouse", "brand": "Logitech", "stock_quantity": 3 }
 *     ]
 *   }
 * }
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token
 * - Validates admin role
 * - Returns 403 if not admin
 * 
 * DATABASE QUERIES:
 * - Counts users (excluding admins)
 * - Counts total products
 * - Counts total orders
 * - Calculates total revenue (excluding cancelled orders)
 * - Fetches recent orders with user details
 * - Finds low stock products (< 10 items)
 * 
 * TO ADD NEW FEATURES:
 * - Add new statistics queries
 * - Include additional data in response
 * - Add filtering or pagination
 * - Modify the low stock threshold
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

// Get authorization header
$headers = getallheaders();
$token = null;

if (isset($headers['Authorization'])) {
    $token = str_replace('Bearer ', '', $headers['Authorization']);
}

if (!$token) {
    sendError('Authorization token required', 401);
}

// Validate token
$userId = validateToken($token);
if (!$userId) {
    sendError('Invalid or expired token', 401);
}

// Check if user is admin
try {
    $stmt = $pdo->prepare("SELECT role FROM users WHERE user_id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    
    if (!$user || $user['role'] !== 'admin') {
        sendError('Admin access required', 403);
    }
    
    // Get dashboard statistics
    $stats = [];
    
    // Total users (excluding admins)
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM users WHERE role = 'user'");
    $stats['totalUsers'] = $stmt->fetch()['total'];
    
    // Total products
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM products");
    $stats['totalProducts'] = $stmt->fetch()['total'];
    
    // Total orders
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM orders");
    $stats['totalOrders'] = $stmt->fetch()['total'];
    
    // Total revenue
    $stmt = $pdo->query("SELECT SUM(total_amount) as total FROM orders WHERE status != 'cancelled'");
    $stats['totalRevenue'] = $stmt->fetch()['total'] ?? 0;
    
    // Recent orders
    $stmt = $pdo->query("
        SELECT o.*, u.first_name, u.last_name, u.email 
        FROM orders o 
        JOIN users u ON o.user_id = u.user_id 
        ORDER BY o.order_date DESC 
        LIMIT 10
    ");
    $stats['recentOrders'] = $stmt->fetchAll();
    
    // Low stock products - aggregate stock across all branches
    $stmt = $pdo->query("
        SELECT 
            p.product_id,
            p.product_name,
            p.brand,
            COALESCE(SUM(pi.stock_qty), 0) AS stock_quantity
        FROM products p
        LEFT JOIN product_inventory pi ON p.product_id = pi.product_id
        GROUP BY p.product_id, p.product_name, p.brand
        HAVING COALESCE(SUM(pi.stock_qty), 0) < 10
        ORDER BY stock_quantity ASC
    ");
    $stats['lowStockProducts'] = $stmt->fetchAll();
    
    sendResponse($stats, 'Admin dashboard data retrieved successfully');
    
} catch (PDOException $e) {
    error_log('Dashboard PDO Error: ' . $e->getMessage());
    sendError('Failed to retrieve admin dashboard data: ' . $e->getMessage(), 500);
} catch (Throwable $e) {
    error_log('Dashboard Error: ' . $e->getMessage());
    sendError('Failed to retrieve admin dashboard data: ' . $e->getMessage(), 500);
}
?>
