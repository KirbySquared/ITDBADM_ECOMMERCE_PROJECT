<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

// Get authorization header (case-insensitive)
$headers = function_exists('getallheaders') ? getallheaders() : [];
$authHeader = null;
foreach ($headers as $k => $v) {
    if (strtolower($k) === 'authorization') {
        $authHeader = $v;
        break;
    }
}

$token = null;
if (!empty($authHeader)) {
    $token = preg_replace('/^Bearer\s+/i', '', $authHeader);
}

if (!$token) {
    sendError('Authorization token required', 401);
}

// Validate token
$userId = validateToken($token);
if (!$userId) {
    sendError('Invalid or expired token', 401);
}

// Mark user as inactive (and optionally set last_logout_at)
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

// For API logout, we just return success; frontend removes the token from storage.
sendResponse(null, 'Logout successful');
