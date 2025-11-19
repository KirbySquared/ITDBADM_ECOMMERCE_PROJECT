<?php
/**
 * UPDATE CART ENDPOINT
 * 
 * ACID COMPLIANCE ANALYSIS:
 * 
 * ATOMICITY: GOOD - Uses transaction wrapper
 *   - All operations (cart check, stock validation, cart update) are atomic
 *   - If any operation fails, entire transaction is rolled back
 *   - No partial cart updates possible
 * 
 * CONSISTENCY: GOOD
 *   - Validates cart item exists and belongs to user
 *   - Validates stock availability before updating quantity
 *   - Enforces quantity limits based on available stock
 *   - Database constraints maintain referential integrity
 * 
 * ISOLATION: GOOD - Uses row-level locking
 *   - FOR UPDATE on cart check prevents concurrent cart modifications
 *   - FOR UPDATE on stock check prevents concurrent stock modifications
 *   - Prevents race conditions where stock changes during update
 *   - Transaction isolation level: READ COMMITTED (set in database.php)
 * 
 * DURABILITY: GOOD
 *   - COMMIT ensures all changes are permanently saved
 *   - ROLLBACK on error ensures no partial state
 *   - Database ensures durability after successful COMMIT
 */
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
$errors = validateRequired($input, ['cart_id', 'quantity']);

if (!empty($errors)) {
    sendError('Validation failed', 400, $errors);
}

$cartId = intval($input['cart_id']);
$quantity = intval($input['quantity']);

if ($quantity <= 0) {
    sendError('Quantity must be greater than 0', 400);
}

try {
    // ATOMICITY: Start transaction - all operations succeed or all fail
    $pdo->exec("START TRANSACTION");
    
    // ISOLATION: Row-level locking prevents concurrent cart modifications
    // CONSISTENCY: Validate cart item exists and belongs to user
    // Check if cart item exists and belongs to user WITH ROW-LEVEL LOCKING
    $stmt = $pdo->prepare("
        SELECT c.cart_id, c.product_id, c.branch_id, c.quantity 
        FROM cart c 
        WHERE c.cart_id = ? AND c.user_id = ? 
        FOR UPDATE
    ");
    $stmt->execute([$cartId, $userId]);
    $cartItem = $stmt->fetch();
    
    if (!$cartItem) {
        $pdo->exec("ROLLBACK");
        sendError('Cart item not found', 404);
    }
    
    // ISOLATION: Row-level locking prevents concurrent stock modifications
    // CONSISTENCY: Validate stock availability before updating quantity
    $stockStmt = $pdo->prepare("
        SELECT stock_qty 
        FROM product_inventory 
        WHERE product_id = ? AND branch_id = ?
        FOR UPDATE
    ");
    $stockStmt->execute([$cartItem['product_id'], $cartItem['branch_id']]);
    $inventory = $stockStmt->fetch();
    
    if (!$inventory) {
        $pdo->exec("ROLLBACK");
        sendError('Product not available in your branch', 400);
    }
    
    $availableStock = (int)($inventory['stock_qty'] ?? 0);
    
    // CONSISTENCY: Enforce stock limits
    if ($quantity > $availableStock) {
        $pdo->exec("ROLLBACK");
        sendError("Insufficient stock. Available: $availableStock, Requested: $quantity", 400);
    }
    
    // ATOMICITY: Cart update within transaction
    // Update quantity
    $stmt = $pdo->prepare("UPDATE cart SET quantity = ? WHERE cart_id = ? AND user_id = ?");
    $stmt->execute([$quantity, $cartId, $userId]);
    
    // DURABILITY: COMMIT ensures all changes are permanently saved
    $pdo->exec("COMMIT");
    sendResponse(null, 'Cart updated successfully');
    
} catch (Exception $e) {
    // Rollback on any error
    try {
        $pdo->exec("ROLLBACK");
    } catch (Exception $rollbackError) {
        // Ignore rollback errors if not in transaction
    }
    error_log('Cart update error: ' . $e->getMessage());
    sendError('Failed to update cart: ' . $e->getMessage(), 500);
}
?>

