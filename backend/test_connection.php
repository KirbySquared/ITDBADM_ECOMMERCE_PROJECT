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
echo "Note: Make sure MySQL Workbench is connected and maintaining the SSH tunnel\n\n";

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
    echo "1. Make sure MySQL Workbench is open and connected to the server\n";
    echo "2. Check if MySQL Workbench's SSH tunnel is active (green icon)\n";
    echo "3. Verify the connection string: student1@127.0.0.1::3306\n";
    echo "4. Check if the database 'electronics_store' exists on the remote server\n";
    echo "5. Verify your password is correct in config/database.php\n";
    echo "6. If MySQL Workbench is not connected, you can use SSH tunnel manually:\n";
    echo "   ssh -L 3306:127.0.0.1:3306 student1@ccscloud.dlsu.edu.ph -p 21010\n";
}
?>
