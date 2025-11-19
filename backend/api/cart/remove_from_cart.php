<?php
/**
 * REMOVE FROM CART ENDPOINT
 * 
 * ACID COMPLIANCE ANALYSIS:
 * 
 * ATOMICITY: GOOD - Uses transaction wrapper
 *   - All operations (cart check, cart deletion) are atomic
 *   - If any operation fails, entire transaction is rolled back
 *   - No partial cart deletions possible
 * 
 * CONSISTENCY: GOOD
 *   - Validates cart item exists and belongs to user
 *   - Database constraints maintain referential integrity
 *   - Ensures user can only delete their own cart items
 * 
 * ISOLATION: GOOD - Uses row-level locking
 *   - FOR UPDATE on cart check prevents concurrent cart modifications
 *   - Prevents race conditions where cart item is modified during deletion
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
$errors = validateRequired($input, ['cart_id']);

if (!empty($errors)) {
    sendError('Validation failed', 400, $errors);
}

$cartId = intval($input['cart_id']);

try {
    // ATOMICITY: Start transaction - all operations succeed or all fail
    $pdo->exec("START TRANSACTION");
    
    // ISOLATION: Row-level locking prevents concurrent cart modifications
    // CONSISTENCY: Validate cart item exists and belongs to user
    // Check if cart item exists and belongs to user WITH ROW-LEVEL LOCKING
    $stmt = $pdo->prepare("SELECT cart_id FROM cart WHERE cart_id = ? AND user_id = ? FOR UPDATE");
    $stmt->execute([$cartId, $userId]);
    $cartItem = $stmt->fetch();
    
    if (!$cartItem) {
        $pdo->exec("ROLLBACK");
        sendError('Cart item not found', 404);
    }
    
    // ATOMICITY: Cart deletion within transaction
    // Delete cart item
    $stmt = $pdo->prepare("DELETE FROM cart WHERE cart_id = ? AND user_id = ?");
    $stmt->execute([$cartId, $userId]);
    
    // DURABILITY: COMMIT ensures all changes are permanently saved
    $pdo->exec("COMMIT");
    sendResponse(null, 'Item removed from cart successfully');
    
} catch (Exception $e) {
    // Rollback on any error
    try {
        $pdo->exec("ROLLBACK");
    } catch (Exception $rollbackError) {
        // Ignore rollback errors if not in transaction
    }
    error_log('Cart removal error: ' . $e->getMessage());
    sendError('Failed to remove item from cart', 500);
}
?>

