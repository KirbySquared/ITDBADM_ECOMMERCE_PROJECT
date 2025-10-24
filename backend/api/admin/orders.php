<?php
/**
 * ORDERS CRUD API ENDPOINT
 * 
 * This endpoint handles all order management operations for admins.
 * 
 * ROUTES:
 * - GET /api/admin/orders - List all orders with pagination and filters
 * - GET /api/admin/orders/{id} - Get specific order details with items
 * - PUT /api/admin/orders/{id} - Update order status
 * - DELETE /api/admin/orders/{id} - Cancel order
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token
 * - Validates admin role
 * - Returns 403 if not admin
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
} catch (PDOException $e) {
    sendError('Database error', 500);
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
                // Get specific order with items and user details
                $stmt = $pdo->prepare("
                    SELECT o.*, u.first_name, u.last_name, u.email, u.phone
                    FROM orders o 
                    LEFT JOIN users u ON o.user_id = u.user_id 
                    WHERE o.order_id = ?
                ");
                $stmt->execute([$orderIdParam]);
                $order = $stmt->fetch();
                
                if (!$order) {
                    sendError('Order not found', 404);
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
            
            // Start transaction
            $pdo->beginTransaction();
            
            try {
                // Insert order
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
                
                // Insert order items
                $stmt = $pdo->prepare("
                    INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) 
                    VALUES (?, ?, ?, ?, ?)
                ");
                
                foreach ($input['items'] as $item) {
                    // Validate item data
                    if (!isset($item['product_id']) || !isset($item['quantity']) || !isset($item['unit_price'])) {
                        throw new Exception('Invalid item data');
                    }
                    
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
                
                $pdo->commit();
                
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
                $pdo->rollback();
                sendError('Failed to create order: ' . $e->getMessage(), 500);
            }
            break;
            
        case 'PUT':
            // Update order (including items)
            if (!$orderIdParam) {
                sendError('Order ID required', 400);
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Check if order exists
            $stmt = $pdo->prepare("SELECT order_id, status FROM orders WHERE order_id = ?");
            $stmt->execute([$orderIdParam]);
            $order = $stmt->fetch();
            
            if (!$order) {
                sendError('Order not found', 404);
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
                    $pdo->beginTransaction();
                    try {
                        // Delete order items
                        $stmt = $pdo->prepare("DELETE FROM order_items WHERE order_id = ?");
                        $stmt->execute([$orderIdParam]);
                        
                        // Delete order
                        $stmt = $pdo->prepare("DELETE FROM orders WHERE order_id = ?");
                        $stmt->execute([$orderIdParam]);
                        
                        $pdo->commit();
                        sendResponse(null, 'Order deleted successfully (no items remaining)');
                    } catch (Exception $e) {
                        $pdo->rollback();
                        sendError('Failed to delete order: ' . $e->getMessage(), 500);
                    }
                    break;
                }
                
                // Validate each item
                foreach ($input['items'] as $item) {
                    if (!isset($item['product_id']) || !isset($item['quantity']) || !isset($item['unit_price'])) {
                        sendError('Invalid item data', 400);
                    }
                    
                    // Check if product exists
                    $productStmt = $pdo->prepare("SELECT product_id, price, stock_quantity FROM products WHERE product_id = ?");
                    $productStmt->execute([$item['product_id']]);
                    $product = $productStmt->fetch();
                    
                    if (!$product) {
                        sendError('Product not found: ' . $item['product_id'], 400);
                    }
                }
            }
            
            // Start transaction for order update
            $pdo->beginTransaction();
            
            try {
                // Update order basic info
                $updateFields = [];
                $params = [];
                
                $allowedFields = ['status', 'shipping_address', 'currency'];
                foreach ($allowedFields as $field) {
                    if (isset($input[$field])) {
                        $updateFields[] = "$field = ?";
                        $params[] = $input[$field];
                    }
                }
                
                // Update total amount if items are provided
                if (isset($input['items'])) {
                    $totalAmount = 0;
                    foreach ($input['items'] as $item) {
                        $totalAmount += $item['unit_price'] * $item['quantity'];
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
                
                // Handle order items update
                if (isset($input['items'])) {
                    // Get current order items to check stock changes
                    $stmt = $pdo->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?");
                    $stmt->execute([$orderIdParam]);
                    $currentItems = $stmt->fetchAll();
                    
                    // Restore stock for current items
                    foreach ($currentItems as $currentItem) {
                        $stmt = $pdo->prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?");
                        $stmt->execute([$currentItem['quantity'], $currentItem['product_id']]);
                    }
                    
                    // Delete current order items
                    $stmt = $pdo->prepare("DELETE FROM order_items WHERE order_id = ?");
                    $stmt->execute([$orderIdParam]);
                    
                    // Insert new order items
                    $stmt = $pdo->prepare("
                        INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) 
                        VALUES (?, ?, ?, ?, ?)
                    ");
                    
                    foreach ($input['items'] as $item) {
                        $subtotal = $item['unit_price'] * $item['quantity'];
                        
                        $stmt->execute([
                            $orderIdParam,
                            $item['product_id'],
                            $item['quantity'],
                            $item['unit_price'],
                            $subtotal
                        ]);
                        
                        // Subtract stock if order is processing or beyond
                        if (isset($input['status']) && in_array($input['status'], ['processing', 'shipped', 'delivered'])) {
                            $stmt = $pdo->prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?");
                            $stmt->execute([$item['quantity'], $item['product_id']]);
                        }
                    }
                } else {
                    // Handle status change for existing items
                    if (isset($input['status'])) {
                        $oldStatus = $order['status'];
                        $newStatus = $input['status'];
                        
                        // If changing to processing from pending, subtract stock
                        if ($oldStatus === 'pending' && $newStatus === 'processing') {
                            $stmt = $pdo->prepare("
                                SELECT product_id, quantity FROM order_items WHERE order_id = ?
                            ");
                            $stmt->execute([$orderIdParam]);
                            $items = $stmt->fetchAll();
                            
                            foreach ($items as $item) {
                                $stmt = $pdo->prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?");
                                $stmt->execute([$item['quantity'], $item['product_id']]);
                            }
                        }
                        // If changing from processing back to pending, restore stock
                        elseif ($oldStatus === 'processing' && $newStatus === 'pending') {
                            $stmt = $pdo->prepare("
                                SELECT product_id, quantity FROM order_items WHERE order_id = ?
                            ");
                            $stmt->execute([$orderIdParam]);
                            $items = $stmt->fetchAll();
                            
                            foreach ($items as $item) {
                                $stmt = $pdo->prepare("UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?");
                                $stmt->execute([$item['quantity'], $item['product_id']]);
                            }
                        }
                    }
                }
                
                $pdo->commit();
                
                // Get updated order with user details
                $stmt = $pdo->prepare("
                    SELECT o.*, u.first_name, u.last_name, u.email, u.phone
                    FROM orders o 
                    LEFT JOIN users u ON o.user_id = u.user_id 
                    WHERE o.order_id = ?
                ");
                $stmt->execute([$orderIdParam]);
                $updatedOrder = $stmt->fetch();
                
                sendResponse($updatedOrder, 'Order updated successfully');
                
            } catch (Exception $e) {
                $pdo->rollback();
                sendError('Failed to update order: ' . $e->getMessage(), 500);
            }
            break;
            
        case 'DELETE':
            // Cancel order (soft delete by changing status)
            if (!$orderIdParam) {
                sendError('Order ID required', 400);
            }
            
            // Check if order exists
            $stmt = $pdo->prepare("SELECT order_id, status FROM orders WHERE order_id = ?");
            $stmt->execute([$orderIdParam]);
            $order = $stmt->fetch();
            
            if (!$order) {
                sendError('Order not found', 404);
            }
            
            // Check if order can be cancelled
            if (in_array($order['status'], ['delivered', 'cancelled'])) {
                sendError('Cannot cancel order with status: ' . $order['status'], 400);
            }
            
            // Update order status to cancelled
            $stmt = $pdo->prepare("UPDATE orders SET status = 'cancelled' WHERE order_id = ?");
            $stmt->execute([$orderIdParam]);
            
            sendResponse(null, 'Order cancelled successfully');
            break;
            
        default:
            sendError('Method not allowed', 405);
            break;
    }
} catch (PDOException $e) {
    sendError('Database error: ' . $e->getMessage(), 500);
}
?>
