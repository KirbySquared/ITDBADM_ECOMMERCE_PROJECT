<?php
/**
 * MAIN API ROUTER
 * 
 * This is the main entry point for all API requests.
 * 
 * ROUTES HANDLED:
 * - /api/auth/* - Authentication endpoints (login, register, logout)
 * - /api/products - Product management
 * - /api/categories - Category management
 * - /api/cart - Shopping cart operations
 * - /api/admin/* - Admin-specific endpoints (routed to admin/index.php)
 * 
 * CORS CONFIGURATION:
 * - Origin: http://localhost:5173 (React frontend)
 * - Methods: GET, POST, PUT, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization
 * - Credentials: true
 * 
 * TO ADD NEW ENDPOINTS:
 * 1. Create the endpoint file in appropriate folder
 * 2. Add the route case in the switch statement
 * 3. Include the file with proper method checking
 * 4. Test the endpoint with Postman/curl
 * 
 * DEBUGGING:
 * - Check error logs for request details
 * - Verify file paths and includes
 * - Test CORS headers in browser dev tools
 */
// Main API Router with Debug Logging
error_log("=== API INDEX.PHP CALLED ===");
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
    error_log("OPTIONS request in API index - sending CORS headers");
    http_response_code(200);
    exit();
}

// Try to include database and response files
$dbPath = __DIR__ . '/../config/database.php';
$responsePath = __DIR__ . '/../utils/response.php';

error_log("Database file path: " . $dbPath);
error_log("Database file exists: " . (file_exists($dbPath) ? 'YES' : 'NO'));
error_log("Response file path: " . $responsePath);
error_log("Response file exists: " . (file_exists($responsePath) ? 'YES' : 'NO'));

require_once $dbPath;
require_once $responsePath;

// Get request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = str_replace('/api', '', $path);

// Remove leading slash
$path = ltrim($path, '/');

error_log("Processed path: " . $path);
error_log("Request method: " . $method);

// Route the request
switch ($path) {
    case 'auth/register':
        if ($method === 'POST') {
            include 'auth/register.php';
        } else {
            sendError('Method not allowed', 405);
        }
        break;
        
    case 'auth/login':
        if ($method === 'POST') {
            include 'auth/login.php';
        } else {
            sendError('Method not allowed', 405);
        }
        break;
        
    case 'products':
        if ($method === 'GET') {
            include 'products/get_products.php';
        } else {
            sendError('Method not allowed', 405);
        }
        break;
        
    case 'products/' . (isset($_GET['id']) ? $_GET['id'] : ''):
        if ($method === 'GET') {
            include 'products/get_product.php';
        } else {
            sendError('Method not allowed', 405);
        }
        break;
        
    case 'categories':
        if ($method === 'GET') {
            include 'categories/get_categories.php';
        } else {
            sendError('Method not allowed', 405);
        }
        break;
        
    case 'cart':
        if ($method === 'GET') {
            include 'cart/get_cart.php';
        } elseif ($method === 'POST') {
            include 'cart/add_to_cart.php';
        } elseif ($method === 'PUT') {
            include 'cart/update_cart.php';
        } elseif ($method === 'DELETE') {
            include 'cart/remove_from_cart.php';
        } else {
            sendError('Method not allowed', 405);
        }
        break;
        
    case 'admin':
    case 'admin/login':
    case 'admin/check_auth':
    case 'admin/dashboard':
    case 'admin/logout':
        // Route admin requests to admin router
        error_log("Routing to admin API for path: " . $path);
        include 'admin/index.php';
        break;
        
    default:
        sendError('Endpoint not found', 404);
        break;
}
?>
