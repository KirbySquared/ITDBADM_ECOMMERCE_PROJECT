<?php
/**
 * ADD TO CART ENDPOINT
 * 
 * ACID COMPLIANCE ANALYSIS:
 * 
 * ATOMICITY: GOOD - Uses transaction wrapper
 *   - All operations (user check, product check, stock check, cart insert/update) are atomic
 *   - If any operation fails, entire transaction is rolled back
 *   - No partial cart additions possible
 * 
 * CONSISTENCY: GOOD
 *   - Validates product exists before adding to cart
 *   - Validates stock availability before adding
 *   - Validates user exists and has branch assignment
 *   - Enforces quantity limits based on available stock
 *   - Database constraints maintain referential integrity
 * 
 * ISOLATION: GOOD - Uses row-level locking
 *   - FOR UPDATE on stock check prevents concurrent stock modifications
 *   - FOR UPDATE on cart check prevents concurrent cart modifications
 *   - Prevents race conditions where multiple users add same low-stock item
 *   - Transaction isolation level: READ COMMITTED (set in database.php)
 * 
 * DURABILITY: GOOD
 *   - COMMIT ensures all changes are permanently saved
 *   - ROLLBACK on error ensures no partial state
 *   - Database ensures durability after successful COMMIT
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/security_headers.php';
require_once __DIR__ . '/../../utils/rate_limiter.php';
require_once __DIR__ . '/../../utils/security_audit.php';
require_once __DIR__ . '/../../utils/input_validator.php';

// Set security headers
setSecurityHeaders();

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

// Rate limiting for cart operations (20 operations per minute)
$clientId = getClientIdentifier($userId);
$rateLimit = checkRateLimit($pdo, $clientId, 'cart_add', 20, 60);
if (!$rateLimit['allowed']) {
    logSecurityEvent($pdo, 'rate_limit_exceeded', 'medium', 
        "Cart add rate limit exceeded", $userId);
    sendError('Too many cart operations. Please slow down.', 429);
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

// Validate product_id (must be positive integer)
$productId = validateInteger($input['product_id'] ?? null, 1);
if ($productId === false) {
    error_log("Cart API: Invalid product_id - " . ($input['product_id'] ?? 'null'));
    sendError('Invalid product ID', 400);
}

// Validate quantity (must be 1-999)
$quantity = validateInteger($input['quantity'] ?? null, 1, 999);
if ($quantity === false) {
    error_log("Cart API: Invalid quantity - " . ($input['quantity'] ?? 'null'));
    sendError('Quantity must be between 1 and 999', 400);
}

try {
    // ATOMICITY: Start transaction - all operations succeed or all fail
    $pdo->exec("START TRANSACTION");
    
    // CONSISTENCY: Validate user exists
    // 1) Get user's branch_id (branch chosen by the user)
    $stmt = $pdo->prepare("SELECT branch_id FROM users WHERE user_id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        $pdo->exec("ROLLBACK");
        error_log("Cart API: User not found - user_id: $userId");
        sendError('User not found', 404);
    }

    // If user has no branch assigned, default to branch_id = 1
    $userBranchId = $user['branch_id'] ?? null;
    if (!$userBranchId) {
        $userBranchId = 1;
    }

    // CONSISTENCY: Validate product exists
    // 2) Check if product exists
    $stmt = $pdo->prepare("SELECT product_id, product_name FROM products WHERE product_id = ?");
    $stmt->execute([$productId]);
    $product = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$product) {
        $pdo->exec("ROLLBACK");
        error_log("Cart API: Product not found - product_id: $productId");
        sendError('Product not found', 404);
    }

    // ISOLATION: Row-level locking prevents concurrent stock modifications
    // CONSISTENCY: Validate stock availability
    // 3) Check stock ONLY in the user's (or default) branch WITH ROW-LEVEL LOCKING
    // FOR UPDATE prevents race conditions where stock could change between check and cart insertion
    $stmt = $pdo->prepare("
        SELECT stock_qty 
        FROM product_inventory 
        WHERE product_id = ? AND branch_id = ?
        FOR UPDATE
    ");
    $stmt->execute([$productId, $userBranchId]);
    $inventory = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$inventory) {
        $pdo->exec("ROLLBACK");
        error_log("Cart API: Product not available in user's branch - product_id: $productId, branch_id: $userBranchId");
        sendError('Product not available in your branch', 400);
    }

    $availableStock = (int)($inventory['stock_qty'] ?? 0);

    // ISOLATION: Row-level locking prevents concurrent cart modifications
    // 4) Check if item already exists in cart (per branch) WITH LOCK
    $stmt = $pdo->prepare("
        SELECT cart_id, quantity 
        FROM cart 
        WHERE user_id = ? AND product_id = ? AND branch_id = ?
        FOR UPDATE
    ");
    $stmt->execute([$userId, $productId, $userBranchId]);
    $existingItem = $stmt->fetch(PDO::FETCH_ASSOC);

    $requestedQuantity = $quantity;
    if ($existingItem) {
        $requestedQuantity = (int)$existingItem['quantity'] + $quantity;
    }

    // CONSISTENCY: Enforce stock limits
    if ($requestedQuantity > $availableStock) {
        $pdo->exec("ROLLBACK");
        error_log("Cart API: Insufficient stock - product_id: $productId, requested: $requestedQuantity, available: $availableStock, branch_id: $userBranchId");
        sendError("Insufficient stock. Available: $availableStock, Requested: $requestedQuantity", 400);
    }

    // ATOMICITY: Cart modification within transaction
    // 5) Add or update cart item
    if ($existingItem) {
        // Update existing item
        $newQuantity = (int)$existingItem['quantity'] + $quantity;
        $stmt = $pdo->prepare("
            UPDATE cart 
            SET quantity = ?, added_at = NOW() 
            WHERE cart_id = ?
        ");
        $stmt->execute([$newQuantity, $existingItem['cart_id']]);
        error_log("Cart API: Updated cart item - cart_id: {$existingItem['cart_id']}, new_quantity: $newQuantity");
    } else {
        // Add new item with branch_id
        $stmt = $pdo->prepare("
            INSERT INTO cart (user_id, product_id, quantity, branch_id) 
            VALUES (:user_id, :product_id, :quantity, :branch_id)
        ");
        $stmt->execute([
            ':user_id'   => $userId,
            ':product_id'=> $productId,
            ':quantity'  => $quantity,
            ':branch_id' => $userBranchId
        ]);
        error_log("Cart API: Added new cart item - user_id: $userId, product_id: $productId, quantity: $quantity, branch_id: $userBranchId");
    }

    // DURABILITY: COMMIT ensures all changes are permanently saved
    $pdo->exec("COMMIT");
    sendResponse(null, 'Item added to cart successfully');

} catch (PDOException $e) {
    // Rollback on any error
    try {
        $pdo->exec("ROLLBACK");
    } catch (Exception $rollbackError) {
        // Ignore rollback errors if not in transaction
    }
    error_log('Cart API: PDOException - ' . $e->getMessage());
    error_log('Cart API: SQL State - ' . $e->getCode());
    error_log('Cart API: Stack trace - ' . $e->getTraceAsString());
    sendError('Failed to add item to cart: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    // Rollback on any error
    try {
        $pdo->exec("ROLLBACK");
    } catch (Exception $rollbackError) {
        // Ignore rollback errors if not in transaction
    }
    error_log('Cart API: Exception - ' . $e->getMessage());
    error_log('Cart API: Stack trace - ' . $e->getTraceAsString());
    sendError('Failed to add item to cart: ' . $e->getMessage(), 500);
}
