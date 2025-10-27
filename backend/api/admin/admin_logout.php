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

try {
    $stmt = $pdo->prepare("
        UPDATE users
        SET status = 'inactive'
        WHERE user_id = ?
    ");
    $stmt->execute([$userId]);
} catch (Exception $e) {
    // Log internally if you have logging; don't leak details to client.
    // error_log('Logout status update failed: ' . $e->getMessage());
    // Even if this fails, we still return success for the API logout action.
}
// For admin logout, we just return success
// The frontend will handle removing the token from storage
sendResponse(null, 'Admin logout successful');
?>
