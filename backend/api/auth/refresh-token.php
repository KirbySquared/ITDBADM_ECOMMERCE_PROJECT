<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

header('Content-Type: application/json');

try {
    // Get authorization header (case-insensitive)
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $token = null;
    
    // Case-insensitive header check
    foreach ($headers as $k => $v) {
        if (strtolower($k) === 'authorization') {
            $token = preg_replace('/^Bearer\s+/i', '', $v);
            break;
        }
    }
    
    if (!$token) {
        sendError('Authorization token required', 401);
    }
    
    // Validate token (even if expired, we'll check if it's within refresh window)
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        sendError('Invalid token format', 401);
    }
    
    list($base64Header, $base64Payload, $base64Signature) = $parts;
    
    // Verify signature
    $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, JWT_SECRET, true);
    $expectedSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    
    if (!hash_equals($expectedSignature, $base64Signature)) {
        sendError('Invalid token signature', 401);
    }
    
    // Decode payload
    $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $base64Payload)), true);
    
    if (!$payload || !isset($payload['user_id']) || !isset($payload['exp'])) {
        sendError('Invalid token payload', 401);
    }
    
    // Allow refresh if token expired within last 1 hour (grace period)
    // Or if token is still valid
    $expiredTime = $payload['exp'];
    $currentTime = time();
    $gracePeriod = 60 * 60; // 1 hour
    
    if ($expiredTime < ($currentTime - $gracePeriod)) {
        sendError('Token expired. Please login again', 401);
    }
    
    // Get user info to verify they still exist
    $stmt = $pdo->prepare("SELECT user_id, username, email, first_name, last_name, role, branch_id FROM users WHERE user_id = ?");
    $stmt->execute([$payload['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        sendError('User not found', 401);
    }
    
    // Generate new token with extended expiration
    $newToken = generateToken($user['user_id']);
    
    // Prepare user data (exclude sensitive info)
    $userData = [
        'user_id' => $user['user_id'],
        'username' => $user['username'],
        'email' => $user['email'],
        'first_name' => $user['first_name'],
        'last_name' => $user['last_name'],
        'role' => $user['role'],
        'branch_id' => $user['branch_id']
    ];
    
    // If user has branch_id, get branch name
    if ($user['branch_id']) {
        $branchStmt = $pdo->prepare("SELECT branch_name FROM branches WHERE branch_id = ?");
        $branchStmt->execute([$user['branch_id']]);
        $branch = $branchStmt->fetch(PDO::FETCH_ASSOC);
        if ($branch) {
            $userData['branch_name'] = $branch['branch_name'];
        }
    }
    
    sendResponse([
        'token' => $newToken,
        'user' => $userData
    ], 'Session extended successfully');
    
} catch (Exception $e) {
    error_log("Refresh token error: " . $e->getMessage());
    sendError('Failed to refresh token', 500);
}
?>

