<?php
require_once '../../config/database.php';
require_once '../../utils/response.php';

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
        SELECT ci.*, p.name, p.price, p.image_url 
        FROM cart_items ci 
        JOIN products p ON ci.product_id = p.id 
        WHERE ci.user_id = ?
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
