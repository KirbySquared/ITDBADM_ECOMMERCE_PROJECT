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
require_once __DIR__ . '/../../utils/security_headers.php';
require_once __DIR__ . '/../../utils/rate_limiter.php';
require_once __DIR__ . '/../../utils/security_audit.php';
require_once __DIR__ . '/../../utils/forensics.php';
require_once __DIR__ . '/../../utils/input_validator.php';

// Set security headers
setSecurityHeaders();

// Get request data
$input = json_decode(file_get_contents('php://input'), true);
error_log("Input data: " . json_encode($input));

// Validate required fields
$errors = validateRequired($input, ['email', 'password']);
if (!empty($errors)) {
    error_log("Validation errors: " . json_encode($errors));
    sendError('Validation failed', 400, $errors);
}

// Validate email format
$email = validateEmail($input['email'] ?? '');
if ($email === false) {
    sendError('Invalid email format', 400);
}

// Validate password is provided
$password = $input['password'] ?? '';
if (empty($password)) {
    sendError('Password is required', 400);
}

// Use email as identifier for rate limiting (per account, not per device)
$rateLimitIdentifier = 'email_' . strtolower(trim($email));

// Check rate limit (READ-ONLY check, does not increment)
$rateLimit = checkRateLimit($pdo, $rateLimitIdentifier, 'admin_login', 5);
if (!$rateLimit['allowed']) {
    logSecurityEvent($pdo, 'rate_limit_exceeded', 'critical', 
        "Admin login rate limit exceeded for email: $email", null, [
            'email' => $email,
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'attempts' => $rateLimit['current_attempts'] ?? 0
        ]);
    
    logForensics($pdo, 'admin_brute_force_attempt', 
        "Admin login rate limit exceeded - possible brute force attack", null, [
            'email' => $email,
            'identifier' => $rateLimitIdentifier
        ]);
    
    $resetMinutes = $rateLimit['reset_at'] 
        ? ceil((strtotime($rateLimit['reset_at']) - time()) / 60) 
        : 15;
    
    sendError('Too many login attempts for this account. Please try again in ' . max(1, $resetMinutes) . ' minutes.', 429);
}

error_log("Attempting admin login for email: " . $email);

try {
    // Find user by email and check if admin (now also selecting status)
    $stmt = $pdo->prepare("
        SELECT user_id, username, email, first_name, last_name, password_hash, role, status
        FROM users
        WHERE email = ? AND role = 'admin'
        LIMIT 1
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user) {
        error_log("No admin user found with email: " . $email);
        
        // Increment rate limit on failed attempt (per email/account)
        incrementRateLimit($pdo, $rateLimitIdentifier, 'admin_login', 5, 900);
        
        // Log failed admin login attempt
        logSecurityEvent($pdo, 'admin_login_failed', 'high', 
            "Failed admin login attempt - user not found", null, [
                'email' => $email,
                'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
            ]);
        
        // Check for suspicious activity
        $suspicious = detectSuspiciousActivity($pdo, null, $_SERVER['REMOTE_ADDR'] ?? null);
        if (!empty($suspicious)) {
            logForensics($pdo, 'suspicious_admin_login_activity', 
                "Suspicious admin login activity detected - user not found", null, $suspicious);
        }
        
        sendError('Admin access required. Invalid credentials or insufficient privileges.', 401);
    }

    error_log("Admin user found: " . json_encode(['user_id' => $user['user_id'], 'email' => $user['email'], 'role' => $user['role']]));

    // Verify password
    if (!password_verify($password, $user['password_hash'])) {
        error_log("Password verification failed for email: " . $email);
        
        // Increment rate limit on failed attempt (per email/account)
        incrementRateLimit($pdo, $rateLimitIdentifier, 'admin_login', 5, 900);
        
        // Log failed admin login attempt
        logSecurityEvent($pdo, 'admin_login_failed', 'high', 
            "Failed admin login attempt - invalid password", $user['user_id'], [
                'email' => $email,
                'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
            ]);
        
        // Check for suspicious activity
        $suspicious = detectSuspiciousActivity($pdo, $user['user_id'], $_SERVER['REMOTE_ADDR'] ?? null);
        if (!empty($suspicious)) {
            logForensics($pdo, 'suspicious_admin_login_activity', 
                "Suspicious admin login activity detected - invalid password", $user['user_id'], $suspicious);
        }
        
        sendError('Admin access required. Invalid credentials or insufficient privileges.', 401);
    }

    error_log("Password verification successful for email: " . $email);

    // Mark admin as active (and optionally set last_login_at)
    try {
        $upd = $pdo->prepare("
            UPDATE users
            SET status = 'active'
            WHERE user_id = ?
        ");
        $upd->execute([$user['user_id']]);
        $user['status'] = 'active'; // reflect in response
        error_log("User status set to active for user_id: " . $user['user_id']);
    } catch (Exception $e) {
        // Log but do not fail the login if status update fails
        error_log("Failed to update status for user_id {$user['user_id']}: " . $e->getMessage());
    }

    // On successful admin login, reset rate limit for this account
    resetRateLimit($pdo, $rateLimitIdentifier, 'admin_login');
    
    // Log successful admin login
    logSecurityEvent($pdo, 'admin_login_success', 'low', 
        "Successful admin login", $user['user_id'], [
            'email' => $email,
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
        ]);

    // Generate token
    $token = generateToken($user['user_id']);
    error_log("Token generated successfully for user_id: " . $user['user_id']);

    // Remove sensitive fields
    unset($user['password_hash']);

    error_log("Admin login successful for user: " . $user['user_id']);
    sendResponse([
        'user'  => $user,
        'token' => $token
    ], 'Admin login successful');

} catch (PDOException $e) {
    error_log("Database error during admin login: " . $e->getMessage());
    sendError('Database error during admin login', 500);
}
?>
