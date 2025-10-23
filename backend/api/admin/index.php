<?php
// Admin API Router with Debug Logging
error_log("=== ADMIN API INDEX.PHP CALLED ===");
error_log("Request URI: " . $_SERVER['REQUEST_URI']);
error_log("Request Method: " . $_SERVER['REQUEST_METHOD']);
error_log("Current Working Directory: " . getcwd());
error_log("Script Directory: " . __DIR__);

// Set CORS headers first, before any other processing
header('Access-Control-Allow-Origin: http://localhost:5173');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    error_log("OPTIONS request in admin API - sending CORS headers");
    http_response_code(200);
    exit();
}

// Try to include database and response files
$dbPath = __DIR__ . '/../../config/database.php';
$responsePath = __DIR__ . '/../../utils/response.php';

error_log("Admin API - Database file path: " . $dbPath);
error_log("Admin API - Database file exists: " . (file_exists($dbPath) ? 'YES' : 'NO'));
error_log("Admin API - Response file path: " . $responsePath);
error_log("Admin API - Response file exists: " . (file_exists($responsePath) ? 'YES' : 'NO'));

require_once $dbPath;
require_once $responsePath;

// Get request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = str_replace('/api/admin', '', $path);

// Remove leading slash
$path = ltrim($path, '/');

error_log("Admin API - Processed path: " . $path);
error_log("Admin API - Request method: " . $method);

// Route the request
error_log("Admin API - Routing to: " . $path);
switch ($path) {
    case 'login':
        if ($method === 'POST') {
            include 'admin_login.php';
        } else {
            sendError('Method not allowed', 405);
        }
        break;
        
    case 'check_auth':
        if ($method === 'GET') {
            include 'admin_check_auth.php';
        } else {
            sendError('Method not allowed', 405);
        }
        break;
        
    case 'dashboard':
        if ($method === 'GET') {
            include 'admin_dashboard.php';
        } else {
            sendError('Method not allowed', 405);
        }
        break;
        
    case 'logout':
        if ($method === 'POST') {
            include 'admin_logout.php';
        } else {
            sendError('Method not allowed', 405);
        }
        break;
        
    default:
        sendError('Admin endpoint not found', 404);
        break;
}
?>
