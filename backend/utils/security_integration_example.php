<?php
/**
 * SECURITY INTEGRATION EXAMPLES
 * 
 * This file shows how to integrate security features into existing endpoints
 * WITHOUT modifying existing code structure - just add these includes and calls
 * 
 * USAGE:
 * 1. Include security utilities at the top of your endpoint file
 * 2. Add security headers
 * 3. Add rate limiting where needed
 * 4. Add security logging for important events
 * 5. Add forensics logging for security incidents
 */

// ========================================
// EXAMPLE 1: Adding Security to Login Endpoint
// ========================================
/*
// At the top of your login.php file, add:
require_once __DIR__ . '/../../utils/security_headers.php';
require_once __DIR__ . '/../../utils/rate_limiter.php';
require_once __DIR__ . '/../../utils/security_audit.php';
require_once __DIR__ . '/../../utils/forensics.php';

// Set security headers
setSecurityHeaders();

// Get client identifier
$clientId = getClientIdentifier();

// Check rate limit (5 attempts per 5 minutes)
$rateLimit = checkRateLimit($pdo, $clientId, 'login', 5, 300);
if (!$rateLimit['allowed']) {
    logSecurityEvent($pdo, 'rate_limit_exceeded', 'high', 
        "Login rate limit exceeded for $clientId", null);
    sendError('Too many login attempts. Please try again later.', 429);
}

// In your login validation section, after failed login:
if (!$user || !password_verify($password, $user['password_hash'])) {
    // Log failed login attempt
    logSecurityEvent($pdo, 'login_failed', 'medium', 
        "Failed login attempt for email: $email", null, ['email' => $email]);
    
    // Check for suspicious activity
    $suspicious = detectSuspiciousActivity($pdo, null, $_SERVER['REMOTE_ADDR']);
    if (!empty($suspicious)) {
        logForensics($pdo, 'suspicious_login_activity', 
            "Suspicious login activity detected", null, $suspicious);
    }
    
    sendError('Invalid credentials', 401);
}

// On successful login, reset rate limit
resetRateLimit($pdo, $clientId, 'login');
logSecurityEvent($pdo, 'login_success', 'low', 
    "Successful login for user: {$user['user_id']}", $user['user_id']);
*/

// ========================================
// EXAMPLE 2: Adding Security to Admin Endpoints
// ========================================
/*
// At the top of your admin endpoint file:
require_once __DIR__ . '/../../utils/security_headers.php';
require_once __DIR__ . '/../../utils/security_audit.php';
require_once __DIR__ . '/../../utils/forensics.php';

// Set security headers
setSecurityHeaders();

// After admin authentication check:
if (!$user || $user['role'] !== 'admin') {
    logSecurityEvent($pdo, 'access_denied', 'high', 
        "Unauthorized admin access attempt", $userId, [
            'attempted_endpoint' => $_SERVER['REQUEST_URI'],
            'user_role' => $user['role'] ?? 'none'
        ]);
    
    // Log forensics for security incident
    logForensics($pdo, 'unauthorized_admin_access', 
        "Unauthorized admin access attempt", $userId);
    
    sendError('Admin access required', 403);
}

// Log admin actions
logSecurityEvent($pdo, 'admin_action', 'low', 
    "Admin action: " . $_SERVER['REQUEST_URI'], $userId);
*/

// ========================================
// EXAMPLE 3: Adding Rate Limiting to API Endpoints
// ========================================
/*
// For sensitive operations like checkout:
require_once __DIR__ . '/../../utils/rate_limiter.php';
require_once __DIR__ . '/../../utils/security_audit.php';

$clientId = getClientIdentifier($userId);

// Limit checkout attempts (3 per hour)
$rateLimit = checkRateLimit($pdo, $clientId, 'checkout', 3, 3600);
if (!$rateLimit['allowed']) {
    logSecurityEvent($pdo, 'rate_limit_exceeded', 'medium', 
        "Checkout rate limit exceeded", $userId);
    sendError('Too many checkout attempts. Please try again later.', 429);
}
*/

// ========================================
// EXAMPLE 4: Adding Security to Order Endpoints
// ========================================
/*
// Ensure users can only access their own orders:
require_once __DIR__ . '/../../utils/security_audit.php';
require_once __DIR__ . '/../../utils/forensics.php';

// After fetching order:
if ($order['user_id'] != $userId) {
    logSecurityEvent($pdo, 'unauthorized_order_access', 'high', 
        "User attempted to access order belonging to another user", $userId, [
            'attempted_order_id' => $orderId,
            'order_owner_id' => $order['user_id']
        ]);
    
    logForensics($pdo, 'unauthorized_data_access', 
        "Unauthorized order access attempt", $userId, [
            'order_id' => $orderId
        ]);
    
    sendError('Order not found or access denied', 404);
}
*/

// ========================================
// EXAMPLE 5: Adding Input Sanitization
// ========================================
/*
require_once __DIR__ . '/../../utils/security_headers.php';

// Sanitize all user inputs:
$email = sanitizeSecurityInput($_POST['email'], 'email');
$username = sanitizeSecurityInput($_POST['username'], 'string');
$userId = sanitizeSecurityInput($_GET['id'], 'int');
*/

?>


