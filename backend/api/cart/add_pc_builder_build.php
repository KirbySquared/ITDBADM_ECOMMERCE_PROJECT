<?php
/**
 * ADD PC BUILDER BUILD TO CART ENDPOINT
 * 
 * This endpoint handles adding a complete PC builder build to cart as a bundle.
 * The build is treated as a single unit with discount already applied.
 * 
 * POST /api/cart/pc-builder-build
 * 
 * Request Body:
 * {
 *   "items": [
 *     { "product_id": 1, "quantity": 1, "unit_price": 100.00, "category_id": 1, "category_name": "CPU" },
 *     ...
 *   ],
 *   "discount_percent": 10,
 *   "discount_amount": 50.00,
 *   "subtotal": 500.00,
 *   "total_amount": 450.00,
 *   "currency": "USD",
 *   "build_name": "Custom PC Build"
 * }
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/currency_api.php';

header('Content-Type: application/json');

// Get authorization header
$headers = function_exists('getallheaders') ? getallheaders() : [];
$token = null;

foreach ($headers as $k => $v) {
    if (strtolower($k) === 'authorization') {
        $token = preg_replace('/^Bearer\s+/i', '', $v);
        break;
    }
}

if (!$token && isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $token = preg_replace('/^Bearer\s+/i', '', $_SERVER['HTTP_AUTHORIZATION']);
}

if (!$token) {
    sendError('Authorization token required', 401);
}

// Validate token
$userId = validateToken($token);
if (!$userId) {
    sendError('Invalid or expired token', 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    if (!isset($input['items']) || !is_array($input['items']) || empty($input['items'])) {
        sendError('Items are required', 400);
    }
    
    if (!isset($input['subtotal']) || !isset($input['total_amount'])) {
        sendError('Subtotal and total_amount are required', 400);
    }
    
    $items = $input['items'];
    $discountPercent = isset($input['discount_percent']) ? (float)$input['discount_percent'] : 0.0;
    $currency = isset($input['currency']) ? strtoupper(trim($input['currency'])) : 'PHP';
    $buildName = isset($input['build_name']) ? trim($input['build_name']) : 'Custom PC Build';
    
    // Validate currency
    if (!isValidCurrencyCode($currency)) {
        sendError('Invalid currency code', 400);
    }
    
    // Get exchange rate for conversion
    $rateToPhp = getExchangeRateFromAPI($currency);
    if ($rateToPhp === null) {
        sendError('Failed to fetch exchange rate for ' . $currency, 500);
    }
    
    // Validate discount
    if ($discountPercent < 0 || $discountPercent > 100) {
        sendError('Invalid discount percent', 400);
    }
    
    // Start transaction
    $pdo->exec("START TRANSACTION");
    
    try {
        // Get user's branch_id
        $stmt = $pdo->prepare("SELECT branch_id FROM users WHERE user_id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            throw new Exception('User not found');
        }
        
        $userBranchId = $user['branch_id'] ?? 1;
        
        // Validate all products exist and have stock
        $productIds = array_map(function($item) { return (int)$item['product_id']; }, $items);
        $placeholders = implode(',', array_fill(0, count($productIds), '?'));
        
        $stmt = $pdo->prepare("
            SELECT p.product_id, p.product_name, p.price as base_price, pi.stock_qty
            FROM products p
            LEFT JOIN product_inventory pi ON pi.product_id = p.product_id AND pi.branch_id = ?
            WHERE p.product_id IN ($placeholders)
        ");
        $stmt->execute(array_merge([$userBranchId], $productIds));
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $productMap = [];
        foreach ($products as $product) {
            $productMap[$product['product_id']] = $product;
        }
        
        // Recalculate subtotal from base prices (PHP) from database
        $subtotalInPhp = 0.0;
        foreach ($items as $item) {
            $productId = (int)$item['product_id'];
            $quantity = (int)($item['quantity'] ?? 1);
            
            if (!isset($productMap[$productId])) {
                throw new Exception("Product ID $productId not found");
            }
            
            $availableStock = (int)($productMap[$productId]['stock_qty'] ?? 0);
            if ($availableStock < $quantity) {
                throw new Exception("Insufficient stock for {$productMap[$productId]['product_name']}. Available: $availableStock, Requested: $quantity");
            }
            
            // Use base price from database (PHP) for accurate calculation
            $basePrice = (float)$productMap[$productId]['base_price'];
            $subtotalInPhp += $basePrice * $quantity;
        }
        
        // Recalculate discount and total in PHP
        $discountAmountInPhp = ($subtotalInPhp * $discountPercent) / 100;
        $totalAmountInPhp = $subtotalInPhp - $discountAmountInPhp;
        
        // Convert to requested currency
        $subtotal = $currency === 'PHP' ? $subtotalInPhp : ($subtotalInPhp * $rateToPhp);
        $discountAmount = $currency === 'PHP' ? $discountAmountInPhp : ($discountAmountInPhp * $rateToPhp);
        $totalAmount = $currency === 'PHP' ? $totalAmountInPhp : ($totalAmountInPhp * $rateToPhp);
        
        // Create PC builder build record
        $stmt = $pdo->prepare("
            INSERT INTO pc_builder_builds (
                user_id, build_name, discount_percent, discount_amount, 
                subtotal, total_amount, currency
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $userId,
            $buildName,
            $discountPercent,
            $discountAmount,
            $subtotal,
            $totalAmount,
            $currency
        ]);
        $buildId = $pdo->lastInsertId();
        
        // Add items to cart with build_id
        $stmt = $pdo->prepare("
            INSERT INTO cart (user_id, product_id, quantity, branch_id, pc_builder_build_id)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                quantity = quantity + VALUES(quantity)
        ");
        
        // Store build items
        $buildItemStmt = $pdo->prepare("
            INSERT INTO pc_builder_build_items (
                build_id, product_id, category_id, category_name, 
                quantity, unit_price, subtotal
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        
        foreach ($items as $item) {
            $productId = (int)$item['product_id'];
            $quantity = (int)($item['quantity'] ?? 1);
            // Use base price from database for build items
            $basePrice = (float)$productMap[$productId]['base_price'];
            $categoryId = isset($item['category_id']) ? (int)$item['category_id'] : null;
            $categoryName = $item['category_name'] ?? null;
            $itemSubtotal = $basePrice * $quantity;
            
            // Add to cart
            $stmt->execute([$userId, $productId, $quantity, $userBranchId, $buildId]);
            
            // Store build item with base price (PHP)
            $buildItemStmt->execute([
                $buildId,
                $productId,
                $categoryId,
                $categoryName,
                $quantity,
                $basePrice, // Store base price in PHP
                $itemSubtotal // Store subtotal in PHP
            ]);
        }
        
        // Commit transaction
        $pdo->exec("COMMIT");
        
        sendResponse([
            'build_id' => $buildId,
            'message' => 'PC builder build added to cart successfully',
            'items_count' => count($items),
            'discount_percent' => $discountPercent,
            'total_amount' => $totalAmount
        ], 'PC builder build added to cart successfully');
        
    } catch (Exception $e) {
        $pdo->exec("ROLLBACK");
        error_log('PC Builder Build API Error: ' . $e->getMessage());
        sendError($e->getMessage(), 400);
    }
    
} catch (PDOException $e) {
    error_log('PC Builder Build API PDO Error: ' . $e->getMessage());
    sendError('Database error: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    error_log('PC Builder Build API Error: ' . $e->getMessage());
    sendError('Error: ' . $e->getMessage(), 500);
}

