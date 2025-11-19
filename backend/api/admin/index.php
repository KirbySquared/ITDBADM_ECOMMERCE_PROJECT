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
$pathParts = explode('/', $path);

error_log("Admin API - Processed path: " . $path);
error_log("Admin API - Request method: " . $method);
error_log("Admin API - Path parts: " . json_encode($pathParts));

// Route the request
error_log("Admin API - Routing to: " . $path);

// Handle specific routes first
if ($path === 'login' && $method === 'POST') {
    include 'admin_login.php';
} elseif ($path === 'check_auth' && $method === 'GET') {
    include 'admin_check_auth.php';
} elseif ($path === 'dashboard' && $method === 'GET') {
    include 'admin_dashboard.php';
} elseif ($path === 'logout' && $method === 'POST') {
    include 'admin_logout.php';
} elseif ($path === 'users' && ($method === 'GET' || $method === 'POST')) {
    include 'users.php';
} elseif ($path === 'categories' && ($method === 'GET' || $method === 'POST')) {
    include 'categories.php';
} elseif ($path === 'genres' && ($method === 'GET' || $method === 'POST')) {
    include 'genres.php';
} elseif ($path === 'branches' && ($method === 'GET' || $method === 'POST')) {
    include 'branches.php';
} elseif (preg_match('/^users\/\d+$/', $path) && ($method === 'GET' || $method === 'PUT' || $method === 'DELETE')) {
    include 'users.php';
} elseif (preg_match('/^categories\/\d+$/', $path) && ($method === 'GET' || $method === 'PUT' || $method === 'DELETE')) {
    include 'categories.php';
} elseif (preg_match('/^genres\/\d+$/', $path) && ($method === 'GET' || $method === 'PUT' || $method === 'DELETE')) {
    include 'genres.php';
} elseif (preg_match('/^branches\/\d+$/', $path) && ($method === 'GET' || $method === 'PUT' || $method === 'DELETE')) {
    include 'branches.php';
} elseif ($path === 'products' && ($method === 'GET' || $method === 'POST')) {
    include 'products.php';
} elseif ($path === 'orders' && ($method === 'GET' || $method === 'POST')) {
    include 'orders.php';
} elseif ($path === 'reports' && $method === 'GET') {
    include 'reports.php';
} elseif (preg_match('/^products\/\d+/', $path)) {
    // Parse the path like React Router
    $pathSegments = explode('/', $path);
    $productId = $pathSegments[1]; // products/{id}
    
    if (isset($pathSegments[2]) && $pathSegments[2] === 'images') {
        // Route to product images handler
        include 'product_images.php';
    } elseif (isset($pathSegments[2]) && $pathSegments[2] === 'inventory') {
        // Route to products handler for inventory management
        include 'products.php';
    } else {
        // Route to products handler
        include 'products.php';
    }
} elseif (preg_match('/^orders\/\d+$/', $path) && ($method === 'GET' || $method === 'PUT' || $method === 'DELETE')) {
    include 'orders.php';
} else {
    sendError('Admin endpoint not found', 404);
}
?>
