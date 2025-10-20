<?php
require_once '../../config/database.php';
require_once '../../utils/response.php';

// Get query parameters
$category = $_GET['category'] ?? null;
$page = max(1, intval($_GET['page'] ?? 1));
$limit = min(50, max(1, intval($_GET['limit'] ?? 12)));
$offset = ($page - 1) * $limit;

// Build query
$sql = "SELECT p.*, c.name as category_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id";
$params = [];

if ($category) {
    $sql .= " WHERE c.name = ?";
    $params[] = $category;
}

$sql .= " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
$params[] = $limit;
$params[] = $offset;

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $products = $stmt->fetchAll();
    
    // Get total count for pagination
    $countSql = "SELECT COUNT(*) FROM products p LEFT JOIN categories c ON p.category_id = c.id";
    $countParams = [];
    
    if ($category) {
        $countSql .= " WHERE c.name = ?";
        $countParams[] = $category;
    }
    
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($countParams);
    $total = $countStmt->fetchColumn();
    
    sendResponse([
        'products' => $products,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => ceil($total / $limit)
        ]
    ], 'Products retrieved successfully');
    
} catch (PDOException $e) {
    sendError('Failed to retrieve products', 500);
}
?>
