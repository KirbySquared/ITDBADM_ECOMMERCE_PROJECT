<?php
require_once '../../config/database.php';
require_once '../../utils/response.php';

// Get product ID from URL
$productId = $_GET['id'] ?? null;

if (!$productId || !is_numeric($productId)) {
    sendError('Invalid product ID', 400);
}

try {
    $stmt = $pdo->prepare("
        SELECT p.*, c.name as category_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.id = ?
    ");
    
    $stmt->execute([$productId]);
    $product = $stmt->fetch();
    
    if (!$product) {
        sendError('Product not found', 404);
    }
    
    sendResponse($product, 'Product retrieved successfully');
    
} catch (PDOException $e) {
    sendError('Failed to retrieve product', 500);
}
?>
