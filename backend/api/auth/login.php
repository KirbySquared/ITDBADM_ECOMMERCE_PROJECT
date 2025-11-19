<?php
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

// Validate required fields
$errors = validateRequired($input, ['email', 'password']);
if (!empty($errors)) {
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
$rateLimit = checkRateLimit($pdo, $rateLimitIdentifier, 'login', 5);
if (!$rateLimit['allowed']) {
    logSecurityEvent($pdo, 'rate_limit_exceeded', 'high', 
        "Login rate limit exceeded for email: $email", null, [
            'email' => $email,
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'attempts' => $rateLimit['current_attempts'] ?? 0
        ]);
    
    logForensics($pdo, 'rate_limit_exceeded', 
        "Login rate limit exceeded - possible brute force attack", null, [
            'email' => $email,
            'identifier' => $rateLimitIdentifier
        ]);
    
    $resetMinutes = $rateLimit['reset_at'] 
        ? ceil((strtotime($rateLimit['reset_at']) - time()) / 60) 
        : 15;
    
    sendError('Too many login attempts for this account. Please try again in ' . max(1, $resetMinutes) . ' minutes.', 429);
}

// Find user by email (now also selecting status and branch info)
$stmt = $pdo->prepare("
    SELECT u.user_id, u.username, u.first_name, u.last_name, u.email, u.phone, u.address, u.password_hash, u.status, u.branch_id,
           b.branch_name
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.branch_id
    WHERE u.email = ?
");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user) {
    // Increment rate limit on failed attempt (per email/account)
    incrementRateLimit($pdo, $rateLimitIdentifier, 'login', 5, 900);
    
    // Log failed login attempt
    logSecurityEvent($pdo, 'login_failed', 'medium', 
        "Failed login attempt - user not found", null, [
            'email' => $email,
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
        ]);
    
    // Check for suspicious activity
    $suspicious = detectSuspiciousActivity($pdo, null, $_SERVER['REMOTE_ADDR'] ?? null);
    if (!empty($suspicious)) {
        logForensics($pdo, 'suspicious_login_activity', 
            "Suspicious login activity detected - user not found", null, $suspicious);
    }
    
    sendError('Invalid credentials', 401);
}

// Verify password
if (!password_verify($password, $user['password_hash'])) {
    // Increment rate limit on failed attempt (per email/account)
    incrementRateLimit($pdo, $rateLimitIdentifier, 'login', 5, 900);
    
    // Log failed login attempt
    logSecurityEvent($pdo, 'login_failed', 'medium', 
        "Failed login attempt - invalid password", $user['user_id'], [
            'email' => $email,
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
        ]);
    
    // Check for suspicious activity
    $suspicious = detectSuspiciousActivity($pdo, $user['user_id'], $_SERVER['REMOTE_ADDR'] ?? null);
    if (!empty($suspicious)) {
        logForensics($pdo, 'suspicious_login_activity', 
            "Suspicious login activity detected - invalid password", $user['user_id'], $suspicious);
    }
    
    sendError('Invalid credentials', 401);
}

// At this point, credentials are valid — set status to 'active'
try {
    $upd = $pdo->prepare("
        UPDATE users
        SET status = 'active'   
        WHERE user_id = ?
    ");
    $upd->execute([$user['user_id']]);

    // Reflect the updated status in the response without extra round-trip
    $user['status'] = 'active';
} catch (Exception $e) {
    // If updating status fails, still avoid leaking internals to the client
    // You can log $e->getMessage() server-side if desired.
}

// On successful login, reset rate limit for this account
resetRateLimit($pdo, $rateLimitIdentifier, 'login');

// Log successful login
logSecurityEvent($pdo, 'login_success', 'low', 
    "Successful login", $user['user_id'], [
        'email' => $email,
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
    ]);

// Generate token
$token = generateToken($user['user_id']);

// Remove password from response
unset($user['password_hash']);

// Respond
sendResponse([
    'user' => $user,
    'token' => $token
], 'Login successful');
