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
 * INVENTORY MANAGEMENT:
 * - Uses product_inventory table for stock management
 * - By default uses branch_id = 1 for all inventory operations
 * - Stock quantity is managed per branch (branch management page will handle multi-branch)
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
                // Get specific product with category name, stock from product_inventory, and images
                // Price is stored in PHP (base currency)
                // Get the branch_id from product_inventory if it exists, otherwise use the selected branch or default to 1
                $requestedBranchId = isset($_GET['branch_id']) ? (int)$_GET['branch_id'] : null;
                
                // First, try to get inventory from the requested branch, or get the first available branch
                if ($requestedBranchId) {
                    $checkStmt = $pdo->prepare("SELECT branch_id FROM product_inventory WHERE product_id = ? AND branch_id = ? LIMIT 1");
                    $checkStmt->execute([$productIdParam, $requestedBranchId]);
                    $hasInventory = $checkStmt->fetch();
                    if (!$hasInventory) {
                        // If no inventory in requested branch, get the first available branch
                        $firstBranchStmt = $pdo->prepare("SELECT branch_id FROM product_inventory WHERE product_id = ? ORDER BY branch_id LIMIT 1");
                        $firstBranchStmt->execute([$productIdParam]);
                        $firstBranch = $firstBranchStmt->fetch();
                        $branchId = $firstBranch ? (int)$firstBranch['branch_id'] : ($requestedBranchId ?: 1);
                    } else {
                        $branchId = $requestedBranchId;
                    }
                } else {
                    // Get the first available branch for this product
                    $firstBranchStmt = $pdo->prepare("SELECT branch_id FROM product_inventory WHERE product_id = ? ORDER BY branch_id LIMIT 1");
                    $firstBranchStmt->execute([$productIdParam]);
                    $firstBranch = $firstBranchStmt->fetch();
                    $branchId = $firstBranch ? (int)$firstBranch['branch_id'] : 1;
                }
                
                $stmt = $pdo->prepare("
                    SELECT 
                        p.product_id,
                        p.category_id,
                        p.product_name,
                        p.brand,
                        p.model,
                        p.description,
                        CAST(p.price AS DECIMAL(10,2)) AS price,
                        'PHP' AS currency,
                        p.specifications,
                        p.created_at,
                        p.updated_at,
                        c.category_name,
                        COALESCE(pi.stock_qty, 0) AS stock_quantity,
                        pi.branch_id,
                        b.branch_name
                    FROM products p 
                    LEFT JOIN categories c ON p.category_id = c.category_id 
                    LEFT JOIN product_inventory pi ON p.product_id = pi.product_id AND pi.branch_id = ?
                    LEFT JOIN branches b ON b.branch_id = pi.branch_id
                    WHERE p.product_id = ?
                ");
                $stmt->execute([$branchId, $productIdParam]);
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
                $stmt->execute([$productIdParam]);
                $product['images'] = $stmt->fetchAll();
                
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
                $branchId = isset($_GET['branch_id']) ? (int)$_GET['branch_id'] : 1; // Default to branch 1
                
                // Get products with category name, stock from selected branch, and branch info
                // Price is stored in PHP (base currency), currency conversion happens dynamically
                $sql = "SELECT 
                            p.product_id,
                            p.category_id,
                            p.product_name,
                            p.brand,
                            p.model,
                            p.description,
                            CAST(p.price AS DECIMAL(10,2)) AS price,
                            'PHP' AS currency,
                            p.specifications,
                            p.created_at,
                            p.updated_at,
                            c.category_name,
                            COALESCE(pi.stock_qty, 0) AS stock_quantity,
                            ? AS branch_id,
                            b.branch_name
                        FROM products p 
                        LEFT JOIN categories c ON p.category_id = c.category_id 
                        LEFT JOIN product_inventory pi ON p.product_id = pi.product_id AND pi.branch_id = ?
                        LEFT JOIN branches b ON b.branch_id = ?
                        $whereClause
                        ORDER BY p.created_at DESC 
                        LIMIT ? OFFSET ?";
                
                // Add branch_id parameters (3 times: for branch_id column, pi.branch_id join, and b.branch_id join)
                // Then add limit and offset
                $branchParams = [$branchId, $branchId, $branchId];
                $allParams = array_merge($params, $branchParams, [$limit, $offset]);
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($allParams);
                $products = $stmt->fetchAll();
                
                // Fetch images for each product
                foreach ($products as &$product) {
                    $stmt = $pdo->prepare("
                        SELECT image_id, image_url, alt_text, is_primary, sort_order, created_at
                        FROM product_images 
                        WHERE product_id = ? 
                        ORDER BY is_primary DESC, sort_order ASC, created_at ASC
                    ");
                    $stmt->execute([$product['product_id']]);
                    $product['images'] = $stmt->fetchAll();
                }
                
                // Get total count (without GROUP BY for count)
                $countSql = "SELECT COUNT(DISTINCT p.product_id) 
                            FROM products p 
                            LEFT JOIN categories c ON p.category_id = c.category_id 
                            $whereClause";
                $countStmt = $pdo->prepare($countSql);
                $countStmt->execute($params); // No branch params needed for count
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
            
            // Validate currency and convert price to PHP (base currency)
            $currency = strtoupper($input['currency'] ?? 'PHP');
            $allowedCurrencies = ['PHP', 'USD', 'KRW'];
            if (!in_array($currency, $allowedCurrencies)) {
                sendError('Invalid currency. Allowed: PHP, USD, KRW', 400);
            }
            
            // Get currency rate to convert to PHP
            // rate_to_php converts FROM PHP TO currency, so to convert FROM currency TO PHP, we divide
            $priceInPhp = floatval($input['price']);
            if ($currency !== 'PHP') {
                $curStmt = $pdo->prepare("SELECT rate_to_php FROM currencies WHERE code = ? AND is_active = 1 LIMIT 1");
                $curStmt->execute([$currency]);
                $curRow = $curStmt->fetch();
                if (!$curRow) {
                    sendError('Invalid or inactive currency', 400);
                }
                $rate = floatval($curRow['rate_to_php']);
                if ($rate <= 0) {
                    sendError('Invalid currency rate', 400);
                }
                // Convert from selected currency to PHP: divide by rate_to_php
                // Example: if 1 PHP = 0.018 USD (rate_to_php = 0.018), then 1 USD = 1/0.018 = 55.56 PHP
                $priceInPhp = floatval($input['price']) / $rate;
            }
            
            // Check if category exists
            $stmt = $pdo->prepare("SELECT category_id FROM categories WHERE category_id = ?");
            $stmt->execute([$input['category_id']]);
            if (!$stmt->fetch()) {
                sendError('Category not found', 404);
            }
            
            // Insert product - price is stored in PHP (base currency)
            $stmt = $pdo->prepare("
                INSERT INTO products (category_id, product_name, brand, model, description, price, specifications) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            
            $stmt->execute([
                $input['category_id'],
                $input['product_name'],
                $input['brand'],
                $input['model'] ?? null,
                $input['description'] ?? null,
                $priceInPhp, // Store price in PHP
                isset($input['specifications']) ? json_encode($input['specifications']) : null
            ]);
            
            $newProductId = $pdo->lastInsertId();
            
            // Handle inventory if stock_quantity is provided (use branch_id from input or default to 1)
            $branchId = isset($input['branch_id']) ? (int)$input['branch_id'] : 1;
            if (isset($input['stock_quantity']) && is_numeric($input['stock_quantity']) && $input['stock_quantity'] >= 0) {
                // Check if inventory entry exists for the selected branch
                $checkStmt = $pdo->prepare("SELECT stock_qty FROM product_inventory WHERE product_id = ? AND branch_id = ?");
                $checkStmt->execute([$newProductId, $branchId]);
                $existing = $checkStmt->fetch();
                
                if ($existing) {
                    // Update existing inventory
                    $invStmt = $pdo->prepare("UPDATE product_inventory SET stock_qty = ? WHERE product_id = ? AND branch_id = ?");
                    $invStmt->execute([intval($input['stock_quantity']), $newProductId, $branchId]);
                } else {
                    // Insert new inventory entry for the selected branch
                    $invStmt = $pdo->prepare("INSERT INTO product_inventory (product_id, branch_id, stock_qty) VALUES (?, ?, ?)");
                    $invStmt->execute([$newProductId, $branchId, intval($input['stock_quantity'])]);
                }
            }
            
            // Get created product with category name and stock from selected branch
            // Price is stored in PHP (base currency)
            $stmt = $pdo->prepare("
                SELECT 
                    p.product_id,
                    p.category_id,
                    p.product_name,
                    p.brand,
                    p.model,
                    p.description,
                    CAST(p.price AS DECIMAL(10,2)) AS price,
                    'PHP' AS currency,
                    p.specifications,
                    p.created_at,
                    p.updated_at,
                    c.category_name,
                    COALESCE(pi.stock_qty, 0) AS stock_quantity,
                    ? AS branch_id,
                    b.branch_name
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                LEFT JOIN product_inventory pi ON p.product_id = pi.product_id AND pi.branch_id = ?
                LEFT JOIN branches b ON b.branch_id = ?
                WHERE p.product_id = ?
            ");
            $stmt->execute([$branchId, $branchId, $branchId, $newProductId]);
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
            
            // Handle currency conversion if price and currency are provided
            $priceInPhp = null;
            if (isset($input['price'])) {
                $currency = strtoupper($input['currency'] ?? 'PHP');
                $allowedCurrencies = ['PHP', 'USD', 'KRW'];
                if (isset($input['currency']) && !in_array($currency, $allowedCurrencies)) {
                    sendError('Invalid currency. Allowed: PHP, USD, KRW', 400);
                }
                
                // Convert price to PHP (base currency)
                // rate_to_php converts FROM PHP TO currency, so to convert FROM currency TO PHP, we divide
                $priceInPhp = floatval($input['price']);
                if ($currency !== 'PHP') {
                    $curStmt = $pdo->prepare("SELECT rate_to_php FROM currencies WHERE code = ? AND is_active = 1 LIMIT 1");
                    $curStmt->execute([$currency]);
                    $curRow = $curStmt->fetch();
                    if (!$curRow) {
                        sendError('Invalid or inactive currency', 400);
                    }
                    $rate = floatval($curRow['rate_to_php']);
                    if ($rate <= 0) {
                        sendError('Invalid currency rate', 400);
                    }
                    // Convert from selected currency to PHP: divide by rate_to_php
                    $priceInPhp = floatval($input['price']) / $rate;
                }
            }
            
            // Check if category exists if provided
            if (isset($input['category_id'])) {
                $stmt = $pdo->prepare("SELECT category_id FROM categories WHERE category_id = ?");
                $stmt->execute([$input['category_id']]);
                if (!$stmt->fetch()) {
                    sendError('Category not found', 404);
                }
            }
            
            // Build update query (exclude stock_quantity and currency - price is stored in PHP)
            $updateFields = [];
            $params = [];
            
            $allowedFields = ['category_id', 'product_name', 'brand', 'model', 'description'];
            foreach ($allowedFields as $field) {
                if (isset($input[$field])) {
                    $updateFields[] = "$field = ?";
                    $params[] = $input[$field];
                }
            }
            
            // Add price (converted to PHP) if provided
            if ($priceInPhp !== null) {
                $updateFields[] = "price = ?";
                $params[] = $priceInPhp;
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
            
            // Handle inventory update if stock_quantity is provided
            // Use branch_id from input (which should come from the product's existing inventory)
            $branchId = isset($input['branch_id']) ? (int)$input['branch_id'] : null;
            
            if (isset($input['stock_quantity']) && is_numeric($input['stock_quantity'])) {
                // If branch_id is provided, use it; otherwise get the first branch for this product
                if (!$branchId) {
                    $firstBranchStmt = $pdo->prepare("SELECT branch_id FROM product_inventory WHERE product_id = ? ORDER BY branch_id LIMIT 1");
                    $firstBranchStmt->execute([$productIdParam]);
                    $firstBranch = $firstBranchStmt->fetch();
                    $branchId = $firstBranch ? (int)$firstBranch['branch_id'] : 1;
                }
                
                // Check if inventory entry exists for this branch
                $checkStmt = $pdo->prepare("SELECT stock_qty FROM product_inventory WHERE product_id = ? AND branch_id = ?");
                $checkStmt->execute([$productIdParam, $branchId]);
                $existing = $checkStmt->fetch();
                
                if ($existing) {
                    // Update existing inventory
                    $invStmt = $pdo->prepare("UPDATE product_inventory SET stock_qty = ? WHERE product_id = ? AND branch_id = ?");
                    $invStmt->execute([intval($input['stock_quantity']), $productIdParam, $branchId]);
                } else {
                    // Insert new inventory entry for this branch
                    $invStmt = $pdo->prepare("INSERT INTO product_inventory (product_id, branch_id, stock_qty) VALUES (?, ?, ?)");
                    $invStmt->execute([$productIdParam, $branchId, intval($input['stock_quantity'])]);
                }
            } else {
                // If no stock_quantity provided but branch_id is, get it from existing inventory
                if (!$branchId) {
                    $firstBranchStmt = $pdo->prepare("SELECT branch_id FROM product_inventory WHERE product_id = ? ORDER BY branch_id LIMIT 1");
                    $firstBranchStmt->execute([$productIdParam]);
                    $firstBranch = $firstBranchStmt->fetch();
                    $branchId = $firstBranch ? (int)$firstBranch['branch_id'] : 1;
                }
            }
            
            // Get updated product with category name and stock from the branch used
            // Price is stored in PHP (base currency)
            $stmt = $pdo->prepare("
                SELECT 
                    p.product_id,
                    p.category_id,
                    p.product_name,
                    p.brand,
                    p.model,
                    p.description,
                    CAST(p.price AS DECIMAL(10,2)) AS price,
                    'PHP' AS currency,
                    p.specifications,
                    p.created_at,
                    p.updated_at,
                    c.category_name,
                    COALESCE(pi.stock_qty, 0) AS stock_quantity,
                    pi.branch_id,
                    b.branch_name
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                LEFT JOIN product_inventory pi ON p.product_id = pi.product_id AND pi.branch_id = ?
                LEFT JOIN branches b ON b.branch_id = pi.branch_id
                WHERE p.product_id = ?
            ");
            $stmt->execute([$branchId, $productIdParam]);
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
