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

// Get request data
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$errors = validateRequired($input, ['cart_id']);

if (!empty($errors)) {
    sendError('Validation failed', 400, $errors);
}

$cartId = intval($input['cart_id']);

try {
    // Check if cart item exists and belongs to user
    $stmt = $pdo->prepare("SELECT cart_id FROM cart WHERE cart_id = ? AND user_id = ?");
    $stmt->execute([$cartId, $userId]);
    $cartItem = $stmt->fetch();
    
    if (!$cartItem) {
        sendError('Cart item not found', 404);
    }
    
    // Delete cart item
    $stmt = $pdo->prepare("DELETE FROM cart WHERE cart_id = ? AND user_id = ?");
    $stmt->execute([$cartId, $userId]);
    
    sendResponse(null, 'Item removed from cart successfully');
    
} catch (PDOException $e) {
    sendError('Failed to remove item from cart', 500);
}
?>

