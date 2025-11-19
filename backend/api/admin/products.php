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
// Strip /api/admin from path to match router's processing
$path = str_replace('/api/admin', '', $path);
$path = ltrim($path, '/'); // Remove leading slash
$pathParts = explode('/', $path);

// Debug logging
error_log("Products.php - Full URI: " . $_SERVER['REQUEST_URI']);
error_log("Products.php - Processed path: " . $path);
error_log("Products.php - Path parts: " . json_encode($pathParts));

// Extract product ID if present
// Path format should be: products/{id}/inventory or products/{id}
$productIdParam = null;
// Check if pathParts[0] is "products" and pathParts[1] is numeric
if (count($pathParts) >= 2 && $pathParts[0] === 'products' && is_numeric($pathParts[1])) {
    $productIdParam = intval($pathParts[1]);
}

// Check if this is an inventory management request
$isInventoryRequest = isset($pathParts[2]) && $pathParts[2] === 'inventory';

error_log("Products.php - Product ID: " . ($productIdParam ?? 'null'));
error_log("Products.php - Is inventory request: " . ($isInventoryRequest ? 'yes' : 'no'));

try {
    // Handle inventory management requests
    if ($isInventoryRequest && $productIdParam) {
        switch ($method) {
            case 'GET':
                // Get all inventory entries for this product
                $stmt = $pdo->prepare("
                    SELECT 
                        pi.branch_id,
                        b.branch_name,
                        pi.stock_qty
                    FROM product_inventory pi
                    LEFT JOIN branches b ON pi.branch_id = b.branch_id
                    WHERE pi.product_id = ?
                    ORDER BY b.branch_name
                ");
                $stmt->execute([$productIdParam]);
                $inventory = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                sendResponse($inventory, 'Inventory retrieved successfully');
                break;
                
            case 'POST':
                // Add or update inventory for a branch
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!isset($input['branch_id']) || !is_numeric($input['branch_id'])) {
                    sendError('Branch ID is required', 400);
                }
                
                if (!isset($input['stock_qty']) || !is_numeric($input['stock_qty']) || $input['stock_qty'] < 0) {
                    sendError('Stock quantity must be a non-negative number', 400);
                }
                
                $branchId = (int)$input['branch_id'];
                $stockQty = (int)$input['stock_qty'];
                
                // Check if product exists
                $checkProduct = $pdo->prepare("SELECT product_id FROM products WHERE product_id = ?");
                $checkProduct->execute([$productIdParam]);
                if (!$checkProduct->fetch()) {
                    sendError('Product not found', 404);
                }
                
                // Check if branch exists
                $checkBranch = $pdo->prepare("SELECT branch_id FROM branches WHERE branch_id = ?");
                $checkBranch->execute([$branchId]);
                if (!$checkBranch->fetch()) {
                    sendError('Branch not found', 404);
                }
                
                // Check if inventory entry exists
                $checkInv = $pdo->prepare("SELECT stock_qty FROM product_inventory WHERE product_id = ? AND branch_id = ?");
                $checkInv->execute([$productIdParam, $branchId]);
                $existing = $checkInv->fetch();
                
                if ($existing) {
                    // Update existing inventory
                    $stmt = $pdo->prepare("UPDATE product_inventory SET stock_qty = ? WHERE product_id = ? AND branch_id = ?");
                    $stmt->execute([$stockQty, $productIdParam, $branchId]);
                } else {
                    // Insert new inventory entry
                    $stmt = $pdo->prepare("INSERT INTO product_inventory (product_id, branch_id, stock_qty) VALUES (?, ?, ?)");
                    $stmt->execute([$productIdParam, $branchId, $stockQty]);
                }
                
                // Get updated inventory entry
                $stmt = $pdo->prepare("
                    SELECT 
                        pi.branch_id,
                        b.branch_name,
                        pi.stock_qty
                    FROM product_inventory pi
                    LEFT JOIN branches b ON pi.branch_id = b.branch_id
                    WHERE pi.product_id = ? AND pi.branch_id = ?
                ");
                $stmt->execute([$productIdParam, $branchId]);
                $inventoryEntry = $stmt->fetch(PDO::FETCH_ASSOC);
                
                sendResponse($inventoryEntry, $existing ? 'Inventory updated successfully' : 'Inventory added successfully');
                break;
                
            case 'DELETE':
                // Remove inventory from a branch
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!isset($input['branch_id']) || !is_numeric($input['branch_id'])) {
                    sendError('Branch ID is required', 400);
                }
                
                $branchId = (int)$input['branch_id'];
                
                // Check if inventory entry exists
                $checkInv = $pdo->prepare("SELECT stock_qty FROM product_inventory WHERE product_id = ? AND branch_id = ?");
                $checkInv->execute([$productIdParam, $branchId]);
                if (!$checkInv->fetch()) {
                    sendError('Inventory entry not found', 404);
                }
                
                // Delete inventory entry
                $stmt = $pdo->prepare("DELETE FROM product_inventory WHERE product_id = ? AND branch_id = ?");
                $stmt->execute([$productIdParam, $branchId]);
                
                sendResponse(null, 'Inventory removed successfully');
                break;
                
            default:
                sendError('Method not allowed', 405);
                break;
        }
        // Exit early for inventory requests
        exit();
    }
    
    // Regular product CRUD operations
    switch ($method) {
        case 'GET':
            if ($productIdParam) {
                // Get specific product with category name, stock from product_inventory, and images
                // Price is stored in PHP (base currency)
                // Get the branch_id from product_inventory if it exists, otherwise use the selected branch or default to 1
                $requestedBranchId = isset($_GET['branch_id']) ? (int)$_GET['branch_id'] : null;
                
                // If branch_id is 0, return product without inventory data
                if ($requestedBranchId === 0) {
                    // Product with no branch - return without inventory data
                    // Get currency for conversion (default PHP)
                    $currency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';
                    $allowedCurrencies = ['PHP', 'USD', 'KRW'];
                    if (!in_array($currency, $allowedCurrencies)) {
                        $currency = 'PHP';
                    }
                    
                    // Get currency rate for conversion from API
                    require_once __DIR__ . '/../../utils/currency_api.php';
                    $rateToPhp = 1.0; // Default for PHP
                    if ($currency !== 'PHP') {
                        $rateToPhp = getExchangeRateFromAPI($currency);
                        if ($rateToPhp === null) {
                            // If API fails, default to PHP
                            $currency = 'PHP';
                            $rateToPhp = 1.0;
                        }
                    }
                    
                    // Price conversion expression: convert FROM PHP TO selected currency
                    $priceExpr = ($currency === 'PHP') 
                        ? "CAST(p.price AS DECIMAL(10,2))" 
                        : "ROUND(CAST(p.price AS DECIMAL(10,2)) * $rateToPhp, 2)";
                    
                    $stmt = $pdo->prepare("
                        SELECT 
                            p.product_id,
                            p.category_id,
                            p.genre_id,
                            p.product_name,
                            p.brand,
                            p.model,
                            p.description,
                            $priceExpr AS price,
                            ? AS currency,
                            p.specifications,
                            p.created_at,
                            p.updated_at,
                            c.category_name
                    FROM products p 
                    LEFT JOIN categories c ON p.category_id = c.category_id 
                    WHERE p.product_id = ?
                ");
                $stmt->execute([$currency, $productIdParam]);
                $product = $stmt->fetch();
                } else {
                    // First, try to get inventory from the requested branch, or get the first available branch
                    if ($requestedBranchId && $requestedBranchId > 0) {
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
                    
                    // Get currency for conversion (default PHP)
                    $currency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';
                    $allowedCurrencies = ['PHP', 'USD', 'KRW'];
                    if (!in_array($currency, $allowedCurrencies)) {
                        $currency = 'PHP';
                    }
                    
                    // Get currency rate for conversion from API
                    require_once __DIR__ . '/../../utils/currency_api.php';
                    $rateToPhp = 1.0; // Default for PHP
                    if ($currency !== 'PHP') {
                        $rateToPhp = getExchangeRateFromAPI($currency);
                        if ($rateToPhp === null) {
                            // If API fails, default to PHP
                            $currency = 'PHP';
                            $rateToPhp = 1.0;
                        }
                    }
                    
                    // Price conversion expression: convert FROM PHP TO selected currency
                    $priceExpr = ($currency === 'PHP') 
                        ? "CAST(p.price AS DECIMAL(10,2))" 
                        : "ROUND(CAST(p.price AS DECIMAL(10,2)) * $rateToPhp, 2)";
                    
                    $stmt = $pdo->prepare("
                        SELECT 
                            p.product_id,
                            p.category_id,
                            p.genre_id,
                            p.product_name,
                            p.brand,
                            p.model,
                            p.description,
                            $priceExpr AS price,
                            ? AS currency,
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
                    $stmt->execute([$currency, $branchId, $productIdParam]);
                    $product = $stmt->fetch();
                }
                
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
                
                // Get currency for conversion (default PHP)
                $currency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';
                $allowedCurrencies = ['PHP', 'USD', 'KRW'];
                if (!in_array($currency, $allowedCurrencies)) {
                    $currency = 'PHP';
                }
                
                // Get currency rate for conversion
                $rateToPhp = 1.0; // Default for PHP
                if ($currency !== 'PHP') {
                    $curStmt = $pdo->prepare("SELECT rate_to_php FROM currencies WHERE code = ? AND is_active = 1 LIMIT 1");
                    $curStmt->execute([$currency]);
                    $curRow = $curStmt->fetch();
                    if ($curRow) {
                        $rateToPhp = floatval($curRow['rate_to_php']);
                    } else {
                        // If currency not found, default to PHP
                        $currency = 'PHP';
                        $rateToPhp = 1.0;
                    }
                }
                
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
                $branchId = isset($_GET['branch_id']) ? (int)$_GET['branch_id'] : 1; // Default to branch 1 (0 = no branch)
                $allProducts = isset($_GET['all_products']) && $_GET['all_products'] === 'true';
                
                // Price conversion expression: convert FROM PHP TO selected currency
                // rate_to_php is the rate FROM PHP TO currency, so we multiply
                $priceExpr = ($currency === 'PHP') 
                    ? "CAST(p.price AS DECIMAL(10,2))" 
                    : "ROUND(CAST(p.price AS DECIMAL(10,2)) * $rateToPhp, 2)";
                
                // If all_products is true, fetch all products regardless of branch inventory
                if ($allProducts) {
                    $sql = "SELECT 
                                p.product_id,
                                p.category_id,
                                p.genre_id,
                                p.product_name,
                                p.brand,
                                p.model,
                                p.description,
                                $priceExpr AS price,
                                ? AS currency,
                                p.specifications,
                                p.created_at,
                                p.updated_at,
                                c.category_name
                            FROM products p 
                            LEFT JOIN categories c ON p.category_id = c.category_id 
                            $whereClause
                            ORDER BY p.created_at DESC 
                            LIMIT ? OFFSET ?";
                    
                    $allParams = array_merge([$currency], $params, [$limit, $offset]);
                } elseif ($branchId === 0) {
                    // Get ALL products from products table (master product list)
                    // This shows all products regardless of inventory status
                    $sql = "SELECT 
                                p.product_id,
                                p.category_id,
                                p.genre_id,
                                p.product_name,
                                p.brand,
                                p.model,
                                p.description,
                                $priceExpr AS price,
                                ? AS currency,
                                p.specifications,
                                p.created_at,
                                p.updated_at,
                                c.category_name,
                                CASE 
                                    WHEN NOT EXISTS (SELECT 1 FROM product_inventory WHERE product_id = p.product_id) 
                                    THEN 1 
                                    ELSE 0 
                                END AS is_unassigned
                        FROM products p 
                        LEFT JOIN categories c ON p.category_id = c.category_id 
                        $whereClause
                        ORDER BY p.created_at DESC 
                        LIMIT ? OFFSET ?";
                
                    $allParams = array_merge([$currency], $params, [$limit, $offset]);
                } else {
                    // Get products with category name, stock from selected branch, and branch info
                    // Only show products that have inventory in the selected branch (INNER JOIN)
                    // Price is stored in PHP (base currency), currency conversion happens dynamically
                    $sql = "SELECT 
                                p.product_id,
                                p.category_id,
                                p.genre_id,
                                p.product_name,
                                p.brand,
                                p.model,
                                p.description,
                                $priceExpr AS price,
                                ? AS currency,
                                p.specifications,
                                p.created_at,
                                p.updated_at,
                                c.category_name,
                                pi.stock_qty AS stock_quantity,
                                pi.branch_id,
                                b.branch_name
                            FROM products p 
                            INNER JOIN product_inventory pi ON p.product_id = pi.product_id AND pi.branch_id = ?
                            LEFT JOIN categories c ON p.category_id = c.category_id 
                            LEFT JOIN branches b ON b.branch_id = pi.branch_id
                            $whereClause
                            ORDER BY p.created_at DESC 
                            LIMIT ? OFFSET ?";
                    
                    // Add currency, then branch_id parameter for the INNER JOIN, then add limit and offset
                    $allParams = array_merge([$currency, $branchId], $params, [$limit, $offset]);
                }
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($allParams);
                $products = $stmt->fetchAll();
                
                // Fetch images for each product (only if not all_products mode, or if needed)
                if (!$allProducts && $branchId !== 0) {
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
                } elseif ($branchId === 0) {
                    // Fetch images for products with no branch
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
                }
                
                // Get total count
                if ($allProducts) {
                    $countSql = "SELECT COUNT(DISTINCT p.product_id) 
                            FROM products p 
                            LEFT JOIN categories c ON p.category_id = c.category_id 
                            $whereClause";
                $countStmt = $pdo->prepare($countSql);
                    $countStmt->execute($params);
                    $total = $countStmt->fetchColumn();
                } elseif ($branchId === 0) {
                    // Count ALL products from products table (master product list)
                    $countSql = "SELECT COUNT(DISTINCT p.product_id) 
                                FROM products p 
                                LEFT JOIN categories c ON p.category_id = c.category_id 
                                $whereClause";
                    $countStmt = $pdo->prepare($countSql);
                    $countStmt->execute($params);
                    $total = $countStmt->fetchColumn();
                } else {
                    // Only count products that have inventory in the selected branch
                    $countSql = "SELECT COUNT(DISTINCT p.product_id) 
                                FROM products p 
                                INNER JOIN product_inventory pi ON p.product_id = pi.product_id AND pi.branch_id = ?
                                LEFT JOIN categories c ON p.category_id = c.category_id 
                                $whereClause";
                    $countStmt = $pdo->prepare($countSql);
                    $countParams = array_merge([$branchId], $params); // Include branch_id for count
                    $countStmt->execute($countParams);
                $total = $countStmt->fetchColumn();
                }
                
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
            $allowedCurrencies = ['PHP', 'USD', 'KRW', 'JPY', 'EUR', 'GBP', 'CAD', 'AUD'];
            if (!in_array($currency, $allowedCurrencies)) {
                sendError('Invalid currency. Allowed: PHP, USD, KRW, JPY, EUR, GBP, CAD, AUD', 400);
            }
            
            // Get currency rate from API to convert to PHP
            require_once __DIR__ . '/../../utils/currency_api.php';
            $priceInPhp = floatval($input['price']);
            if ($currency !== 'PHP') {
                $rate = getExchangeRateFromAPI($currency);
                if ($rate === null || $rate <= 0) {
                    sendError('Failed to fetch exchange rate for ' . $currency, 500);
                }
                // Convert from selected currency to PHP: divide by rate
                // Example: if 1 PHP = 0.018 USD (rate = 0.018), then 1 USD = 1/0.018 = 55.56 PHP
                $priceInPhp = floatval($input['price']) / $rate;
            }
            
            // Check if category exists
            $stmt = $pdo->prepare("SELECT category_id FROM categories WHERE category_id = ?");
            $stmt->execute([$input['category_id']]);
            if (!$stmt->fetch()) {
                sendError('Category not found', 404);
            }
            
            // Check if genre exists (if provided)
            $genreId = isset($input['genre_id']) && $input['genre_id'] !== null && $input['genre_id'] !== '' ? (int)$input['genre_id'] : null;
            if ($genreId !== null) {
                $stmt = $pdo->prepare("SELECT genre_id FROM genres WHERE genre_id = ?");
                $stmt->execute([$genreId]);
                if (!$stmt->fetch()) {
                    sendError('Genre not found', 404);
                }
            }
            
            // Insert product - price is stored in PHP (base currency)
            // Brand and model can be empty for games (when genre_id is set)
            $stmt = $pdo->prepare("
                INSERT INTO products (category_id, genre_id, product_name, brand, model, description, price, specifications) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            $stmt->execute([
                $input['category_id'],
                $genreId,
                $input['product_name'],
                $input['brand'] ?? null, // Can be null for games
                $input['model'] ?? null, // Can be null for games
                $input['description'] ?? null,
                $priceInPhp, // Store price in PHP
                isset($input['specifications']) ? json_encode($input['specifications']) : null
            ]);
            
            $newProductId = $pdo->lastInsertId();
            
            // Handle inventory if stock_quantity is provided
            // Skip inventory if branch_id is 0 (no branch) - new products are created without branch assignment
            // Admins will add products to branches later using the inventory management endpoint
            $branchId = isset($input['branch_id']) ? (int)$input['branch_id'] : 0;
            if ($branchId !== 0 && isset($input['stock_quantity']) && is_numeric($input['stock_quantity']) && $input['stock_quantity'] >= 0) {
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
            
            // Get created product with category name and stock from selected branch (if branch_id is not 0)
            // Price is stored in PHP (base currency)
            if ($branchId === 0) {
                // Product with no branch - return without inventory data
            $stmt = $pdo->prepare("
                    SELECT 
                        p.product_id,
                        p.category_id,
                        p.genre_id,
                        p.product_name,
                        p.brand,
                        p.model,
                        p.description,
                        CAST(p.price AS DECIMAL(10,2)) AS price,
                        'PHP' AS currency,
                        p.specifications,
                        p.created_at,
                        p.updated_at,
                        c.category_name
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                WHERE p.product_id = ?
            ");
            $stmt->execute([$newProductId]);
            } else {
                $stmt = $pdo->prepare("
                    SELECT 
                        p.product_id,
                        p.category_id,
                        p.genre_id,
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
            }
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
                
                // Convert price to PHP (base currency) using API
                require_once __DIR__ . '/../../utils/currency_api.php';
                $priceInPhp = floatval($input['price']);
                if ($currency !== 'PHP') {
                    $rate = getExchangeRateFromAPI($currency);
                    if ($rate === null || $rate <= 0) {
                        sendError('Failed to fetch exchange rate for ' . $currency, 500);
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
            
            // Check if genre exists (if provided)
            if (isset($input['genre_id']) && $input['genre_id'] !== null && $input['genre_id'] !== '') {
                $genreId = (int)$input['genre_id'];
                $stmt = $pdo->prepare("SELECT genre_id FROM genres WHERE genre_id = ?");
                $stmt->execute([$genreId]);
                if (!$stmt->fetch()) {
                    sendError('Genre not found', 404);
                }
            }
            
            // Build update query (exclude stock_quantity and currency - price is stored in PHP)
            $updateFields = [];
            $params = [];
            
            $allowedFields = ['category_id', 'genre_id', 'product_name', 'brand', 'model', 'description'];
            foreach ($allowedFields as $field) {
                if (isset($input[$field])) {
                    // Handle genre_id: can be null to clear it
                    if ($field === 'genre_id') {
                        $updateFields[] = "$field = ?";
                        $params[] = ($input[$field] === null || $input[$field] === '') ? null : (int)$input[$field];
                    } else {
                        $updateFields[] = "$field = ?";
                        $params[] = $input[$field];
                    }
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
            // Skip inventory update if branch_id is 0 (no branch)
            $branchId = isset($input['branch_id']) ? (int)$input['branch_id'] : null;
            
            if ($branchId !== 0 && isset($input['stock_quantity']) && is_numeric($input['stock_quantity'])) {
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
                // Skip if branch_id is 0 (no branch)
                if (!$branchId && $branchId !== 0) {
                    $firstBranchStmt = $pdo->prepare("SELECT branch_id FROM product_inventory WHERE product_id = ? ORDER BY branch_id LIMIT 1");
                    $firstBranchStmt->execute([$productIdParam]);
                    $firstBranch = $firstBranchStmt->fetch();
                    $branchId = $firstBranch ? (int)$firstBranch['branch_id'] : 1;
                }
            }
            
            // Get updated product with category name and stock from the branch used
            // Price is stored in PHP (base currency)
            // If branch_id is 0, return product without inventory data
            if ($branchId === 0) {
            $stmt = $pdo->prepare("
                    SELECT 
                        p.product_id,
                        p.category_id,
                        p.genre_id,
                        p.product_name,
                        p.brand,
                        p.model,
                        p.description,
                        CAST(p.price AS DECIMAL(10,2)) AS price,
                        'PHP' AS currency,
                        p.specifications,
                        p.created_at,
                        p.updated_at,
                        c.category_name
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.category_id 
                WHERE p.product_id = ?
            ");
            $stmt->execute([$productIdParam]);
            } else {
                // Ensure branchId is set (default to 1 if not provided)
                if (!$branchId) {
                    $branchId = 1;
                }
                $stmt = $pdo->prepare("
                    SELECT 
                        p.product_id,
                        p.category_id,
                        p.genre_id,
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
            }
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
            
            // Start ACID transaction with explicit MySQL statements
            // This ensures proper ACID compliance:
            // - ATOMICITY: All deletions succeed or all fail
            // - CONSISTENCY: Foreign key constraints are maintained
            // - ISOLATION: Changes are isolated until COMMIT
            // - DURABILITY: Once COMMIT, changes are permanent
            $pdo->exec("START TRANSACTION");
            
            try {
                // Delete related records in order (respecting foreign key constraints)
                // 1. Delete from product_inventory (has ON DELETE RESTRICT constraint)
                $stmt = $pdo->prepare("DELETE FROM product_inventory WHERE product_id = ?");
                $stmt->execute([$productIdParam]);
                
                // 2. Delete from cart (has ON DELETE CASCADE, but we'll do it explicitly for clarity)
                $stmt = $pdo->prepare("DELETE FROM cart WHERE product_id = ?");
                $stmt->execute([$productIdParam]);
                
                // 3. Delete from reviews (has ON DELETE CASCADE, but we'll do it explicitly for clarity)
                $stmt = $pdo->prepare("DELETE FROM reviews WHERE product_id = ?");
                $stmt->execute([$productIdParam]);
                
                // 4. Delete from order_items (has ON DELETE CASCADE, but we'll do it explicitly for clarity)
                // Note: This will affect order totals, but we'll delete them anyway
                $stmt = $pdo->prepare("DELETE FROM order_items WHERE product_id = ?");
                $stmt->execute([$productIdParam]);
                
                // 5. Delete from product_images (has ON DELETE CASCADE, but we'll do it explicitly for clarity)
                $stmt = $pdo->prepare("DELETE FROM product_images WHERE product_id = ?");
                $stmt->execute([$productIdParam]);
                
                // 6. Finally, delete the product itself
            $stmt = $pdo->prepare("DELETE FROM products WHERE product_id = ?");
            $stmt->execute([$productIdParam]);
                
                // Commit transaction - all deletions are now permanent
                $pdo->exec("COMMIT");
            
            sendResponse(null, 'Product deleted successfully');
            } catch (PDOException $e) {
                // Rollback on error - all changes are discarded
                $pdo->exec("ROLLBACK");
                throw $e; // Re-throw to be caught by outer catch block
            }
            break;
            
        default:
            sendError('Method not allowed', 405);
            break;
    }
} catch (PDOException $e) {
    sendError('Database error: ' . $e->getMessage(), 500);
}
?>
