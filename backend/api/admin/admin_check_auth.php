<?php
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
