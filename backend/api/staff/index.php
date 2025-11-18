<?php
// Staff API Router
// Set CORS headers first, before any other processing
header('Access-Control-Allow-Origin: http://localhost:5173');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

// Get request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = str_replace('/api/staff', '', $path);

// Remove leading slash
$path = ltrim($path, '/');
$pathParts = explode('/', $path);

// Route the request
if ($path === 'login' && $method === 'POST') {
    include 'staff_login.php';
} elseif ($path === 'check_auth' && $method === 'GET') {
    include 'staff_check_auth.php';
} elseif ($path === 'dashboard' && $method === 'GET') {
    include 'staff_dashboard.php';
} elseif ($path === 'orders' && $method === 'GET') {
    include 'orders.php';
} elseif ($path === 'inventory' && $method === 'GET') {
    include 'inventory.php';
} elseif (preg_match('/^orders\/\d+$/', $path) && $method === 'GET') {
    include 'orders.php';
} elseif (preg_match('/^orders\/\d+$/', $path) && $method === 'PUT') {
    include 'orders.php';
} elseif (preg_match('/^inventory\/\d+$/', $path) && $method === 'PUT') {
    include 'inventory.php';
} elseif (preg_match('/^inventory\/\d+\/(add-stock|damage)$/', $path) && $method === 'POST') {
    include 'inventory.php';
} else {
    sendError('Staff endpoint not found', 404);
}
?>

