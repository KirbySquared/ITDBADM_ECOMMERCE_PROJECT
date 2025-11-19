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
require_once __DIR__ . '/../../utils/currency_api.php';

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
    
    // Get currency parameter (default PHP)
    $currency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';
    if (!isValidCurrencyCode($currency)) {
        $currency = 'PHP';
    }
    
    // Get exchange rate from API for currency conversion
    $rate = getExchangeRateFromAPI($currency);
    if ($rate === null) {
        $rate = 1.0; // Fallback to PHP if API fails
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
    
    // Total revenue - convert from stored currency to requested currency
    // Orders store amounts in their original currency, need to convert each
    $stmt = $pdo->query("
        SELECT 
            o.total_amount,
            o.currency as order_currency,
            COALESCE(ocs.rate_to_php, NULL) as order_rate_to_php
        FROM orders o
        LEFT JOIN order_currency_snapshots ocs ON o.order_id = ocs.order_id
        WHERE o.status != 'cancelled'
    ");
    $revenueRows = $stmt->fetchAll();
    
    $totalRevenueInPhp = 0;
    foreach ($revenueRows as $row) {
        $amountInPhp = $row['total_amount'];
        $orderCurrency = $row['order_currency'] ?? 'PHP';
        
        // Convert from order currency to PHP first
        if ($orderCurrency !== 'PHP') {
            if ($row['order_rate_to_php'] && $row['order_rate_to_php'] > 0) {
                // Use historical rate from snapshot if available
                // order_rate_to_php is rate FROM PHP TO order currency
                // So to convert FROM order currency TO PHP: amount / rate
                $amountInPhp = $row['total_amount'] / $row['order_rate_to_php'];
            } else {
                // No snapshot, use current rate (fallback)
                $currentRate = getExchangeRateFromAPI($orderCurrency);
                if ($currentRate && $currentRate > 0) {
                    $amountInPhp = $row['total_amount'] / $currentRate;
                }
                // If rate is null or 0, assume amount is already in PHP
            }
        }
        $totalRevenueInPhp += $amountInPhp;
    }
    
    // Convert total revenue from PHP to requested currency
    $stats['totalRevenue'] = convertPriceFromPhp($totalRevenueInPhp, $currency);
    $stats['currency'] = $currency; // Include currency in response
    
    // Recent orders - convert amounts to requested currency
    $stmt = $pdo->query("
        SELECT 
            o.*, 
            u.first_name, 
            u.last_name, 
            u.email,
            COALESCE(ocs.rate_to_php, NULL) as order_rate_to_php
        FROM orders o 
        JOIN users u ON o.user_id = u.user_id 
        LEFT JOIN order_currency_snapshots ocs ON o.order_id = ocs.order_id
        ORDER BY o.order_date DESC 
        LIMIT 10
    ");
    $recentOrders = $stmt->fetchAll();
    
    // Convert each order's total_amount to requested currency
    foreach ($recentOrders as &$order) {
        $amountInPhp = $order['total_amount'];
        $orderCurrency = $order['currency'] ?? 'PHP';
        
        // Convert from order currency to PHP first (if different)
        if ($orderCurrency !== 'PHP') {
            if ($order['order_rate_to_php'] && $order['order_rate_to_php'] > 0) {
                // Use historical rate from snapshot if available
                $amountInPhp = $order['total_amount'] / $order['order_rate_to_php'];
            } else {
                // No snapshot, use current rate (fallback)
                $currentRate = getExchangeRateFromAPI($orderCurrency);
                if ($currentRate && $currentRate > 0) {
                    $amountInPhp = $order['total_amount'] / $currentRate;
                }
                // If rate is null or 0, assume amount is already in PHP
            }
        }
        // Convert to requested currency
        $order['total_amount'] = convertPriceFromPhp($amountInPhp, $currency);
        $order['currency'] = $currency; // Update currency in response
    }
    unset($order); // Break reference
    
    $stats['recentOrders'] = $recentOrders;
    
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
