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
        SELECT p.*, c.category_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.category_id 
        WHERE p.product_id = ?
    ");
    
    $stmt->execute([$productId]);
    $product = $stmt->fetch();
    
    if (!$product) {
        sendError('Product not found', 404);
    }
    
    // Get images for this product
    $stmt = $pdo->prepare("
        SELECT image_id, image_url, alt_text, is_primary, sort_order, created_at
        FROM product_images 
        WHERE product_id = ? 
        ORDER BY is_primary DESC, sort_order ASC, created_at ASC
    ");
    $stmt->execute([$productId]);
    $product['images'] = $stmt->fetchAll();
    
    sendResponse($product, 'Product retrieved successfully');
    
} catch (PDOException $e) {
    sendError('Failed to retrieve product', 500);
}
?>
