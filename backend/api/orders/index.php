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
require_once __DIR__ . '/../../utils/currency_api.php';
require_once __DIR__ . '/../../utils/input_validator.php';
require_once __DIR__ . '/../../utils/stored_procedure_helper.php';

header('Content-Type: application/json');

// Get authorization header (case-insensitive check like other endpoints)
$headers = function_exists('getallheaders') ? getallheaders() : [];
$token = null;

// Case-insensitive header check
foreach ($headers as $k => $v) {
    if (strtolower($k) === 'authorization') {
        $token = preg_replace('/^Bearer\s+/i', '', $v);
        break;
    }
}

// Fallback: check $_SERVER if getallheaders() didn't work
if (!$token && isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $token = preg_replace('/^Bearer\s+/i', '', $_SERVER['HTTP_AUTHORIZATION']);
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
        $orderId = validateInteger($pathParts[$i + 1], 1);
        if ($orderId === false) {
            sendError('Invalid order ID', 400);
        }
        break;
    }
}

try {
    if ($orderId) {
        // Get requested currency (default to PHP)
        $requestedCurrency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';
        
        // Validate currency code
        $validCurrencies = ['USD', 'PHP', 'KRW', 'JPY', 'EUR', 'GBP', 'CAD', 'AUD'];
        if (!in_array($requestedCurrency, $validCurrencies)) {
            sendError('Invalid currency code', 400);
        }
        
        if (!isValidCurrencyCode($requestedCurrency)) {
            sendError('Invalid currency code', 400);
        }
        
        // Get exchange rate from API
        $rateToPhp = getExchangeRateFromAPI($requestedCurrency);
        if ($rateToPhp === null) {
            sendError('Failed to fetch exchange rate for ' . $requestedCurrency, 500);
        }
        
        // Get specific order details - ensure it belongs to the user
        $stmt = $pdo->prepare("
            SELECT o.*, u.first_name, u.last_name, u.email, u.phone, ocs.rate_to_php as order_rate_to_php
            FROM orders o 
            LEFT JOIN users u ON o.user_id = u.user_id 
            LEFT JOIN order_currency_snapshots ocs ON o.order_id = ocs.order_id
            WHERE o.order_id = ? AND o.user_id = ?
        ");
        $stmt->execute([$orderId, $userId]);
        $order = $stmt->fetch();
        
        if (!$order) {
            sendError('Order not found or access denied', 404);
        }
        
        // Get order items with product details, images, and review status
        // This connects: Cart → Order → Review (showing if user reviewed each product)
        $stmt = $pdo->prepare("
            SELECT 
                oi.*, 
                p.product_id,
                p.product_name, 
                p.brand, 
                p.model,
                (SELECT image_url FROM product_images WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) as product_image,
                -- Check if user has reviewed this product (connects order → review)
                CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM reviews r 
                        WHERE r.product_id = p.product_id 
                        AND r.user_id = ?
                    ) THEN 1
                    ELSE 0
                END AS has_reviewed,
                -- Get review details if exists
                (SELECT r.review_id FROM reviews r 
                 WHERE r.product_id = p.product_id AND r.user_id = ? 
                 LIMIT 1) AS review_id,
                (SELECT r.rating FROM reviews r 
                 WHERE r.product_id = p.product_id AND r.user_id = ? 
                 LIMIT 1) AS review_rating
            FROM order_items oi 
            LEFT JOIN products p ON oi.product_id = p.product_id 
            WHERE oi.order_id = ?
            ORDER BY oi.order_item_id ASC
        ");
        $stmt->execute([$userId, $userId, $userId, $orderId]);
        $items = $stmt->fetchAll();
        
        // Convert order items to requested currency
        $orderCurrency = $order['currency'] ?? 'PHP';
        $orderRateToPhp = isset($order['order_rate_to_php']) && $order['order_rate_to_php'] > 0 
            ? (float)$order['order_rate_to_php'] 
            : ($orderCurrency === 'PHP' ? 1.0 : getExchangeRateFromAPI($orderCurrency));
        
        foreach ($items as &$item) {
            // Convert unit_price and subtotal from order's original currency to requested currency
            $unitPriceInPhp = $orderCurrency === 'PHP' ? (float)$item['unit_price'] : ((float)$item['unit_price'] / $orderRateToPhp);
            $subtotalInPhp = $orderCurrency === 'PHP' ? (float)$item['subtotal'] : ((float)$item['subtotal'] / $orderRateToPhp);
            
            $item['unit_price'] = $requestedCurrency === 'PHP' ? $unitPriceInPhp : ($unitPriceInPhp * $rateToPhp);
            $item['subtotal'] = $requestedCurrency === 'PHP' ? $subtotalInPhp : ($subtotalInPhp * $rateToPhp);
        }
        unset($item);
        $order['items'] = $items;
        
        // Convert order total_amount
        $totalInPhp = $orderCurrency === 'PHP' ? (float)$order['total_amount'] : ((float)$order['total_amount'] / $orderRateToPhp);
        $order['total_amount'] = $requestedCurrency === 'PHP' ? $totalInPhp : ($totalInPhp * $rateToPhp);
        $order['currency'] = $requestedCurrency;
        
        // Get payment details if exists
        $stmt = $pdo->prepare("
            SELECT payment_id, payment_method, payment_status, amount, currency, transaction_id, payment_date
            FROM payments 
            WHERE order_id = ?
        ");
        $stmt->execute([$orderId]);
        $payment = $stmt->fetch();
        
        // Convert payment amount
        if ($payment) {
            $paymentCurrency = $payment['currency'] ?? $orderCurrency;
            $paymentRateToPhp = $paymentCurrency === 'PHP' ? 1.0 : getExchangeRateFromAPI($paymentCurrency);
            $paymentInPhp = $paymentCurrency === 'PHP' ? (float)$payment['amount'] : ((float)$payment['amount'] / $paymentRateToPhp);
            $payment['amount'] = $requestedCurrency === 'PHP' ? $paymentInPhp : ($paymentInPhp * $rateToPhp);
            $payment['currency'] = $requestedCurrency;
        }
        $order['payment'] = $payment;
        
        sendResponse($order, 'Order retrieved successfully');
    } else {
        // List all orders for the user
        // Validate page (1-1000)
        $page = validateInteger($_GET['page'] ?? 1, 1, 1000);
        if ($page === false) {
            sendError('Invalid page number (must be 1-1000)', 400);
        }
        
        // Validate limit (1-50)
        $limit = validateInteger($_GET['limit'] ?? 20, 1, 50);
        if ($limit === false) {
            sendError('Invalid limit (must be 1-50)', 400);
        }
        
        $offset = ($page - 1) * $limit;
        
        // Get requested currency (default to PHP)
        $requestedCurrency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';
        
        // Validate currency code
        $validCurrencies = ['USD', 'PHP', 'KRW', 'JPY', 'EUR', 'GBP', 'CAD', 'AUD'];
        if (!in_array($requestedCurrency, $validCurrencies)) {
            sendError('Invalid currency code', 400);
        }
        
        if (!isValidCurrencyCode($requestedCurrency)) {
            sendError('Invalid currency code', 400);
        }
        
        // Get exchange rate from API
        $rateToPhp = getExchangeRateFromAPI($requestedCurrency);
        if ($rateToPhp === null) {
            sendError('Failed to fetch exchange rate for ' . $requestedCurrency, 500);
        }
        
        // Get orders with payment status and currency snapshot
        $stmt = $pdo->prepare("
            SELECT o.*, 
                   p.payment_method, p.payment_status, p.amount as payment_amount, p.currency as payment_currency,
                   ocs.rate_to_php as order_rate_to_php,
                   COUNT(oi.order_item_id) as items_count
            FROM orders o
            LEFT JOIN payments p ON o.order_id = p.order_id
            LEFT JOIN order_items oi ON o.order_id = oi.order_id
            LEFT JOIN order_currency_snapshots ocs ON o.order_id = ocs.order_id
            WHERE o.user_id = ?
            GROUP BY o.order_id
            ORDER BY o.order_date DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([$userId, $limit, $offset]);
        $orders = $stmt->fetchAll();
        
        // Convert order amounts to requested currency
        foreach ($orders as &$order) {
            $orderCurrency = $order['currency'] ?? 'PHP';
            $orderTotalAmount = (float)$order['total_amount'];
            $orderPaymentAmount = isset($order['payment_amount']) ? (float)$order['payment_amount'] : null;
            
            // Convert from order's original currency to PHP first
            // If order has a currency snapshot, use that rate; otherwise assume it's PHP
            $orderRateToPhp = isset($order['order_rate_to_php']) && $order['order_rate_to_php'] > 0 
                ? (float)$order['order_rate_to_php'] 
                : ($orderCurrency === 'PHP' ? 1.0 : getExchangeRateFromAPI($orderCurrency));
            
            // Convert order total from original currency to PHP
            $totalInPhp = $orderCurrency === 'PHP' ? $orderTotalAmount : ($orderTotalAmount / $orderRateToPhp);
            
            // Convert from PHP to requested currency
            $convertedTotal = $requestedCurrency === 'PHP' ? $totalInPhp : ($totalInPhp * $rateToPhp);
            $order['total_amount'] = round($convertedTotal, 2);
            $order['currency'] = $requestedCurrency;
            
            // Convert payment amount if exists
            if ($orderPaymentAmount !== null) {
                $paymentCurrency = $order['payment_currency'] ?? $orderCurrency;
                $paymentRateToPhp = $paymentCurrency === 'PHP' ? 1.0 : getExchangeRateFromAPI($paymentCurrency);
                $paymentInPhp = $paymentCurrency === 'PHP' ? $orderPaymentAmount : ($orderPaymentAmount / $paymentRateToPhp);
                $convertedPayment = $requestedCurrency === 'PHP' ? $paymentInPhp : ($paymentInPhp * $rateToPhp);
                $order['payment_amount'] = round($convertedPayment, 2);
            }
        }
        unset($order); // Break reference
        
        // Get total count
        $countStmt = $pdo->prepare("
            SELECT COUNT(*) 
            FROM orders 
            WHERE user_id = ?
        ");
        $countStmt->execute([$userId]);
        $total = $countStmt->fetchColumn();
        
        // Check if purchase history is requested
        if (isset($_GET['purchase_history']) && $_GET['purchase_history'] === '1') {
            // Get purchase history using stored procedure
            $startDate = $_GET['start_date'] ?? date('Y-m-d', strtotime('-365 days'));
            $endDate = $_GET['end_date'] ?? date('Y-m-d');
            
            // Validate dates
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
                sendError('Invalid date format. Use YYYY-MM-DD', 400);
            }
            
            try {
                $history = callStoredProcedure($pdo, 'sp_get_customer_purchase_history', [
                    $userId,
                    $startDate,
                    $endDate
                ]);
                
                sendResponse([
                    'purchase_history' => $history,
                    'date_range' => [
                        'start_date' => $startDate,
                        'end_date' => $endDate
                    ]
                ], 'Purchase history retrieved successfully');
            } catch (PDOException $e) {
                error_log('Purchase history error: ' . $e->getMessage());
                sendError('Failed to retrieve purchase history: ' . $e->getMessage(), 500);
            }
        } else {
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
    }
    
} catch (PDOException $e) {
    error_log('Database error in orders endpoint: ' . $e->getMessage());
    sendError('Failed to retrieve order', 500);
} catch (Exception $e) {
    error_log('Error in orders endpoint: ' . $e->getMessage());
    sendError('Failed to retrieve order', 500);
}
?>

