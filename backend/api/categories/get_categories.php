<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

try {
    $stmt = $pdo->prepare("SELECT * FROM categories ORDER BY category_name");
    $stmt->execute();
    $categories = $stmt->fetchAll();
    
    sendResponse($categories, 'Categories retrieved successfully');
    
} catch (PDOException $e) {
    sendError('Failed to retrieve categories', 500);
}
?>
