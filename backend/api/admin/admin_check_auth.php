<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

// Get authorization header (case-insensitive for Windows compatibility)
$headers = function_exists('getallheaders') ? getallheaders() : [];
$token = null;

// Case-insensitive header check
foreach ($headers as $k => $v) {
    if (strtolower($k) === 'authorization') {
        $token = preg_replace('/^Bearer\s+/i', '', $v);
        break;
    }
}

// Fallback: check $_SERVER if getallheaders() didn't work
if (!$token && isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $token = preg_replace('/^Bearer\s+/i', '', $_SERVER['HTTP_AUTHORIZATION']);
}

if (!$token) {
    sendError('Authorization token required', 401);
}

// Validate token
$userId = validateToken($token);
if (!$userId) {
    sendError('Invalid or expired token', 401);
}

// Check if user is admin
try {
    $stmt = $pdo->prepare("
        SELECT user_id, username, email, first_name, last_name, role 
        FROM users 
        WHERE user_id = ? AND role = 'admin'
    ");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    
    if (!$user) {
        sendError('Admin access required', 403);
    }
    
    sendResponse([
        'user' => $user,
        'isAdmin' => true
    ], 'Admin authentication successful');
    
} catch (PDOException $e) {
    sendError('Database error', 500);
}
?>
