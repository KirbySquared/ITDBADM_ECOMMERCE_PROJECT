<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/currency_api.php';
require_once __DIR__ . '/../../utils/stored_procedure_helper.php';
require_once '../../utils/admin_auth.php';

// Require admin authentication
$adminId = requireAdminAuth();

try {
    // Get dashboard statistics
    $stats = [];
    
    // Total users
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
        ORDER BY o.created_at DESC 
        LIMIT 10
    ");
    $stats['recentOrders'] = $stmt->fetchAll();
    
    // Low stock products using stored procedure
    // Get low stock products (threshold: 10, all branches)
    $stats['lowStockProducts'] = callStoredProcedure($pdo, 'sp_get_low_stock_products', [10, null]);
    
    sendResponse($stats, 'Dashboard data retrieved successfully');
    
} catch (PDOException $e) {
    sendError('Failed to retrieve dashboard data', 500);
}
?>
