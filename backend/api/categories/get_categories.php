<?php
require_once '../../config/database.php';
require_once '../../utils/response.php';

try {
    $stmt = $pdo->prepare("SELECT * FROM categories ORDER BY name");
    $stmt->execute();
    $categories = $stmt->fetchAll();
    
    sendResponse($categories, 'Categories retrieved successfully');
    
} catch (PDOException $e) {
    sendError('Failed to retrieve categories', 500);
}
?>
