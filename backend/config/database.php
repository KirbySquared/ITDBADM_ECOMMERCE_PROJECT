<?php
// Database configuration for remote MySQL server via SSH tunnel
// You need to establish an SSH tunnel first before running the application
// Command: ssh -L 3307:127.0.0.1:3306 student1@ccscloud.dlsu.edu.ph -p 21010

// Start output buffering to prevent any accidental output
if (!ob_get_level()) {
    ob_start();
}

define('DB_HOST', '127.0.0.1:3307'); // Localhost with port 3307 to avoid conflict with MySQL Workbench
define('DB_NAME', 'electronics_store'); // You may need to create this database on the remote server
define('DB_USER', 'student1');
define('DB_PASS', 'Dlsu1234!'); // You'll need to set your password here

// JWT Secret for authentication - CHANGE THIS IN PRODUCTION!
define('JWT_SECRET', 'electronics_store_jwt_secret_key_2024_secure_random_string');

// API Configuration - Update this based on your server setup
define('API_BASE_URL', 'http://localhost:8000/api'); // For PHP built-in server
// define('API_BASE_URL', 'http://localhost/gamestore/api'); // For Apache/Nginx

// Check if we're being called from an API endpoint (not a direct call)
if (!defined('IN_API_REQUEST')) {
    define('IN_API_REQUEST', true);
}

// Database connection
try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
} catch (PDOException $e) {
    // Clean any output
    if (ob_get_level()) ob_clean();
    
    http_response_code(500);
    header('Content-Type: application/json');
    
    if (defined('IN_API_REQUEST') && IN_API_REQUEST) {
        echo json_encode([
            'success' => false,
            'message' => 'Database connection failed',
            'error' => $e->getMessage()
        ]);
    } else {
        echo json_encode(['error' => 'Database connection failed']);
    }
    exit();
}
?>
