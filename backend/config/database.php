<?php
// Database configuration for remote MySQL server via SSH tunnel
// Now supports environment variables via backend/.env (not committed to VCS)
// If .env is missing, sensible local defaults are used.

// Load environment variables from backend/.env if present
// Simple, dependency-free loader: KEY=VALUE per line, '#' for comments
$__envPath = __DIR__ . '/../.env';
if (file_exists($__envPath) && is_readable($__envPath)) {
    $lines = file($__envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $trim = trim($line);
        if ($trim === '' || $trim[0] === '#') continue;
        $parts = explode('=', $trim, 2);
        if (count($parts) !== 2) continue;
        $key = trim($parts[0]);
        $value = trim($parts[1]);
        // Strip surrounding quotes if present
        if ((strlen($value) >= 2) && (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'"))) {
            $value = substr($value, 1, -1);
        }
        $_ENV[$key] = $value;
        putenv($key . '=' . $value);
    }
}

// Start output buffering to prevent any accidental output
if (!ob_get_level()) {
    ob_start();
}

define('DB_HOST', getenv('DB_HOST'));
define('DB_NAME', getenv('DB_NAME'));
define('DB_USER', getenv('DB_USER'));
define('DB_PASS', getenv('DB_PASS'));

// JWT Secret for authentication - CHANGE THIS IN PRODUCTION!
define('JWT_SECRET', getenv('JWT_SECRET') ?: 'electronics_store_jwt_secret_key_2024_secure_random_string');

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
    
    // Set transaction isolation level to READ COMMITTED
    // This prevents dirty reads while allowing better concurrency than SERIALIZABLE
    // For e-commerce, this balances consistency and performance
    $pdo->exec("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
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
