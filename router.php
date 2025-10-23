<?php
/**
 * PHP BUILT-IN SERVER ROUTER
 * 
 * This file routes all API requests to the backend and handles CORS.
 * Used by: php -S localhost:8000 router.php
 * 
 * ROUTING:
 * - /api/* requests → backend/api/index.php
 * - All other requests → handled normally by PHP server
 * 
 * CORS:
 * - Sets headers for React frontend (localhost:5173)
 * - Handles preflight OPTIONS requests
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Route API requests to backend
if (strpos($uri, '/api/') === 0) {
    // Set CORS headers for React frontend
    header('Access-Control-Allow-Origin: http://localhost:5173');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Credentials: true');

    // Handle CORS preflight requests
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }

    // Route to main API handler
    include __DIR__ . '/backend/api/index.php';
    return true;
}

// Let PHP server handle non-API requests normally
return false;
?>
