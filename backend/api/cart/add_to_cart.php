<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

// Enable error logging
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Get authorization header
$headers = getallheaders();
$token = null;

if (isset($headers['Authorization'])) {
    $token = str_replace('Bearer ', '', $headers['Authorization']);
}

if (!$token) {
    error_log('Cart API: No authorization token provided');
    sendError('Authorization token required', 401);
}

// Validate token
$userId = validateToken($token);
if (!$userId) {
    error_log('Cart API: Invalid or expired token');
    sendError('Invalid or expired token', 401);
}

// Get request data
$input = json_decode(file_get_contents('php://input'), true);

if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('Cart API: JSON decode error - ' . json_last_error_msg());
    sendError('Invalid JSON in request body', 400);
}

// Validate required fields
$errors = validateRequired($input, ['product_id', 'quantity']);

if (!empty($errors)) {
    error_log('Cart API: Validation failed - ' . json_encode($errors));
    sendError('Validation failed', 400, $errors);
}

$productId = intval($input['product_id']);
$quantity = intval($input['quantity']);

if ($quantity <= 0) {
    error_log("Cart API: Invalid quantity - $quantity");
    sendError('Quantity must be greater than 0', 400);
}

try {
    // Get user's branch_id
    $stmt = $pdo->prepare("SELECT branch_id FROM users WHERE user_id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        error_log("Cart API: User not found - user_id: $userId");
        sendError('User not found', 404);
    }
    
    $userBranchId = $user['branch_id'] ?? null;
    
    // Check if product exists
    $stmt = $pdo->prepare("SELECT product_id, product_name FROM products WHERE product_id = ?");
    $stmt->execute([$productId]);
    $product = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$product) {
        error_log("Cart API: Product not found - product_id: $productId");
        sendError('Product not found', 404);
    }
    
    // Check stock from product_inventory (user's branch or all branches if no branch)
    if ($userBranchId) {
        // Check stock in user's branch
        $stmt = $pdo->prepare("
            SELECT stock_qty 
            FROM product_inventory 
            WHERE product_id = ? AND branch_id = ?
        ");
        $stmt->execute([$productId, $userBranchId]);
        $inventory = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$inventory) {
            error_log("Cart API: Product not available in user's branch - product_id: $productId, branch_id: $userBranchId");
            sendError('Product not available in your branch', 400);
        }
        
        $availableStock = (int)($inventory['stock_qty'] ?? 0);
    } else {
        // User has no branch - check total stock across all branches
        $stmt = $pdo->prepare("
            SELECT COALESCE(SUM(stock_qty), 0) AS total_stock 
            FROM product_inventory 
            WHERE product_id = ?
        ");
        $stmt->execute([$productId]);
        $inventory = $stmt->fetch(PDO::FETCH_ASSOC);
        $availableStock = (int)($inventory['total_stock'] ?? 0);
    }
    
    // Check if item already exists in cart
    $stmt = $pdo->prepare("SELECT cart_id, quantity FROM cart WHERE user_id = ? AND product_id = ?");
    $stmt->execute([$userId, $productId]);
    $existingItem = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $requestedQuantity = $quantity;
    if ($existingItem) {
        $requestedQuantity = (int)$existingItem['quantity'] + $quantity;
    }
    
    if ($requestedQuantity > $availableStock) {
        error_log("Cart API: Insufficient stock - product_id: $productId, requested: $requestedQuantity, available: $availableStock, branch_id: " . ($userBranchId ?? 'null'));
        sendError("Insufficient stock. Available: $availableStock, Requested: $requestedQuantity", 400);
    }
    
    // Add or update cart item
    if ($existingItem) {
        // Update existing item
        $newQuantity = (int)$existingItem['quantity'] + $quantity;
        $stmt = $pdo->prepare("UPDATE cart SET quantity = ?, added_at = NOW() WHERE cart_id = ?");
        $stmt->execute([$newQuantity, $existingItem['cart_id']]);
        error_log("Cart API: Updated cart item - cart_id: {$existingItem['cart_id']}, new_quantity: $newQuantity");
    } else {
        // Add new item
        $stmt = $pdo->prepare("INSERT INTO cart (user_id, product_id, quantity, added_at) VALUES (?, ?, ?, NOW())");
        $stmt->execute([$userId, $productId, $quantity]);
        error_log("Cart API: Added new cart item - user_id: $userId, product_id: $productId, quantity: $quantity");
    }
    
    sendResponse(null, 'Item added to cart successfully');
    
} catch (PDOException $e) {
    error_log('Cart API: PDOException - ' . $e->getMessage());
    error_log('Cart API: SQL State - ' . $e->getCode());
    error_log('Cart API: Stack trace - ' . $e->getTraceAsString());
    sendError('Failed to add item to cart: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    error_log('Cart API: Exception - ' . $e->getMessage());
    error_log('Cart API: Stack trace - ' . $e->getTraceAsString());
    sendError('Failed to add item to cart: ' . $e->getMessage(), 500);
}
?>
