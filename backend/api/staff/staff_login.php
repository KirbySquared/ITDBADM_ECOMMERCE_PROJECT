<?php
/**
 * STAFF LOGIN API ENDPOINT
 * 
 * This endpoint handles staff authentication for the staff panel.
 * 
 * ROUTE: /api/staff/login
 * METHOD: POST
 * 
 * REQUEST BODY:
 * {
 *   "email": "staff@electronicsstore.com",
 *   "password": "password123"
 * }
 * 
 * RESPONSE SUCCESS:
 * {
 *   "success": true,
 *   "message": "Staff login successful",
 *   "data": {
 *     "user": { "user_id": 1, "username": "staff", "email": "staff@electronicsstore.com", "branch_id": 1, "branch_name": "Main Branch", ... },
 *     "token": "jwt_token_here"
 *   }
 * }
 * 
 * RESPONSE ERROR:
 * {
 *   "success": false,
 *   "message": "Staff access required. Invalid credentials or insufficient privileges.",
 *   "errors": { "email": "Email is required", "password": "Password is required" }
 * }
 * 
 * SECURITY FEATURES:
 * - Password verification using password_verify()
 * - Role checking (only staff users can login)
 * - Branch validation (staff must have branch_id assigned)
 * - JWT token generation
 * - Input validation and sanitization
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

// Get request data
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$errors = validateRequired($input, ['email', 'password']);
if (!empty($errors)) {
    sendError('Validation failed', 400, $errors);
}

// Sanitize input
$email = sanitizeInput($input['email']);
$password = $input['password'];

try {
    // Find user by email and check if staff (also get branch info)
    $stmt = $pdo->prepare("
        SELECT u.user_id, u.username, u.email, u.first_name, u.last_name, u.password_hash, u.role, u.status, u.branch_id,
               b.branch_name
        FROM users u
        LEFT JOIN branches b ON u.branch_id = b.branch_id
        WHERE u.email = ? AND u.role = 'staff'
        LIMIT 1
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user) {
        sendError('Staff access required. Invalid credentials or insufficient privileges.', 401);
    }

    // Verify password
    if (!password_verify($password, $user['password_hash'])) {
        sendError('Staff access required. Invalid credentials or insufficient privileges.', 401);
    }

    // Check if staff has branch_id assigned
    if (!$user['branch_id']) {
        sendError('Staff user must be assigned to a branch. Please contact administrator.', 403);
    }

    // Mark staff as active
    try {
        $upd = $pdo->prepare("
            UPDATE users
            SET status = 'active'
            WHERE user_id = ?
        ");
        $upd->execute([$user['user_id']]);
        $user['status'] = 'active';
    } catch (Exception $e) {
        // Log but do not fail the login if status update fails
        error_log("Failed to update status for user_id {$user['user_id']}: " . $e->getMessage());
    }

    // Generate token
    $token = generateToken($user['user_id']);

    // Remove sensitive fields
    unset($user['password_hash']);

    sendResponse([
        'user'  => $user,
        'token' => $token
    ], 'Staff login successful');

} catch (PDOException $e) {
    error_log("Database error during staff login: " . $e->getMessage());
    sendError('Database error during staff login', 500);
}
?>

