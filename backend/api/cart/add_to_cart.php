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

// Get request data
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$errors = validateRequired($input, ['product_id', 'quantity']);

if (!empty($errors)) {
    sendError('Validation failed', 400, $errors);
}

$productId = intval($input['product_id']);
$quantity = intval($input['quantity']);

if ($quantity <= 0) {
    sendError('Quantity must be greater than 0', 400);
}

try {
    // Check if product exists and has stock
    $stmt = $pdo->prepare("SELECT stock_quantity FROM products WHERE product_id = ?");
    $stmt->execute([$productId]);
    $product = $stmt->fetch();
    
    if (!$product) {
        sendError('Product not found', 404);
    }
    
    if ($product['stock_quantity'] < $quantity) {
        sendError('Insufficient stock', 400);
    }
    
    // Check if item already exists in cart
    $stmt = $pdo->prepare("SELECT cart_id, quantity FROM cart WHERE user_id = ? AND product_id = ?");
    $stmt->execute([$userId, $productId]);
    $existingItem = $stmt->fetch();
    
    if ($existingItem) {
        // Update existing item
        $newQuantity = $existingItem['quantity'] + $quantity;
        $stmt = $pdo->prepare("UPDATE cart SET quantity = ? WHERE cart_id = ?");
        $stmt->execute([$newQuantity, $existingItem['cart_id']]);
    } else {
        // Add new item
        $stmt = $pdo->prepare("INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)");
        $stmt->execute([$userId, $productId, $quantity]);
    }
    
    sendResponse(null, 'Item added to cart successfully');
    
} catch (PDOException $e) {
    sendError('Failed to add item to cart', 500);
}
?>
