<?php
require_once 'config/database.php';

echo "=== Electronics Store Database Connection Test ===\n\n";

echo "Testing database connection...\n";
echo "Host: " . DB_HOST . "\n";
echo "Database: " . DB_NAME . "\n";
echo "User: " . DB_USER . "\n";
echo "Password: " . (empty(DB_PASS) ? "❌ NOT SET" : "✅ SET") . "\n\n";

// Check if password is set
if (empty(DB_PASS)) {
    echo "❌ Database password is not set!\n";
    echo "Please edit backend/config/database.php and set DB_PASS\n";
    exit(1);
}

echo "Attempting to connect...\n";

try {
    // Test the connection
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
    
    echo "✅ Database connection successful!\n";
    
    // Test a simple query
    $stmt = $pdo->query("SELECT VERSION() as version");
    $version = $stmt->fetch();
    echo "MySQL Version: " . $version['version'] . "\n";
    
    // Check if our database exists and show tables
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (empty($tables)) {
        echo "⚠️  No tables found in database. You may need to create the database schema.\n";
    } else {
        echo "📋 Tables found:\n";
        foreach ($tables as $tableName) {
            echo "  - " . $tableName . "\n";
        }
    }
    
} catch (PDOException $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "\n";
    echo "\nTroubleshooting tips:\n";
    echo "1. Make sure you've established the SSH tunnel:\n";
    echo "   ssh -L 3307:127.0.0.1:3306 student1@ccscloud.dlsu.edu.ph -p 21010\n";
    echo "2. Check if the database 'electronics_store' exists on the remote server\n";
    echo "3. Verify your password is correct in config/database.php\n";
    echo "4. Make sure the remote MySQL server is running\n";
}
?>
