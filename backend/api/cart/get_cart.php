<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

header('Content-Type: application/json');

// Get authorization header (case-insensitive)
$headers = function_exists('getallheaders') ? getallheaders() : [];
$token = null;

// Case-insensitive header check
foreach ($headers as $k => $v) {
    if (strtolower($k) === 'authorization') {
        $token = preg_replace('/^Bearer\s+/i', '', $v);
        break;
    }
}
if (!$token) {
    sendError('Authorization token required', 401);
}

// Validate token -> $userId
$userId = validateToken($token);
if (!$userId) {
    sendError('Invalid or expired token', 401);
}

// Get user's branch_id
$stmt = $pdo->prepare("SELECT branch_id FROM users WHERE user_id = ?");
$stmt->execute([$userId]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);
$userBranchId = $user['branch_id'] ?? null;

// Read requested currency (default PHP)
$currency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';

try {
    // Get currency rate for conversion
    $cur = $pdo->prepare("SELECT code, rate_to_php FROM currencies WHERE code=? AND is_active=1 LIMIT 1");
    $cur->execute([$currency]);
    $row = $cur->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        sendError('Invalid or inactive currency', 400);
    }
    $rate = (float)$row['rate_to_php'];
    
    $base = 'price';
    $rateSql = ($currency === 'PHP') ? "p.$base" : "ROUND(p.$base * $rate, 2)";
    $stockSql = ($userBranchId)
        ? "(SELECT COALESCE(pi.stock_qty,0) FROM product_inventory pi WHERE pi.branch_id=? AND pi.product_id=p.product_id)"
        : "(SELECT COALESCE(SUM(pi.stock_qty),0) FROM product_inventory pi WHERE pi.product_id=p.product_id)";
    
    // Filter cart items by user's branch_id and include all product details
    if ($userBranchId) {
        $sql = "
            SELECT
                cart.cart_id,
                cart.product_id,
                cart.quantity,
                cart.added_at,
                p.product_name,
                p.brand,
                p.model,
                p.price                                        AS price,
                ? AS currency,
                $rateSql                                        AS display_price,
                (cart.quantity * $rateSql)                      AS line_total_display,
                $stockSql                                       AS stock_quantity,
                cat.category_name,
                (SELECT image_url 
                   FROM product_images 
                  WHERE product_id = p.product_id AND is_primary = TRUE 
                  ORDER BY sort_order, created_at LIMIT 1) AS primary_image_url
            FROM cart
            JOIN products p ON p.product_id = cart.product_id
            LEFT JOIN categories cat ON cat.category_id = p.category_id
            WHERE cart.user_id = ? AND cart.branch_id = ?
            ORDER BY cart.added_at DESC
        ";
    } else {
        // User has no branch - show items with branch_id = 0 or NULL
        $sql = "
            SELECT
                cart.cart_id,
                cart.product_id,
                cart.quantity,
                cart.added_at,
                p.product_name,
                p.brand,
                p.model,
                p.price                                        AS price,
                ? AS currency,
                $rateSql                                        AS display_price,
                (cart.quantity * $rateSql)                      AS line_total_display,
                $stockSql                                       AS stock_quantity,
                cat.category_name,
                (SELECT image_url 
                   FROM product_images 
                  WHERE product_id = p.product_id AND is_primary = TRUE 
                  ORDER BY sort_order, created_at LIMIT 1) AS primary_image_url
            FROM cart
            JOIN products p ON p.product_id = cart.product_id
            LEFT JOIN categories cat ON cat.category_id = p.category_id
            WHERE cart.user_id = ? AND (cart.branch_id IS NULL OR cart.branch_id = 0)
            ORDER BY cart.added_at DESC
        ";
    }

    $stmt = $pdo->prepare($sql);
    // Parameters: currency, then branch_id for stock (if branch filtering), then user_id, then branch_id for WHERE clause (if branch filtering)
    $params = [$currency];
    if ($userBranchId) {
        $params[] = $userBranchId; // For stock calculation
    }
    $params[] = (int)$userId;
    if ($userBranchId) {
        $params[] = (int)$userBranchId; // For WHERE clause
    }
    $stmt->execute($params);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Compute total in selected currency
    $total = 0.0;
    foreach ($items as $it) {
        $total += (float)$it['line_total_display'];
    }

    sendResponse([
        'currency' => $currency,
        'items'    => $items,
        'total'    => round($total, 2)
    ], 'Cart retrieved successfully');

} catch (PDOException $e) {
    // Optionally log $e->getMessage()
    sendError('Failed to retrieve cart', 500);
}
