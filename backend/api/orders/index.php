<?php
/**
 * USER ORDERS API ENDPOINT
 * 
 * This endpoint allows users to view their own orders.
 * 
 * ROUTES:
 * - GET /api/orders - List all orders for the authenticated user
 * - GET /api/orders/{id} - Get specific order details (user's own orders only)
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token
 * - Users can only view their own orders
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

header('Content-Type: application/json');

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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed', 405);
}

// Get order ID from path
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$pathParts = explode('/', trim($path, '/'));
$orderId = null;

// Find order ID in path (e.g., /api/orders/123)
foreach ($pathParts as $i => $part) {
    if ($part === 'orders' && isset($pathParts[$i + 1]) && is_numeric($pathParts[$i + 1])) {
        $orderId = intval($pathParts[$i + 1]);
        break;
    }
}

try {
    if ($orderId) {
        // Get specific order details - ensure it belongs to the user
        $stmt = $pdo->prepare("
            SELECT o.*, u.first_name, u.last_name, u.email, u.phone
            FROM orders o 
            LEFT JOIN users u ON o.user_id = u.user_id 
            WHERE o.order_id = ? AND o.user_id = ?
        ");
        $stmt->execute([$orderId, $userId]);
        $order = $stmt->fetch();
        
        if (!$order) {
            sendError('Order not found or access denied', 404);
        }
        
        // Get order items with product details and images
        $stmt = $pdo->prepare("
            SELECT oi.*, p.product_name, p.brand, p.model,
                   (SELECT image_url FROM product_images WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) as product_image
            FROM order_items oi 
            LEFT JOIN products p ON oi.product_id = p.product_id 
            WHERE oi.order_id = ?
            ORDER BY oi.order_item_id ASC
        ");
        $stmt->execute([$orderId]);
        $order['items'] = $stmt->fetchAll();
        
        // Get payment details if exists
        $stmt = $pdo->prepare("
            SELECT payment_id, payment_method, payment_status, amount, currency, transaction_id, payment_date
            FROM payments 
            WHERE order_id = ?
        ");
        $stmt->execute([$orderId]);
        $payment = $stmt->fetch();
        $order['payment'] = $payment;
        
        sendResponse($order, 'Order retrieved successfully');
    } else {
        // List all orders for the user
        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = min(50, max(1, intval($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        
        // Get orders with payment status
        $stmt = $pdo->prepare("
            SELECT o.*, 
                   p.payment_method, p.payment_status, p.amount as payment_amount,
                   COUNT(oi.order_item_id) as items_count
            FROM orders o
            LEFT JOIN payments p ON o.order_id = p.order_id
            LEFT JOIN order_items oi ON o.order_id = oi.order_id
            WHERE o.user_id = ?
            GROUP BY o.order_id
            ORDER BY o.order_date DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([$userId, $limit, $offset]);
        $orders = $stmt->fetchAll();
        
        // Get total count
        $countStmt = $pdo->prepare("
            SELECT COUNT(*) 
            FROM orders 
            WHERE user_id = ?
        ");
        $countStmt->execute([$userId]);
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
    
} catch (PDOException $e) {
    error_log('Database error in orders endpoint: ' . $e->getMessage());
    sendError('Failed to retrieve order', 500);
} catch (Exception $e) {
    error_log('Error in orders endpoint: ' . $e->getMessage());
    sendError('Failed to retrieve order', 500);
}
?>

