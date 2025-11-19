<?php
/**
 * STAFF DASHBOARD API ENDPOINT
 * 
 * This endpoint provides branch-specific dashboard statistics and data for the staff panel.
 * 
 * ROUTE: /api/staff/dashboard
 * METHOD: GET
 * HEADERS: { "Authorization": "Bearer <jwt_token>" }
 * 
 * All data is automatically filtered by the staff member's branch_id.
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/staff_auth.php';
require_once __DIR__ . '/../../utils/currency_api.php';

// Authenticate staff and get branch_id
$auth = requireStaffAuth();
$staffUserId = $auth['user_id'];
$branchId = $auth['branch_id'];

// Get currency parameter (default PHP)
$currency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';
if (!isValidCurrencyCode($currency)) {
    $currency = 'PHP';
}

try {
    // Get branch info
    $stmt = $pdo->prepare("SELECT branch_id, branch_name, address FROM branches WHERE branch_id = ?");
    $stmt->execute([$branchId]);
    $branch = $stmt->fetch();
    
    if (!$branch) {
        sendError('Branch not found', 404);
    }
    
    // Get dashboard statistics filtered by branch
    $stats = [];
    
    // Branch info
    $stats['branch'] = $branch;
    
    // New orders for the branch (pending/processing)
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as total 
        FROM orders 
        WHERE branch_id = ? AND status IN ('pending', 'processing')
    ");
    $stmt->execute([$branchId]);
    $stats['newOrders'] = $stmt->fetch()['total'];
    
    // Total orders for the branch
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as total 
        FROM orders 
        WHERE branch_id = ?
    ");
    $stmt->execute([$branchId]);
    $stats['totalOrders'] = $stmt->fetch()['total'];
    
    // Pending orders count
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as total 
        FROM orders 
        WHERE branch_id = ? AND status = 'pending'
    ");
    $stmt->execute([$branchId]);
    $stats['pendingOrders'] = $stmt->fetch()['total'];
    
    // Recent orders for the branch (last 10)
    $stmt = $pdo->prepare("
        SELECT o.*, u.first_name, u.last_name, u.email 
        FROM orders o 
        LEFT JOIN users u ON o.user_id = u.user_id 
        WHERE o.branch_id = ?
        ORDER BY o.order_date DESC 
        LIMIT 10
    ");
    $stmt->execute([$branchId]);
    $recentOrders = $stmt->fetchAll();
    
    // Convert order amounts to requested currency
    if ($currency !== 'PHP') {
        $rate = getExchangeRateFromAPI($currency);
        if ($rate !== null && $rate > 0) {
            // Get order currency snapshots for historical conversion
            $orderIds = array_column($recentOrders, 'order_id');
            $orderRates = [];
            if (!empty($orderIds)) {
                $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
                $rateStmt = $pdo->prepare("
                    SELECT order_id, order_currency, order_rate_to_php 
                    FROM order_currency_snapshots 
                    WHERE order_id IN ($placeholders)
                ");
                $rateStmt->execute($orderIds);
                while ($rateRow = $rateStmt->fetch(PDO::FETCH_ASSOC)) {
                    $orderRates[$rateRow['order_id']] = [
                        'currency' => $rateRow['order_currency'],
                        'rate_to_php' => (float)$rateRow['order_rate_to_php']
                    ];
                }
            }
            
            // Convert amounts
            foreach ($recentOrders as &$order) {
                if (isset($order['total_amount']) && is_numeric($order['total_amount'])) {
                    $amountInPhp = (float)$order['total_amount'];
                    if (isset($orderRates[$order['order_id']]) && $orderRates[$order['order_id']]['rate_to_php'] > 0) {
                        $order['total_amount'] = round(convertPriceFromPhp($amountInPhp, $currency), 2);
                    } else {
                        $order['total_amount'] = round(convertPriceFromPhp($amountInPhp, $currency), 2);
                    }
                    $order['currency'] = $currency;
                }
            }
            unset($order);
        }
    }
    $stats['recentOrders'] = $recentOrders;
    
    // Low stock products for this branch (< 10 items)
    $stmt = $pdo->prepare("
        SELECT 
            p.product_id,
            p.product_name,
            p.brand,
            COALESCE(pi.stock_qty, 0) AS stock_quantity
        FROM products p
        LEFT JOIN product_inventory pi ON p.product_id = pi.product_id AND pi.branch_id = ?
        WHERE COALESCE(pi.stock_qty, 0) < 10
        ORDER BY stock_quantity ASC
        LIMIT 10
    ");
    $stmt->execute([$branchId]);
    $stats['lowStockProducts'] = $stmt->fetchAll();
    
    sendResponse($stats, 'Staff dashboard data retrieved successfully');
    
} catch (PDOException $e) {
    error_log('Staff Dashboard PDO Error: ' . $e->getMessage());
    sendError('Failed to retrieve staff dashboard data: ' . $e->getMessage(), 500);
} catch (Throwable $e) {
    error_log('Staff Dashboard Error: ' . $e->getMessage());
    sendError('Failed to retrieve staff dashboard data: ' . $e->getMessage(), 500);
}
?>

