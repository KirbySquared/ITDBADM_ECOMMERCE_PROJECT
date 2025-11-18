<?php
/**
 * STAFF CHECK AUTH API ENDPOINT
 * 
 * Validates staff token and returns staff user info with branch details.
 * 
 * ROUTE: /api/staff/check_auth
 * METHOD: GET
 * HEADERS: { "Authorization": "Bearer <jwt_token>" }
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

// Check if user is staff and has branch_id
try {
    $stmt = $pdo->prepare("
        SELECT u.user_id, u.username, u.email, u.first_name, u.last_name, u.role, u.branch_id,
               b.branch_name
        FROM users u
        LEFT JOIN branches b ON u.branch_id = b.branch_id
        WHERE u.user_id = ? AND u.role = 'staff'
    ");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    
    if (!$user) {
        sendError('Staff access required', 403);
    }
    
    if (!$user['branch_id']) {
        sendError('Staff user must be assigned to a branch', 403);
    }
    
    sendResponse([
        'user' => $user,
        'isStaff' => true
    ], 'Staff authentication successful');
    
} catch (PDOException $e) {
    sendError('Database error', 500);
}
?>

