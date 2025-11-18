<?php
// Staff authentication middleware
// Use __DIR__ to ensure paths work regardless of where this file is included from
// require_once will prevent duplicate includes
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/response.php';

function requireStaffAuth() {
    global $pdo; // Access global $pdo variable from database.php
    
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

    // Check if user is staff and has branch_id
    try {
        $stmt = $pdo->prepare("
            SELECT user_id, branch_id, role 
            FROM users 
            WHERE user_id = ? AND role = 'staff'
        ");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        
        if (!$user) {
            sendError('Staff access required', 403);
        }
        
        if (!$user['branch_id']) {
            sendError('Staff user must be assigned to a branch', 403);
        }
        
        return [
            'user_id' => $user['user_id'],
            'branch_id' => $user['branch_id']
        ];
    } catch (PDOException $e) {
        sendError('Database error', 500);
    }
}
?>

