<?php
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

try {
    $stmt = $pdo->prepare("
        SELECT c.*, p.product_name, p.price, p.currency,
               (SELECT image_url FROM product_images WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) as image_url
        FROM cart c 
        JOIN products p ON c.product_id = p.product_id 
        WHERE c.user_id = ?
        ORDER BY c.added_at DESC
    ");
    
    $stmt->execute([$userId]);
    $cartItems = $stmt->fetchAll();
    
    // Calculate total
    $total = 0;
    foreach ($cartItems as $item) {
        $total += $item['price'] * $item['quantity'];
    }
    
    sendResponse([
        'items' => $cartItems,
        'total' => $total
    ], 'Cart retrieved successfully');
    
} catch (PDOException $e) {
    sendError('Failed to retrieve cart', 500);
}
?>
