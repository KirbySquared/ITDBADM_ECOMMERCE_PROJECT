<?php
/**
 * STAFF ORDERS API ENDPOINT
 * 
 * This endpoint handles order management operations for staff.
 * All operations are automatically filtered by staff's branch_id.
 * 
 * ROUTES:
 * - GET /api/staff/orders - List orders filtered by staff's branch_id
 * - GET /api/staff/orders/{id} - Get specific order details (only if order belongs to staff's branch)
 * - PUT /api/staff/orders/{id} - Update order status (restricted: cannot cancel, can only progress status)
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token
 * - Validates staff role and branch_id
 * - Returns 403 if not staff or order doesn't belong to staff's branch
 * 
 * ACID COMPLIANCE ANALYSIS:
 * 
 * PUT (Update Order Status):
 *   ATOMICITY: GOOD - Uses transaction wrapper
 *   CONSISTENCY: GOOD - Validates order belongs to staff's branch, enforces status progression
 *   ISOLATION: GOOD - Uses FOR UPDATE on order existence check
 *   DURABILITY: GOOD - COMMIT ensures persistence
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

// Get request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$pathParts = explode('/', trim($path, '/'));

// Extract order ID if present
$orderIdParam = null;
if (count($pathParts) >= 4 && is_numeric($pathParts[3])) {
    $orderIdParam = intval($pathParts[3]);
}

try {
    switch ($method) {
        case 'GET':
            if ($orderIdParam) {
                // Get specific order with items and user details (only if belongs to staff's branch)
                $stmt = $pdo->prepare("
                    SELECT o.*, u.first_name, u.last_name, u.email, u.phone
                    FROM orders o 
                    LEFT JOIN users u ON o.user_id = u.user_id 
                    WHERE o.order_id = ? AND o.branch_id = ?
                ");
                $stmt->execute([$orderIdParam, $branchId]);
                $order = $stmt->fetch();
                
                if (!$order) {
                    sendError('Order not found or access denied', 404);
                }
                
                // Get order items with product details
                $stmt = $pdo->prepare("
                    SELECT oi.*, p.product_name, p.brand, p.model,
                           (SELECT image_url FROM product_images WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) as product_image
                    FROM order_items oi 
                    LEFT JOIN products p ON oi.product_id = p.product_id 
                    WHERE oi.order_id = ?
                    ORDER BY oi.order_item_id ASC
                ");
                $stmt->execute([$orderIdParam]);
                $order['items'] = $stmt->fetchAll();
                
                // Get payment details if exists
                $stmt = $pdo->prepare("
                    SELECT payment_method, payment_status, amount, currency, transaction_id, payment_date
                    FROM payments 
                    WHERE order_id = ?
                ");
                $stmt->execute([$orderIdParam]);
                $payment = $stmt->fetch();
                
                // Convert amounts to requested currency
                if ($currency !== 'PHP') {
                    $rate = getExchangeRateFromAPI($currency);
                    if ($rate !== null && $rate > 0) {
                        // Get order currency snapshot for historical conversion
                        $rateStmt = $pdo->prepare("
                            SELECT order_currency, order_rate_to_php 
                            FROM order_currency_snapshots 
                            WHERE order_id = ?
                        ");
                        $rateStmt->execute([$orderIdParam]);
                        $orderRate = $rateStmt->fetch(PDO::FETCH_ASSOC);
                        
                        // Convert order total
                        if (isset($order['total_amount']) && is_numeric($order['total_amount'])) {
                            $order['total_amount'] = round(convertPriceFromPhp((float)$order['total_amount'], $currency), 2);
                            $order['currency'] = $currency;
                        }
                        
                        // Convert order items
                        if (isset($order['items']) && is_array($order['items'])) {
                            foreach ($order['items'] as &$item) {
                                if (isset($item['unit_price']) && is_numeric($item['unit_price'])) {
                                    $item['unit_price'] = round(convertPriceFromPhp((float)$item['unit_price'], $currency), 2);
                                }
                                if (isset($item['subtotal']) && is_numeric($item['subtotal'])) {
                                    $item['subtotal'] = round(convertPriceFromPhp((float)$item['subtotal'], $currency), 2);
                                }
                            }
                            unset($item);
                        }
                        
                        // Convert payment amount
                        if ($payment && isset($payment['amount']) && is_numeric($payment['amount'])) {
                            $payment['amount'] = round(convertPriceFromPhp((float)$payment['amount'], $currency), 2);
                            $payment['currency'] = $currency;
                        }
                    }
                }
                $order['payment'] = $payment;
                
                sendResponse($order, 'Order retrieved successfully');
            } else {
                // List orders with pagination and filters (filtered by branch_id)
                $page = max(1, intval($_GET['page'] ?? 1));
                $limit = min(100, max(1, intval($_GET['limit'] ?? 10)));
                $offset = ($page - 1) * $limit;
                
                $search = $_GET['search'] ?? '';
                $status = $_GET['status'] ?? 'all';
                $dateFrom = $_GET['date_from'] ?? '';
                $dateTo = $_GET['date_to'] ?? '';
                
                // Build query (always filter by branch_id)
                $whereConditions = ["o.branch_id = ?"];
                $params = [$branchId];
                
                if ($search) {
                    $whereConditions[] = "(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR o.order_id LIKE ?)";
                    $searchTerm = "%$search%";
                    $params = array_merge($params, [$searchTerm, $searchTerm, $searchTerm, $searchTerm]);
                }
                
                if ($status !== 'all') {
                    $whereConditions[] = "o.status = ?";
                    $params[] = $status;
                }
                
                if ($dateFrom) {
                    $whereConditions[] = "DATE(o.order_date) >= ?";
                    $params[] = $dateFrom;
                }
                
                if ($dateTo) {
                    $whereConditions[] = "DATE(o.order_date) <= ?";
                    $params[] = $dateTo;
                }
                
                $whereClause = 'WHERE ' . implode(' AND ', $whereConditions);
                
                // Get orders with user details
                $sql = "SELECT o.*, u.first_name, u.last_name, u.email,
                               COALESCE(SUM(oi.quantity), 0) as items_count
                        FROM orders o 
                        LEFT JOIN users u ON o.user_id = u.user_id 
                        LEFT JOIN order_items oi ON o.order_id = oi.order_id
                        $whereClause
                        GROUP BY o.order_id
                        ORDER BY o.order_date DESC 
                        LIMIT ? OFFSET ?";
                
                $params[] = $limit;
                $params[] = $offset;
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $orders = $stmt->fetchAll();
                
                // Convert amounts to requested currency
                if ($currency !== 'PHP') {
                    $rate = getExchangeRateFromAPI($currency);
                    if ($rate !== null && $rate > 0) {
                        // Get order currency snapshots for historical conversion
                        $orderIds = array_column($orders, 'order_id');
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
                        foreach ($orders as &$order) {
                            if (isset($order['total_amount']) && is_numeric($order['total_amount'])) {
                                $order['total_amount'] = round(convertPriceFromPhp((float)$order['total_amount'], $currency), 2);
                                $order['currency'] = $currency;
                            }
                        }
                        unset($order);
                    }
                }
                
                // Get total count
                $countSql = "SELECT COUNT(DISTINCT o.order_id) 
                            FROM orders o 
                            LEFT JOIN users u ON o.user_id = u.user_id 
                            $whereClause";
                $countStmt = $pdo->prepare($countSql);
                $countStmt->execute(array_slice($params, 0, -2)); // Remove limit and offset
                $total = $countStmt->fetchColumn();
                
                sendResponse([
                    'orders' => $orders,
                    'pagination' => [
                        'page' => $page,
                        'limit' => $limit,
                        'total' => $total,
                        'pages' => ceil($total / $limit)
                    ]
                ], 'Orders retrieved successfully');
            }
            break;
            
        case 'PUT':
            // Update order status with ACID transaction (restricted: cannot cancel, can only progress status)
            if (!$orderIdParam) {
                sendError('Order ID required', 400);
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
                sendError('Invalid JSON in request body', 400);
            }
            
            // ATOMICITY: Start transaction - all operations succeed or all fail
            $pdo->exec("START TRANSACTION");
            
            try {
                // ISOLATION: Row-level locking prevents concurrent order modifications
                // CONSISTENCY: Validate order exists and belongs to staff's branch
                // Check if order exists and belongs to staff's branch WITH ROW-LEVEL LOCKING
                $stmt = $pdo->prepare("SELECT order_id, status, branch_id FROM orders WHERE order_id = ? FOR UPDATE");
                $stmt->execute([$orderIdParam]);
                $order = $stmt->fetch();
                
                if (!$order) {
                    $pdo->exec("ROLLBACK");
                    sendError('Order not found', 404);
                }
                
                // CONSISTENCY: Verify order belongs to staff's branch
                // Verify order belongs to staff's branch
                if ($order['branch_id'] != $branchId) {
                    $pdo->exec("ROLLBACK");
                    sendError('Access denied. Order does not belong to your branch.', 403);
                }
                
                // CONSISTENCY: Validate status - staff can only progress status, not cancel
                // Validate status - staff can only progress status, not cancel
                $allowedStatuses = ['pending', 'processing', 'shipped', 'delivered'];
                if (isset($input['status'])) {
                    if (!in_array($input['status'], $allowedStatuses)) {
                        $pdo->exec("ROLLBACK");
                        sendError('Invalid order status. Staff can only update status to: pending, processing, shipped, or delivered.', 400);
                    }
                    
                    // Prevent status regression (can only move forward)
                    $statusOrder = ['pending' => 1, 'processing' => 2, 'shipped' => 3, 'delivered' => 4];
                    $currentStatusOrder = $statusOrder[$order['status']] ?? 0;
                    $newStatusOrder = $statusOrder[$input['status']] ?? 0;
                    
                    if ($newStatusOrder < $currentStatusOrder) {
                        $pdo->exec("ROLLBACK");
                        sendError('Cannot revert order status. You can only progress the order status forward.', 400);
                    }
                }
                
                // ATOMICITY: Order status UPDATE within transaction
                // Only allow status updates (no other fields)
                if (isset($input['status'])) {
                    $stmt = $pdo->prepare("UPDATE orders SET status = ? WHERE order_id = ? AND branch_id = ?");
                    $stmt->execute([$input['status'], $orderIdParam, $branchId]);
                    
                    // DURABILITY: COMMIT ensures all changes are permanently saved
                    $pdo->exec("COMMIT");
                    
                    // Get updated order
                    $stmt = $pdo->prepare("
                        SELECT o.*, u.first_name, u.last_name, u.email, u.phone
                        FROM orders o 
                        LEFT JOIN users u ON o.user_id = u.user_id 
                        WHERE o.order_id = ?
                    ");
                    $stmt->execute([$orderIdParam]);
                    $updatedOrder = $stmt->fetch();
                    
                    // Get order items
                    $stmt = $pdo->prepare("
                        SELECT oi.*, p.product_name, p.brand, p.model
                        FROM order_items oi
                        LEFT JOIN products p ON oi.product_id = p.product_id
                        WHERE oi.order_id = ?
                        ORDER BY oi.order_item_id ASC
                    ");
                    $stmt->execute([$orderIdParam]);
                    $updatedOrder['items'] = $stmt->fetchAll();
                    
                    // Get payment details if exists
                    $stmt = $pdo->prepare("
                        SELECT payment_id, payment_method, payment_status, amount, currency, transaction_id, payment_date
                        FROM payments 
                        WHERE order_id = ?
                    ");
                    $stmt->execute([$orderIdParam]);
                    $payment = $stmt->fetch();
                    
                    // Convert amounts to requested currency
                    if ($currency !== 'PHP') {
                        $rate = getExchangeRateFromAPI($currency);
                        if ($rate !== null && $rate > 0) {
                            // Convert order total
                            if (isset($updatedOrder['total_amount']) && is_numeric($updatedOrder['total_amount'])) {
                                $updatedOrder['total_amount'] = round(convertPriceFromPhp((float)$updatedOrder['total_amount'], $currency), 2);
                                $updatedOrder['currency'] = $currency;
                            }
                            
                            // Convert order items
                            if (isset($updatedOrder['items']) && is_array($updatedOrder['items'])) {
                                foreach ($updatedOrder['items'] as &$item) {
                                    if (isset($item['unit_price']) && is_numeric($item['unit_price'])) {
                                        $item['unit_price'] = round(convertPriceFromPhp((float)$item['unit_price'], $currency), 2);
                                    }
                                    if (isset($item['subtotal']) && is_numeric($item['subtotal'])) {
                                        $item['subtotal'] = round(convertPriceFromPhp((float)$item['subtotal'], $currency), 2);
                                    }
                                }
                                unset($item);
                            }
                            
                            // Convert payment amount
                            if ($payment && isset($payment['amount']) && is_numeric($payment['amount'])) {
                                $payment['amount'] = round(convertPriceFromPhp((float)$payment['amount'], $currency), 2);
                                $payment['currency'] = $currency;
                            }
                        }
                    }
                    $updatedOrder['payment'] = $payment;
                    
                    sendResponse($updatedOrder, 'Order status updated successfully');
                } else {
                    $pdo->exec("ROLLBACK");
                    sendError('No valid fields to update', 400);
                }
            } catch (Exception $e) {
                // ATOMICITY: Rollback ensures no partial state on error
                $pdo->exec("ROLLBACK");
                error_log('Order status update error: ' . $e->getMessage());
                sendError('Failed to update order status: ' . $e->getMessage(), 500);
            }
            break;
            
        default:
            sendError('Method not allowed', 405);
            break;
    }
} catch (PDOException $e) {
    sendError('Database error: ' . $e->getMessage(), 500);
}
?>

