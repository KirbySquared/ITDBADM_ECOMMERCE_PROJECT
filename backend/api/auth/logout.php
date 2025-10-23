<?php
require_once '../../config/database.php';
require_once '../../utils/response.php';

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

// For API logout, we just return success
// The frontend will handle removing the token from storage
sendResponse(null, 'Logout successful');
?>
