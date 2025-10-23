<?php
/**
 * PRODUCTS CRUD API ENDPOINT
 * 
 * This endpoint handles all product management operations for admins.
 * 
 * ROUTES:
 * - GET /api/admin/products - List all products with pagination and filters
 * - POST /api/admin/products - Create new product
 * - GET /api/admin/products/{id} - Get specific product details
 * - PUT /api/admin/products/{id} - Update product
 * - DELETE /api/admin/products/{id} - Delete product
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token
 * - Validates admin role
 * - Returns 403 if not admin
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

// Get authorization header
$headers = getallheaders();
$token = null;

if (isset($headers['Authorization'])) {
    $token = str_replace('Bearer ', '', $headers['Authorization']);
}

if (!$token) {
    sendError('Authorization token required', 401);
}

// Validate token
$userId = validateToken($token);
if (!$userId) {
    sendError('Invalid or expired token', 401);
}

// Check if user is admin
try {
    $stmt = $pdo->prepare("SELECT role FROM users WHERE user_id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    
    if (!$user || $user['role'] !== 'admin') {
        sendError('Admin access required', 403);
    }
} catch (PDOException $e) {
    sendError('Database error', 500);
}

// Get request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$pathParts = explode('/', trim($path, '/'));

// Extract product ID if present
$productIdParam = null;
if (count($pathParts) >= 4 && is_numeric($pathParts[3])) {
    $productIdParam = intval($pathParts[3]);
}

try {
    switch ($method) {
        case 'GET':
            if ($productIdParam) {
                // Get specific product with category name
                $stmt = $pdo->prepare("
                    SELECT p.*, c.category_name 
                    FROM products p 
                    LEFT JOIN categories c ON p.category_id = c.category_id 
                    WHERE p.product_id = ?
                ");
                $stmt->execute([$productIdParam]);
                $product = $stmt->fetch();
                
                if (!$product) {
                    sendError('Product not found', 404);
                }
                
                sendResponse($product, 'Product retrieved successfully');
            } else {
                // List products with pagination and filters
                $page = max(1, intval($_GET['page'] ?? 1));
                $limit = min(100, max(1, intval($_GET['limit'] ?? 10)));
                $offset = ($page - 1) * $limit;
                
                $search = $_GET['search'] ?? '';
                $category = $_GET['category'] ?? 'all';
                
                // Build query
                $whereConditions = [];
                $params = [];
                
                if ($search) {
                    $whereConditions[] = "(p.product_name LIKE ? OR p.brand LIKE ? OR p.model LIKE ?)";
                    $searchTerm = "%$search%";
                    $params = array_merge($params, [$searchTerm, $searchTerm, $searchTerm]);
                }
                
                if ($category !== 'all') {
                    $whereConditions[] = "c.category_name = ?";
                    $params[] = $category;
                }
                
                $whereClause = $whereConditions ? 'WHERE ' . implode(' AND ', $whereConditions) : '';
                
                // Get products with category name
                $sql = "SELECT p.*, c.category_name 
                        FROM products p 
                        LEFT JOIN categories c ON p.category_id = c.category_id 
                        $whereClause
                        ORDER BY p.created_at DESC 
                        LIMIT ? OFFSET ?";
                
                $params[] = $limit;
                $params[] = $offset;
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $products = $stmt->fetchAll();
                
                // Get total count
                $countSql = "SELECT COUNT(*) 
                            FROM products p 
                            LEFT JOIN categories c ON p.category_id = c.category_id 
                            $whereClause";
                $countStmt = $pdo->prepare($countSql);
                $countStmt->execute(array_slice($params, 0, -2)); // Remove limit and offset
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
            }
            break;
            
        case 'POST':
            // Create new product
            $input = json_decode(file_get_contents('php://input'), true);
            
            $errors = validateRequired($input, ['product_name', 'brand', 'price', 'category_id']);
            if (!empty($errors)) {
                sendError('Validation failed', 400, $errors);
            }
            
            // Validate price
            if (!is_numeric($input['price']) || $input['price'] < 0) {
                sendError('Price must be a positive number', 400);
            }
            
            // Validate stock quantity
            if (isset($input['stock_quantity']) && (!is_numeric($input['stock_quantity']) || $input['stock_quantity'] < 0)) {
                sendError('Stock quantity must be a non-negative number', 400);
            }
            
            // Check if category exists
            $stmt = $pdo->prepare("SELECT category_id FROM categories WHERE category_id = ?");
            $stmt->execute([$input['category_id']]);
            if (!$stmt->fetch()) {
                sendError('Category not found', 404);
            }
            
            // Insert product
            $stmt = $pdo->prepare("
                INSERT INTO products (category_id, product_name, brand, model, description, price, currency, stock_quantity, specifications, image_url) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            $stmt->execute([
                $input['category_id'],
                $input['product_name'],
                $input['brand'],
                $input['model'] ?? null,
                $input['description'] ?? null,
                $input['price'],
                $input['currency'] ?? 'USD',
                $input['stock_quantity'] ?? 0,
                isset($input['specifications']) ? json_encode($input['specifications']) : null,
                $input['image_url'] ?? null
            ]);
            
            $newProductId = $pdo->lastInsertId();
            
            // Get created product with category name
            $stmt = $pdo->prepare("
                SELECT p.*, c.category_name 
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                WHERE p.product_id = ?
            ");
            $stmt->execute([$newProductId]);
            $newProduct = $stmt->fetch();
            
            sendResponse($newProduct, 'Product created successfully', 201);
            break;
            
        case 'PUT':
            // Update product
            if (!$productIdParam) {
                sendError('Product ID required', 400);
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Check if product exists
            $stmt = $pdo->prepare("SELECT product_id FROM products WHERE product_id = ?");
            $stmt->execute([$productIdParam]);
            if (!$stmt->fetch()) {
                sendError('Product not found', 404);
            }
            
            // Validate price if provided
            if (isset($input['price']) && (!is_numeric($input['price']) || $input['price'] < 0)) {
                sendError('Price must be a positive number', 400);
            }
            
            // Validate stock quantity if provided
            if (isset($input['stock_quantity']) && (!is_numeric($input['stock_quantity']) || $input['stock_quantity'] < 0)) {
                sendError('Stock quantity must be a non-negative number', 400);
            }
            
            // Check if category exists if provided
            if (isset($input['category_id'])) {
                $stmt = $pdo->prepare("SELECT category_id FROM categories WHERE category_id = ?");
                $stmt->execute([$input['category_id']]);
                if (!$stmt->fetch()) {
                    sendError('Category not found', 404);
                }
            }
            
            // Build update query
            $updateFields = [];
            $params = [];
            
            $allowedFields = ['category_id', 'product_name', 'brand', 'model', 'description', 'price', 'currency', 'stock_quantity', 'image_url'];
            foreach ($allowedFields as $field) {
                if (isset($input[$field])) {
                    $updateFields[] = "$field = ?";
                    $params[] = $input[$field];
                }
            }
            
            // Handle specifications update
            if (isset($input['specifications'])) {
                $updateFields[] = "specifications = ?";
                $params[] = json_encode($input['specifications']);
            }
            
            if (empty($updateFields)) {
                sendError('No fields to update', 400);
            }
            
            $params[] = $productIdParam;
            
            $sql = "UPDATE products SET " . implode(', ', $updateFields) . " WHERE product_id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            
            // Get updated product with category name
            $stmt = $pdo->prepare("
                SELECT p.*, c.category_name 
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                WHERE p.product_id = ?
            ");
            $stmt->execute([$productIdParam]);
            $updatedProduct = $stmt->fetch();
            
            sendResponse($updatedProduct, 'Product updated successfully');
            break;
            
        case 'DELETE':
            // Delete product
            if (!$productIdParam) {
                sendError('Product ID required', 400);
            }
            
            // Check if product exists
            $stmt = $pdo->prepare("SELECT product_id FROM products WHERE product_id = ?");
            $stmt->execute([$productIdParam]);
            if (!$stmt->fetch()) {
                sendError('Product not found', 404);
            }
            
            // Delete product (cascade will handle related records like product_images)
            $stmt = $pdo->prepare("DELETE FROM products WHERE product_id = ?");
            $stmt->execute([$productIdParam]);
            
            sendResponse(null, 'Product deleted successfully');
            break;
            
        default:
            sendError('Method not allowed', 405);
            break;
    }
} catch (PDOException $e) {
    sendError('Database error: ' . $e->getMessage(), 500);
}
?>
