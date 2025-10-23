<?php
/**
 * CATEGORIES CRUD API ENDPOINT
 * 
 * This endpoint handles all category management operations for admins.
 * 
 * ROUTES:
 * - GET /api/admin/categories - List all categories with pagination and filters
 * - POST /api/admin/categories - Create new category
 * - GET /api/admin/categories/{id} - Get specific category details
 * - PUT /api/admin/categories/{id} - Update category
 * - DELETE /api/admin/categories/{id} - Delete category
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

// Extract category ID if present
$categoryIdParam = null;
if (count($pathParts) >= 4 && is_numeric($pathParts[3])) {
    $categoryIdParam = intval($pathParts[3]);
}

try {
    switch ($method) {
        case 'GET':
            if ($categoryIdParam) {
                // Get specific category with product count
                $stmt = $pdo->prepare("
                    SELECT c.*, 
                           COUNT(p.product_id) as product_count
                    FROM categories c
                    LEFT JOIN products p ON c.category_id = p.category_id
                    WHERE c.category_id = ?
                    GROUP BY c.category_id
                ");
                $stmt->execute([$categoryIdParam]);
                $category = $stmt->fetch();
                
                if (!$category) {
                    sendError('Category not found', 404);
                }
                
                sendResponse($category, 'Category retrieved successfully');
            } else {
                // List categories with pagination and filters
                $page = max(1, intval($_GET['page'] ?? 1));
                $limit = min(100, max(1, intval($_GET['limit'] ?? 10)));
                $offset = ($page - 1) * $limit;
                
                $search = $_GET['search'] ?? '';
                
                // Build query
                $whereConditions = [];
                $params = [];
                
                if ($search) {
                    $whereConditions[] = "(category_name LIKE ? OR description LIKE ?)";
                    $searchTerm = "%$search%";
                    $params = array_merge($params, [$searchTerm, $searchTerm]);
                }
                
                $whereClause = $whereConditions ? 'WHERE ' . implode(' AND ', $whereConditions) : '';
                
                // Get categories with product count
                $sql = "SELECT c.*, 
                               COUNT(p.product_id) as product_count
                        FROM categories c
                        LEFT JOIN products p ON c.category_id = p.category_id
                        $whereClause
                        GROUP BY c.category_id
                        ORDER BY c.category_name ASC 
                        LIMIT ? OFFSET ?";
                
                $params[] = $limit;
                $params[] = $offset;
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $categories = $stmt->fetchAll();
                
                // Get total count
                $countSql = "SELECT COUNT(*) FROM categories $whereClause";
                $countStmt = $pdo->prepare($countSql);
                $countStmt->execute(array_slice($params, 0, -2)); // Remove limit and offset
                $total = $countStmt->fetchColumn();
                
                sendResponse([
                    'categories' => $categories,
                    'pagination' => [
                        'page' => $page,
                        'limit' => $limit,
                        'total' => $total,
                        'pages' => ceil($total / $limit)
                    ]
                ], 'Categories retrieved successfully');
            }
            break;
            
        case 'POST':
            // Create new category
            $input = json_decode(file_get_contents('php://input'), true);
            
            $errors = validateRequired($input, ['category_name']);
            if (!empty($errors)) {
                sendError('Validation failed', 400, $errors);
            }
            
            // Check if category name already exists
            $stmt = $pdo->prepare("SELECT category_id FROM categories WHERE category_name = ?");
            $stmt->execute([$input['category_name']]);
            if ($stmt->fetch()) {
                sendError('Category name already exists', 409);
            }
            
            // Insert category
            $stmt = $pdo->prepare("
                INSERT INTO categories (category_name, description) 
                VALUES (?, ?)
            ");
            
            $stmt->execute([
                $input['category_name'],
                $input['description'] ?? null
            ]);
            
            $newCategoryId = $pdo->lastInsertId();
            
            // Get created category
            $stmt = $pdo->prepare("
                SELECT c.*, 
                       COUNT(p.product_id) as product_count
                FROM categories c
                LEFT JOIN products p ON c.category_id = p.category_id
                WHERE c.category_id = ?
                GROUP BY c.category_id
            ");
            $stmt->execute([$newCategoryId]);
            $newCategory = $stmt->fetch();
            
            sendResponse($newCategory, 'Category created successfully', 201);
            break;
            
        case 'PUT':
            // Update category
            if (!$categoryIdParam) {
                sendError('Category ID required', 400);
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Check if category exists
            $stmt = $pdo->prepare("SELECT category_id FROM categories WHERE category_id = ?");
            $stmt->execute([$categoryIdParam]);
            if (!$stmt->fetch()) {
                sendError('Category not found', 404);
            }
            
            // Check if category name already exists (excluding current category)
            if (isset($input['category_name'])) {
                $stmt = $pdo->prepare("SELECT category_id FROM categories WHERE category_name = ? AND category_id != ?");
                $stmt->execute([$input['category_name'], $categoryIdParam]);
                if ($stmt->fetch()) {
                    sendError('Category name already exists', 409);
                }
            }
            
            // Build update query
            $updateFields = [];
            $params = [];
            
            $allowedFields = ['category_name', 'description'];
            foreach ($allowedFields as $field) {
                if (isset($input[$field])) {
                    $updateFields[] = "$field = ?";
                    $params[] = $input[$field];
                }
            }
            
            if (empty($updateFields)) {
                sendError('No fields to update', 400);
            }
            
            $params[] = $categoryIdParam;
            
            $sql = "UPDATE categories SET " . implode(', ', $updateFields) . " WHERE category_id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            
            // Get updated category with product count
            $stmt = $pdo->prepare("
                SELECT c.*, 
                       COUNT(p.product_id) as product_count
                FROM categories c
                LEFT JOIN products p ON c.category_id = p.category_id
                WHERE c.category_id = ?
                GROUP BY c.category_id
            ");
            $stmt->execute([$categoryIdParam]);
            $updatedCategory = $stmt->fetch();
            
            sendResponse($updatedCategory, 'Category updated successfully');
            break;
            
        case 'DELETE':
            // Delete category
            if (!$categoryIdParam) {
                sendError('Category ID required', 400);
            }
            
            // Check if category exists
            $stmt = $pdo->prepare("SELECT category_id FROM categories WHERE category_id = ?");
            $stmt->execute([$categoryIdParam]);
            if (!$stmt->fetch()) {
                sendError('Category not found', 404);
            }
            
            // Check if category has products
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM products WHERE category_id = ?");
            $stmt->execute([$categoryIdParam]);
            $productCount = $stmt->fetchColumn();
            
            if ($productCount > 0) {
                sendError('Cannot delete category with existing products. Please move or delete products first.', 409);
            }
            
            // Delete category
            $stmt = $pdo->prepare("DELETE FROM categories WHERE category_id = ?");
            $stmt->execute([$categoryIdParam]);
            
            sendResponse(null, 'Category deleted successfully');
            break;
            
        default:
            sendError('Method not allowed', 405);
            break;
    }
} catch (PDOException $e) {
    sendError('Database error: ' . $e->getMessage(), 500);
}
?>
