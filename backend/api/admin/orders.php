<?php
/**
 * ORDERS CRUD API ENDPOINT
 * 
 * This endpoint handles all order management operations for admins.
 * 
 * ROUTES:
 * - GET /api/admin/orders - List all orders with pagination and filters
 * - GET /api/admin/orders/{id} - Get specific order details with items
 * - POST /api/admin/orders - Create new order
 * - PUT /api/admin/orders/{id} - Update order (including items)
 * - DELETE /api/admin/orders/{id} - Cancel order
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token
 * - Validates admin role
 * - Returns 403 if not admin
 * 
 * ACID COMPLIANCE ANALYSIS:
 * 
 * POST (Create Order):
 *   ATOMICITY: GOOD - Uses transaction wrapper
 *   CONSISTENCY: GOOD - Validates user, items, calculates totals
 *   ISOLATION: GOOD - Transaction isolates changes until COMMIT
 *   DURABILITY: GOOD - COMMIT ensures persistence
 * 
 * PUT (Update Order):
 *   ATOMICITY: GOOD - Uses transaction with FOR UPDATE locking
 *   CONSISTENCY: GOOD - Validates order exists, enforces business rules
 *   ISOLATION: GOOD - FOR UPDATE prevents concurrent modifications
 *   DURABILITY: GOOD - COMMIT ensures persistence
 * 
 * DELETE (Cancel Order):
 *   ATOMICITY: GOOD - Uses transaction with stock restoration
 *   CONSISTENCY: GOOD - Restores stock if payment was completed
 *   ISOLATION: GOOD - FOR UPDATE prevents concurrent modifications
 *   DURABILITY: GOOD - COMMIT ensures permanent cancellation
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/currency_api.php';
require_once __DIR__ . '/../../utils/audit_helper.php';
require_once __DIR__ . '/../../utils/stored_procedure_helper.php';
require_once __DIR__ . '/../../utils/permissions.php';

// Get HTTP method and route
$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['PATH_INFO'] ?? '';

// Determine required permission based on method
$permissionMap = [
    'GET' => 'orders.view',
    'POST' => 'orders.create',
    'PUT' => 'orders.update',
    'DELETE' => 'orders.cancel'
];

$requiredPermission = $permissionMap[$method] ?? 'orders.view';

// Enhanced authentication with permission checking
$userId = requireAdminAuthWithPermission($requiredPermission);

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
    // Get currency parameter (default PHP)
    $currency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';
    if (!isValidCurrencyCode($currency)) {
        $currency = 'PHP';
    }
    
    switch ($method) {
        case 'GET':
            if ($orderIdParam) {
                // Get specific order with items and user details
                $stmt = $pdo->prepare("
                    SELECT 
                        o.*, 
                        u.first_name, 
                        u.last_name, 
                        u.email, 
                        u.phone,
                        COALESCE(ocs.rate_to_php, 1.0) as order_rate_to_php
                    FROM orders o 
                    LEFT JOIN users u ON o.user_id = u.user_id 
                    LEFT JOIN order_currency_snapshots ocs ON o.order_id = ocs.order_id
                    WHERE o.order_id = ?
                ");
                $stmt->execute([$orderIdParam]);
                $order = $stmt->fetch();
                
                if (!$order) {
                    sendError('Order not found', 404);
                }
                
                // Convert order total_amount to requested currency
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
                $order['total_amount'] = convertPriceFromPhp($amountInPhp, $currency);
                $order['currency'] = $currency;
                
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
                $items = $stmt->fetchAll();
                
                // Convert item prices to requested currency
                // Items store prices in order currency, need to convert
                foreach ($items as &$item) {
                    $itemPriceInPhp = $item['unit_price'];
                    $itemSubtotalInPhp = $item['subtotal'];
                    
                    // Convert from order currency to PHP first (if different)
                    if ($orderCurrency !== 'PHP') {
                        if ($order['order_rate_to_php'] && $order['order_rate_to_php'] > 0) {
                            // Use historical rate from snapshot if available
                            $itemPriceInPhp = $item['unit_price'] / $order['order_rate_to_php'];
                            $itemSubtotalInPhp = $item['subtotal'] / $order['order_rate_to_php'];
                        } else {
                            // No snapshot, use current rate (fallback)
                            $currentRate = getExchangeRateFromAPI($orderCurrency);
                            if ($currentRate && $currentRate > 0) {
                                $itemPriceInPhp = $item['unit_price'] / $currentRate;
                                $itemSubtotalInPhp = $item['subtotal'] / $currentRate;
                            }
                            // If rate is null or 0, assume prices are already in PHP
                        }
                    }
                    // Convert to requested currency
                    $item['unit_price'] = convertPriceFromPhp($itemPriceInPhp, $currency);
                    $item['subtotal'] = convertPriceFromPhp($itemSubtotalInPhp, $currency);
                }
                unset($item);
                
                $order['items'] = $items;
                
                // Get payment details if exists
                $stmt = $pdo->prepare("
                    SELECT payment_method, payment_status, amount, currency, transaction_id, payment_date
                    FROM payments 
                    WHERE order_id = ?
                ");
                $stmt->execute([$orderIdParam]);
                $payment = $stmt->fetch();
                
                // Convert payment amount if exists
                if ($payment) {
                    $paymentAmountInPhp = $payment['amount'];
                    $paymentCurrency = $payment['currency'] ?? $orderCurrency;
                    
                    // Convert from payment currency to PHP first (if different)
                    if ($paymentCurrency !== 'PHP') {
                        if ($order['order_rate_to_php'] && $order['order_rate_to_php'] > 0) {
                            // Use historical rate from snapshot if available
                            $paymentAmountInPhp = $payment['amount'] / $order['order_rate_to_php'];
                        } else {
                            // No snapshot, use current rate (fallback)
                            $currentRate = getExchangeRateFromAPI($paymentCurrency);
                            if ($currentRate && $currentRate > 0) {
                                $paymentAmountInPhp = $payment['amount'] / $currentRate;
                            }
                            // If rate is null or 0, assume amount is already in PHP
                        }
                    }
                    $payment['amount'] = convertPriceFromPhp($paymentAmountInPhp, $currency);
                    $payment['currency'] = $currency;
                }
                
                $order['payment'] = $payment;
                
                sendResponse($order, 'Order retrieved successfully');
            } else {
                // List orders with pagination and filters
                $page = max(1, intval($_GET['page'] ?? 1));
                $limit = min(100, max(1, intval($_GET['limit'] ?? 10)));
                $offset = ($page - 1) * $limit;
                
                $search = $_GET['search'] ?? '';
                $status = $_GET['status'] ?? 'all';
                $dateFrom = $_GET['date_from'] ?? '';
                $dateTo = $_GET['date_to'] ?? '';
                
                // Build query
                $whereConditions = [];
                $params = [];
                
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
                
                $whereClause = $whereConditions ? 'WHERE ' . implode(' AND ', $whereConditions) : '';
                
                // Get orders with user details and currency snapshots
                $sql = "SELECT 
                            o.*, 
                            u.first_name, 
                            u.last_name, 
                            u.email,
                            COALESCE(SUM(oi.quantity), 0) as items_count,
                            COALESCE(ocs.rate_to_php, 1.0) as order_rate_to_php
                        FROM orders o 
                        LEFT JOIN users u ON o.user_id = u.user_id 
                        LEFT JOIN order_items oi ON o.order_id = oi.order_id
                        LEFT JOIN order_currency_snapshots ocs ON o.order_id = ocs.order_id
                        $whereClause
                        GROUP BY o.order_id, ocs.rate_to_php
                        ORDER BY o.order_date DESC 
                        LIMIT ? OFFSET ?";
                
                $params[] = $limit;
                $params[] = $offset;
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $orders = $stmt->fetchAll();
                
                // Convert each order's total_amount to requested currency
                foreach ($orders as &$order) {
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
            
        case 'POST':
            // Create new order
            $input = json_decode(file_get_contents('php://input'), true);
            
            $errors = validateRequired($input, ['user_id', 'total_amount', 'shipping_address', 'items']);
            if (!empty($errors)) {
                sendError('Validation failed', 400, $errors);
            }
            
            // Validate total amount
            if (!is_numeric($input['total_amount']) || $input['total_amount'] < 0) {
                sendError('Total amount must be a positive number', 400);
            }
            
            // Validate currency
            $allowedCurrencies = ['USD', 'PHP', 'KRW', 'JPY', 'EUR', 'GBP', 'CAD', 'AUD'];
            if (isset($input['currency']) && !in_array($input['currency'], $allowedCurrencies)) {
                sendError('Invalid currency', 400);
            }
            
            // Validate order items
            if (!is_array($input['items']) || empty($input['items'])) {
                sendError('Order must contain at least one item', 400);
            }
            
            // Check if user exists
            $stmt = $pdo->prepare("SELECT user_id FROM users WHERE user_id = ?");
            $stmt->execute([$input['user_id']]);
            if (!$stmt->fetch()) {
                sendError('User not found', 404);
            }
            
            // Validate status if provided
            $allowedStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
            if (isset($input['status']) && !in_array($input['status'], $allowedStatuses)) {
                sendError('Invalid order status', 400);
            }
            
            // ATOMICITY: Start transaction - all operations succeed or all fail
            // This ensures proper ACID compliance:
            // - ATOMICITY: All operations succeed or all fail
            // - CONSISTENCY: Database constraints and business rules are maintained
            // - ISOLATION: Changes are isolated until COMMIT
            // - DURABILITY: Once COMMIT, changes are permanent
            $pdo->exec("START TRANSACTION");
            
            // Set audit user ID for triggers (for transaction logging)
            setAuditUserId($pdo, $userId);
            
            try {
                // ATOMICITY: Order creation within transaction
                // CONSISTENCY: Validates user exists before creating order
                // Insert order
                // NOTE: Triggers will automatically update total_amount when order_items are inserted
                $stmt = $pdo->prepare("
                    INSERT INTO orders (user_id, total_amount, currency, status, shipping_address) 
                    VALUES (?, ?, ?, ?, ?)
                ");
                
                $stmt->execute([
                    $input['user_id'],
                    $input['total_amount'],
                    $input['currency'] ?? 'USD',
                    $input['status'] ?? 'pending',
                    $input['shipping_address']
                ]);
                
                $newOrderId = $pdo->lastInsertId();
                
                // ATOMICITY: Order items creation within same transaction
                // CONSISTENCY: Validates each product exists before creating order item
                // Insert order items
                // NOTE: Triggers will automatically:
                // 1. Calculate subtotal if NULL (trg_order_items_calculate_subtotal)
                // 2. Update order total_amount (trg_order_items_update_order_total_insert)
                $stmt = $pdo->prepare("
                    INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) 
                    VALUES (?, ?, ?, ?, ?)
                ");
                
                foreach ($input['items'] as $item) {
                    // CONSISTENCY: Validate item data
                    // Validate item data
                    if (!isset($item['product_id']) || !isset($item['quantity']) || !isset($item['unit_price'])) {
                        throw new Exception('Invalid item data');
                    }
                    
                    // CONSISTENCY: Validate product exists
                    // Check if product exists
                    $productStmt = $pdo->prepare("SELECT product_id, price FROM products WHERE product_id = ?");
                    $productStmt->execute([$item['product_id']]);
                    $product = $productStmt->fetch();
                    
                    if (!$product) {
                        throw new Exception('Product not found: ' . $item['product_id']);
                    }
                    
                    $subtotal = $item['unit_price'] * $item['quantity'];
                    
                    $stmt->execute([
                        $newOrderId,
                        $item['product_id'],
                        $item['quantity'],
                        $item['unit_price'],
                        $subtotal
                    ]);
                }
                
                // DURABILITY: COMMIT ensures all changes are permanently saved
                // Commit transaction - all changes are now permanent
                $pdo->exec("COMMIT");
                clearAuditUserId($pdo); // Clear audit user ID after transaction
                
                // Get created order with user details
                $stmt = $pdo->prepare("
                    SELECT o.*, u.first_name, u.last_name, u.email, u.phone
                    FROM orders o 
                    LEFT JOIN users u ON o.user_id = u.user_id 
                    WHERE o.order_id = ?
                ");
                $stmt->execute([$newOrderId]);
                $newOrder = $stmt->fetch();
                
                sendResponse($newOrder, 'Order created successfully', 201);
                
            } catch (Exception $e) {
                // Rollback on error - all changes are discarded
                $pdo->exec("ROLLBACK");
                clearAuditUserId($pdo); // Clear audit user ID on error
                sendError('Failed to create order: ' . $e->getMessage(), 500);
            }
            break;
            
        case 'PUT':
            // Update order (including items)
            if (!$orderIdParam) {
                sendError('Order ID required', 400);
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
                sendError('Invalid JSON in request body', 400);
            }
            
            // Validate status
            $allowedStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
            if (isset($input['status']) && !in_array($input['status'], $allowedStatuses)) {
                sendError('Invalid order status', 400);
            }
            
            // Validate currency if provided
            $allowedCurrencies = ['USD', 'PHP', 'KRW', 'JPY', 'EUR', 'GBP', 'CAD', 'AUD'];
            if (isset($input['currency']) && !in_array($input['currency'], $allowedCurrencies)) {
                sendError('Invalid currency', 400);
            }
            
            // Validate order items if provided
            if (isset($input['items'])) {
                if (!is_array($input['items']) || empty($input['items'])) {
                    // If no items, delete the order
                    // ATOMICITY: Order and order_items deletion happen atomically
                    // CONSISTENCY: Deletes order_items first, then order (respects foreign keys)
                    // ISOLATION: FOR UPDATE prevents concurrent modifications
                    // DURABILITY: COMMIT ensures permanent deletion
                    // Start ACID transaction with explicit MySQL statements
                    $pdo->exec("START TRANSACTION");
                    try {
                        // ISOLATION: Row-level locking prevents concurrent order modifications
                        // CONSISTENCY: Validate order exists
                        // Check if order exists WITH LOCK
                        $checkStmt = $pdo->prepare("SELECT order_id FROM orders WHERE order_id = ? FOR UPDATE");
                        $checkStmt->execute([$orderIdParam]);
                        if (!$checkStmt->fetch()) {
                            $pdo->exec("ROLLBACK");
                            sendError('Order not found', 404);
                        }
                        
                        // ATOMICITY: Order items deletion within transaction
                        // CONSISTENCY: Delete order_items first (child records)
                        // Delete order items
                        $stmt = $pdo->prepare("DELETE FROM order_items WHERE order_id = ?");
                        $stmt->execute([$orderIdParam]);
                        
                        // ATOMICITY: Order deletion within same transaction
                        // Delete order
                        $stmt = $pdo->prepare("DELETE FROM orders WHERE order_id = ?");
                        $stmt->execute([$orderIdParam]);
                        
                        // DURABILITY: COMMIT ensures all changes are permanently saved
                        // Commit transaction - all deletions are now permanent
                        $pdo->exec("COMMIT");
                        sendResponse(null, 'Order deleted successfully (no items remaining)');
                    } catch (Exception $e) {
                        // ATOMICITY: Rollback ensures no partial state on error
                        $pdo->exec("ROLLBACK");
                        error_log('Order deletion error: ' . $e->getMessage());
                        sendError('Failed to delete order: ' . $e->getMessage(), 500);
                    }
                    break;
                }
                
                // Validate each item
                foreach ($input['items'] as $item) {
                    if (!isset($item['product_id']) || !isset($item['quantity']) || !isset($item['unit_price'])) {
                        sendError('Invalid item data. Each item must have product_id, quantity, and unit_price', 400);
                    }
                    
                    // Check if product exists
                    $productStmt = $pdo->prepare("SELECT product_id, price FROM products WHERE product_id = ?");
                    $productStmt->execute([$item['product_id']]);
                    $product = $productStmt->fetch();
                    
                    if (!$product) {
                        sendError('Product not found: ' . $item['product_id'], 400);
                    }
                    
                    // Validate quantity and price
                    if (!is_numeric($item['quantity']) || $item['quantity'] <= 0) {
                        sendError('Invalid quantity for product: ' . $item['product_id'], 400);
                    }
                    
                    if (!is_numeric($item['unit_price']) || $item['unit_price'] < 0) {
                        sendError('Invalid unit price for product: ' . $item['product_id'], 400);
                    }
                }
            }
            
            // ATOMICITY: Start transaction - all operations succeed or all fail
            // This ensures proper ACID compliance:
            // - ATOMICITY: All operations succeed or all fail
            // - CONSISTENCY: Database constraints and business rules are maintained
            // - ISOLATION: Changes are isolated until COMMIT
            // - DURABILITY: Once COMMIT, changes are permanent
            $pdo->exec("START TRANSACTION");
            
            // Set audit user ID for triggers (for transaction logging)
            setAuditUserId($pdo, $userId);
            
            try {
                // ISOLATION: Row-level locking prevents concurrent order modifications
                // CONSISTENCY: Validate order exists
                // Check if order exists WITH ROW-LEVEL LOCKING
                // FOR UPDATE prevents race conditions when deleting/updating order items
                $stmt = $pdo->prepare("SELECT order_id, status, user_id FROM orders WHERE order_id = ? FOR UPDATE");
                $stmt->execute([$orderIdParam]);
                $order = $stmt->fetch();
                
                if (!$order) {
                    $pdo->exec("ROLLBACK");
                    clearAuditUserId($pdo);
                    sendError('Order not found', 404);
                }
                
                // ATOMICITY: Order update within transaction
                // CONSISTENCY: Validates allowed fields before update
                // Update order basic info
                // If status is being updated, use stored procedure for validation
                if (isset($input['status'])) {
                    // If setting to 'processing', ensure payment is completed first
                    if ($input['status'] === 'processing') {
                        $stmt = $pdo->prepare("SELECT payment_status FROM payments WHERE order_id = ?");
                        $stmt->execute([$orderIdParam]);
                        $payment = $stmt->fetch();
                        
                        if ($payment && $payment['payment_status'] !== 'completed') {
                            // Admin is approving order - auto-complete the payment
                            $stmt = $pdo->prepare("
                                UPDATE payments 
                                SET payment_status = 'completed', payment_date = NOW()
                                WHERE order_id = ?
                            ");
                            $stmt->execute([$orderIdParam]);
                            error_log("Admin auto-completed payment for order $orderIdParam");
                        }
                    }
                    
                    try {
                        // Use stored procedure to update order status with validation
                        $message = callStoredProcedureMessage($pdo, 'sp_update_order_status', [
                            $orderIdParam,
                            $input['status'],
                            $userId
                        ]);
                        // Status updated successfully via stored procedure
                        // Remove status from updateFields since it's already handled
                        unset($input['status']);
                    } catch (PDOException $e) {
                        $pdo->exec("ROLLBACK");
                        clearAuditUserId($pdo);
                        error_log('Order status update error: ' . $e->getMessage());
                        $errorMsg = $e->getMessage();
                        if (strpos($errorMsg, 'SQLSTATE[45000]') !== false) {
                            preg_match('/SQLSTATE\[45000\]:\s*(.+)/', $errorMsg, $matches);
                            $errorMsg = $matches[1] ?? 'Failed to update order status';
                        }
                        sendError($errorMsg, 500);
                    }
                }
                
                // NOTE: If status changes, trigger trg_orders_log_status_change will log it
                $updateFields = [];
                $params = [];
                
                $allowedFields = ['shipping_address', 'currency'];
                foreach ($allowedFields as $field) {
                    if (isset($input[$field])) {
                        $updateFields[] = "$field = ?";
                        $params[] = $input[$field];
                    }
                }
                
                // NOTE: If items are updated, triggers will automatically recalculate total_amount
                // We can still set it manually here, but triggers will ensure it matches sum of order_items
                if (isset($input['items'])) {
                    $totalAmount = 0;
                    foreach ($input['items'] as $item) {
                        $totalAmount += (float)$item['unit_price'] * (int)$item['quantity'];
                    }
                    $updateFields[] = "total_amount = ?";
                    $params[] = $totalAmount;
                }
                
                if (!empty($updateFields)) {
                    $params[] = $orderIdParam;
                    $sql = "UPDATE orders SET " . implode(', ', $updateFields) . " WHERE order_id = ?";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                }
                
                // ATOMICITY: Order items update within same transaction
                // CONSISTENCY: Deletes old items, then inserts new items (maintains referential integrity)
                // Handle order items update
                // NOTE: Triggers will automatically:
                // 1. Calculate subtotal if NULL (trg_order_items_calculate_subtotal)
                // 2. Update order total_amount when items are deleted/inserted (trg_order_items_update_order_total_*)
                if (isset($input['items'])) {
                    // ATOMICITY: Order items deletion within transaction
                    // Delete current order items (order is already locked above)
                    // NOTE: Trigger trg_order_items_update_order_total_delete will update order total
                    $stmt = $pdo->prepare("DELETE FROM order_items WHERE order_id = ?");
                    $stmt->execute([$orderIdParam]);
                    
                    // ATOMICITY: Order items insertion within same transaction
                    // Insert new order items
                    // NOTE: Triggers will automatically calculate subtotal and update order total
                    $stmt = $pdo->prepare("
                        INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) 
                        VALUES (?, ?, ?, ?, ?)
                    ");
                    
                    foreach ($input['items'] as $item) {
                        $subtotal = (float)$item['unit_price'] * (int)$item['quantity'];
                        
                        $stmt->execute([
                            $orderIdParam,
                            (int)$item['product_id'],
                            (int)$item['quantity'],
                            (float)$item['unit_price'],
                            $subtotal
                        ]);
                    }
                }
                
                // Note: Stock management is handled by the payment trigger when payment_status changes to 'completed'
                // Admin order editing does not automatically manage stock since:
                // 1. Stock is managed per branch in product_inventory table
                // 2. Orders don't store branch_id directly
                // 3. Stock should be managed through inventory management or payment completion
                
                // Commit transaction - all changes are now permanent
                $pdo->exec("COMMIT");
                clearAuditUserId($pdo); // Clear audit user ID after transaction
                
                // Get updated order with user details
                $stmt = $pdo->prepare("
                    SELECT o.*, u.first_name, u.last_name, u.email, u.phone
                    FROM orders o 
                    LEFT JOIN users u ON o.user_id = u.user_id 
                    WHERE o.order_id = ?
                ");
                $stmt->execute([$orderIdParam]);
                $updatedOrder = $stmt->fetch();
                
                if (!$updatedOrder) {
                    throw new Exception('Failed to retrieve updated order');
                }
                
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
                $updatedOrder['payment'] = $payment;
                
                sendResponse($updatedOrder, 'Order updated successfully');
                
            } catch (Exception $e) {
                // Rollback on error - all changes are discarded
                $pdo->exec("ROLLBACK");
                error_log('Order update error: ' . $e->getMessage());
                error_log('Stack trace: ' . $e->getTraceAsString());
                sendError('Failed to update order: ' . $e->getMessage(), 500);
            }
            break;
            
        case 'DELETE':
            // Cancel order with ACID transaction and stock restoration
            // ATOMICITY: Order cancellation, stock restoration, and payment update happen atomically
            // CONSISTENCY: Restores stock if payment was completed, maintains business rules
            // ISOLATION: FOR UPDATE prevents concurrent order modifications
            // DURABILITY: COMMIT ensures permanent cancellation
            if (!$orderIdParam) {
                sendError('Order ID required', 400);
            }
            
            // Cancel order using stored procedure
            // The stored procedure handles: validation, stock restoration, status update, and payment refund
            try {
                // Use stored procedure to cancel order
                // sp_cancel_order handles all validation, stock restoration, and status updates
                $message = callStoredProcedureMessage($pdo, 'sp_cancel_order', [
                    $orderIdParam,
                    $userId
                ]);
                
                sendResponse(null, $message ?? 'Order cancelled successfully');
            } catch (PDOException $e) {
                error_log('Order cancellation error: ' . $e->getMessage());
                // Extract error message from SQLSTATE
                $errorMsg = $e->getMessage();
                if (strpos($errorMsg, 'SQLSTATE[45000]') !== false) {
                    // Custom error from stored procedure
                    preg_match('/SQLSTATE\[45000\]:\s*(.+)/', $errorMsg, $matches);
                    $errorMsg = $matches[1] ?? 'Failed to cancel order';
                }
                sendError($errorMsg, 500);
            }
            break;
            
        default:
            // Check for order item management endpoints
            // POST /api/admin/orders/{id}/items - Add product to order
            // PUT /api/admin/orders/{id}/items/{item_id} - Update order item quantity
            
            $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
            $path = str_replace('/api/admin/orders', '', $path);
            $path = ltrim($path, '/');
            $pathParts = explode('/', $path);
            
            // POST /api/admin/orders/{id}/items - Add product to order
            if (count($pathParts) === 2 && $pathParts[1] === 'items' && $method === 'POST' && $orderIdParam) {
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!isset($input['product_id']) || !is_numeric($input['product_id'])) {
                    sendError('Product ID is required', 400);
                }
                if (!isset($input['quantity']) || !is_numeric($input['quantity']) || $input['quantity'] <= 0) {
                    sendError('Quantity must be greater than zero', 400);
                }
                if (!isset($input['unit_price']) || !is_numeric($input['unit_price']) || $input['unit_price'] < 0) {
                    sendError('Unit price is required and must be non-negative', 400);
                }
                
                $productId = (int)$input['product_id'];
                $quantity = (int)$input['quantity'];
                $unitPrice = (float)$input['unit_price'];
                
                try {
                    $message = callStoredProcedureMessage($pdo, 'sp_add_product_to_order', [
                        $orderIdParam,
                        $productId,
                        $quantity,
                        $unitPrice,
                        $userId
                    ]);
                    sendResponse(['message' => $message], 'Product added to order successfully');
                } catch (PDOException $e) {
                    error_log('Add product to order error: ' . $e->getMessage());
                    $errorMsg = $e->getMessage();
                    if (strpos($errorMsg, 'SQLSTATE[45000]') !== false) {
                        preg_match('/SQLSTATE\[45000\]:\s*(.+)/', $errorMsg, $matches);
                        $errorMsg = $matches[1] ?? 'Failed to add product to order';
                    }
                    sendError($errorMsg, 500);
                }
                break;
            }
            
            // PUT /api/admin/orders/{id}/items/{item_id} - Update order item quantity
            if (count($pathParts) === 3 && $pathParts[1] === 'items' && is_numeric($pathParts[2]) && $method === 'PUT' && $orderIdParam) {
                $orderItemId = (int)$pathParts[2];
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!isset($input['quantity']) || !is_numeric($input['quantity']) || $input['quantity'] <= 0) {
                    sendError('Quantity must be greater than zero', 400);
                }
                
                $quantity = (int)$input['quantity'];
                
                try {
                    $message = callStoredProcedureMessage($pdo, 'sp_update_order_item_quantity', [
                        $orderItemId,
                        $quantity,
                        $userId
                    ]);
                    sendResponse(['message' => $message], 'Order item quantity updated successfully');
                } catch (PDOException $e) {
                    error_log('Update order item quantity error: ' . $e->getMessage());
                    $errorMsg = $e->getMessage();
                    if (strpos($errorMsg, 'SQLSTATE[45000]') !== false) {
                        preg_match('/SQLSTATE\[45000\]:\s*(.+)/', $errorMsg, $matches);
                        $errorMsg = $matches[1] ?? 'Failed to update order item quantity';
                    }
                    sendError($errorMsg, 500);
                }
                break;
            }
            
            sendError('Method not allowed', 405);
            break;
    }
} catch (PDOException $e) {
    sendError('Database error: ' . $e->getMessage(), 500);
}
?>
