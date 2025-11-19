<?php
/**
 * USER PROFILE UPDATE ENDPOINT
 * 
 * This endpoint allows authenticated users to update their own profile.
 * 
 * ROUTE: /api/auth/profile
 * METHOD: PUT
 * HEADERS: { "Authorization": "Bearer <jwt_token>" }
 * 
 * REQUEST BODY:
 * {
 *   "username": "john_doe",
 *   "email": "john@example.com",
 *   "first_name": "John",
 *   "last_name": "Doe",
 *   "phone": "123-456-7890",
 *   "address": "123 Main St",
 *   "password": "newpassword123" // optional
 * }
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token
 * - Users can only update their own profile
 * 
 * ACID COMPLIANCE ANALYSIS:
 * 
 * ATOMICITY: GOOD - Uses transaction wrapper
 *   - Profile update and password update are atomic
 *   - If any operation fails, entire transaction is rolled back
 *   - No partial profile updates possible
 * 
 * CONSISTENCY: GOOD
 *   - Validates username/email uniqueness (excluding current user) before UPDATE (with row-level locking)
 *   - Validates branch_id exists before UPDATE
 *   - Validates email format
 *   - Database constraints maintain referential integrity
 * 
 * ISOLATION: GOOD - Uses row-level locking
 *   - FOR UPDATE on user row and uniqueness checks prevents race conditions
 *   - Prevents concurrent updates to same username/email
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

// ATOMICITY: Start transaction - all operations succeed or all fail
$pdo->exec("START TRANSACTION");

try {
    // ISOLATION: Row-level locking prevents concurrent profile modifications
    // CONSISTENCY: Validate user exists with row-level locking
    // Get current user data WITH ROW-LEVEL LOCKING
    $stmt = $pdo->prepare("
        SELECT u.user_id, u.username, u.email, u.first_name, u.last_name, u.phone, u.address, u.role, u.branch_id,
               b.branch_name
        FROM users u
        LEFT JOIN branches b ON u.branch_id = b.branch_id
        WHERE u.user_id = ?
        FOR UPDATE
    ");
    $stmt->execute([$userId]);
    $currentUser = $stmt->fetch();
    
    if (!$currentUser) {
        $pdo->exec("ROLLBACK");
        sendError('User not found', 404);
    }
    
    // Validate required fields
    $errors = validateRequired($input, ['username', 'email', 'first_name', 'last_name']);
    if (!empty($errors)) {
        $pdo->exec("ROLLBACK");
        sendError('Validation failed', 400, $errors);
    }
    
    // ISOLATION: Row-level locking prevents concurrent updates to same username/email
    // CONSISTENCY: Validate username/email uniqueness with row-level locking
    // Check if username or email already exists (excluding current user) WITH ROW-LEVEL LOCKING
    $stmt = $pdo->prepare("SELECT user_id FROM users WHERE (username = ? OR email = ?) AND user_id != ? FOR UPDATE");
    $stmt->execute([
        $input['username'],
        $input['email'],
        $userId
    ]);
    if ($stmt->fetch()) {
        $pdo->exec("ROLLBACK");
        sendError('Username or email already exists', 409);
    }
    
    // CONSISTENCY: Validate email format
    // Validate email format
    if (isset($input['email']) && !filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
        $pdo->exec("ROLLBACK");
        sendError('Invalid email format', 400);
    }
    
    // CONSISTENCY: Validate branch_id exists before UPDATE
    // Validate branch_id if provided
    if (isset($input['branch_id'])) {
        if (empty($input['branch_id']) || $input['branch_id'] === '0' || $input['branch_id'] === 0) {
            // Allow null/0 to unset branch
            $input['branch_id'] = null;
        } else {
            $branchId = (int)$input['branch_id'];
            // Verify branch exists
            $branchCheck = $pdo->prepare("SELECT branch_id FROM branches WHERE branch_id = ?");
            $branchCheck->execute([$branchId]);
            if (!$branchCheck->fetch()) {
                $pdo->exec("ROLLBACK");
                sendError('Invalid branch selected', 400);
            }
        }
    }
    
    // ATOMICITY: Profile update within transaction
    // Build update query
    $updateFields = [];
    $params = [];
    
    $allowedFields = ['username', 'email', 'first_name', 'last_name', 'phone', 'address', 'branch_id'];
    foreach ($allowedFields as $field) {
        if (isset($input[$field])) {
            $updateFields[] = "$field = ?";
            $params[] = $input[$field];
        }
    }
    
    // ATOMICITY: Password update within same transaction
    // Handle password update if provided
    // Hash password with bcrypt - automatically generates unique salt for each password
    // Using PASSWORD_BCRYPT with cost 12 ensures each password gets a unique hash even if passwords are identical
    if (isset($input['password']) && !empty($input['password'])) {
        $updateFields[] = "password_hash = ?";
        $params[] = password_hash($input['password'], PASSWORD_BCRYPT, ['cost' => 12]);
    }
    
    if (empty($updateFields)) {
        $pdo->exec("ROLLBACK");
        sendError('No fields to update', 400);
    }
    
    $params[] = $userId;
    
    $sql = "UPDATE users SET " . implode(', ', $updateFields) . " WHERE user_id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    // Get updated user with branch info
    $stmt = $pdo->prepare("
        SELECT u.user_id, u.username, u.email, u.first_name, u.last_name, u.phone, u.address, u.role, u.branch_id,
               b.branch_name
        FROM users u
        LEFT JOIN branches b ON u.branch_id = b.branch_id
        WHERE u.user_id = ?
    ");
    $stmt->execute([$userId]);
    $updatedUser = $stmt->fetch();
    
    // DURABILITY: COMMIT ensures all changes are permanently saved
    $pdo->exec("COMMIT");
    
    sendResponse(['user' => $updatedUser], 'Profile updated successfully');
} catch (Exception $e) {
    // ATOMICITY: Rollback ensures no partial state on error
    if ($pdo->inTransaction()) {
        $pdo->exec("ROLLBACK");
    }
    error_log('Profile update error: ' . $e->getMessage());
    sendError('Failed to update profile: ' . $e->getMessage(), 500);
}
?>

