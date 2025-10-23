<?php
/**
 * ADMIN LOGIN API ENDPOINT
 * 
 * This endpoint handles admin authentication for the admin panel.
 * 
 * ROUTE: /api/admin/login
 * METHOD: POST
 * 
 * REQUEST BODY:
 * {
 *   "email": "admin@electronicsstore.com",
 *   "password": "Dlsu1234!"
 * }
 * 
 * RESPONSE SUCCESS:
 * {
 *   "success": true,
 *   "message": "Admin login successful",
 *   "data": {
 *     "user": { "user_id": 1, "username": "admin", "email": "admin@electronicsstore.com", ... },
 *     "token": "jwt_token_here"
 *   }
 * }
 * 
 * RESPONSE ERROR:
 * {
 *   "success": false,
 *   "message": "Admin access required. Invalid credentials or insufficient privileges.",
 *   "errors": { "email": "Email is required", "password": "Password is required" }
 * }
 * 
 * SECURITY FEATURES:
 * - Password verification using password_verify()
 * - Role checking (only admin users can login)
 * - JWT token generation
 * - Input validation and sanitization
 * 
 * TO ADD NEW FEATURES:
 * - Add additional validation rules
 * - Modify the user data returned
 * - Add logging or audit trails
 * - Update the error messages
 */

// Admin Login API with Debug Logging
error_log("=== ADMIN LOGIN API CALLED ===");
error_log("Request Method: " . $_SERVER['REQUEST_METHOD']);
error_log("Content Type: " . ($_SERVER['CONTENT_TYPE'] ?? 'NOT SET'));

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

// Get request data
$input = json_decode(file_get_contents('php://input'), true);
error_log("Input data: " . json_encode($input));

// Validate required fields
$errors = validateRequired($input, ['email', 'password']);

if (!empty($errors)) {
    error_log("Validation errors: " . json_encode($errors));
    sendError('Validation failed', 400, $errors);
}

// Sanitize input
$email = sanitizeInput($input['email']);
$password = $input['password'];

error_log("Attempting login for email: " . $email);

try {
    // Find user by email and check if admin
    $stmt = $pdo->prepare("
        SELECT user_id, username, email, first_name, last_name, password_hash, role 
        FROM users 
        WHERE email = ? AND role = 'admin'
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user) {
        error_log("No admin user found with email: " . $email);
        sendError('Admin access required. Invalid credentials or insufficient privileges.', 401);
    }

    error_log("Admin user found: " . json_encode($user));

    // Verify password
    if (!password_verify($password, $user['password_hash'])) {
        error_log("Password verification failed for email: " . $email);
        sendError('Admin access required. Invalid credentials or insufficient privileges.', 401);
    }

    error_log("Password verification successful for email: " . $email);

    // Generate token
    $token = generateToken($user['user_id']);
    error_log("Token generated successfully");

    // Remove password from response
    unset($user['password_hash']);

    error_log("Admin login successful for user: " . $user['user_id']);
    sendResponse([
        'user' => $user,
        'token' => $token
    ], 'Admin login successful');

} catch (PDOException $e) {
    error_log("Database error during admin login: " . $e->getMessage());
    sendError('Database error during admin login', 500);
}
?>
