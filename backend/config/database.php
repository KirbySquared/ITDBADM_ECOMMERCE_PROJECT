<?php
// Database configuration for remote MySQL server via SSH tunnel
// You need to establish an SSH tunnel first before running the application
// Command: ssh -L 3307:127.0.0.1:3306 student1@ccscloud.dlsu.edu.ph -p 21010
define('DB_HOST', '127.0.0.1:3307'); // Localhost with port 3307 to avoid conflict with MySQL Workbench
define('DB_NAME', 'electronics_store'); // You may need to create this database on the remote server
define('DB_USER', 'student1');
define('DB_PASS', 'Dlsu1234!'); // You'll need to set your password here

// JWT Secret for authentication - CHANGE THIS IN PRODUCTION!
define('JWT_SECRET', 'electronics_store_jwt_secret_key_2024_secure_random_string');

// API Configuration
define('API_BASE_URL', 'http://localhost/gamestore/api');

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
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit();
}
?>
