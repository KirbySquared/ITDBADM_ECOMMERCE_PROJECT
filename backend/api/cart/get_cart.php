<?php
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

// Validate token -> $userId
$userId = validateToken($token);
if (!$userId) {
    sendError('Invalid or expired token', 401);
}

// Read requested currency (default PHP)
$currency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';

try {
    // Validate currency is active
    $check = $pdo->prepare("SELECT code FROM currencies WHERE code = ? AND is_active = 1");
    $check->execute([$currency]);
    if (!$check->fetch()) {
        sendError('Invalid or inactive currency', 400);
    }

    // NOTE: If your base price column is 'price_php', change p.price -> p.price_php below.
    // We avoid p.currency entirely and compute conversion on read.
    $sql = "
        SELECT
            c.cart_id,
            c.product_id,
            c.quantity,
            c.added_at,
            p.product_name,
            p.price                                        AS unit_price_php,
            fx_convert_php(p.price, :cur1)                 AS unit_price_display,
            (c.quantity * fx_convert_php(p.price, :cur2))  AS line_total_display,
            (SELECT image_url 
               FROM product_images 
              WHERE product_id = p.product_id AND is_primary = TRUE 
              LIMIT 1) AS image_url
        FROM cart c
        JOIN products p ON p.product_id = c.product_id
        WHERE c.user_id = :uid
        ORDER BY c.added_at DESC
    ";

    $stmt = $pdo->prepare($sql);
    // use two distinct placeholders for the same value
    $stmt->bindValue(':cur1', $currency, PDO::PARAM_STR);
    $stmt->bindValue(':cur2', $currency, PDO::PARAM_STR);
    $stmt->bindValue(':uid', (int)$userId, PDO::PARAM_INT);
    $stmt->execute();
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
