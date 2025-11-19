<?php
/**
 * STAFF INVENTORY API ENDPOINT
 * 
 * This endpoint handles inventory management for staff's branch.
 * All operations are automatically restricted to staff's branch_id.
 * 
 * ROUTES:
 * - GET /api/staff/inventory - List products with inventory for staff's branch
 * - PUT /api/staff/inventory/{product_id} - Update stock quantity for branch
 * - POST /api/staff/inventory/{product_id}/add-stock - Add stock to branch inventory
 * - POST /api/staff/inventory/{product_id}/damage - Mark items as damaged (reduce stock)
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token
 * - Validates staff role and branch_id
 * - All operations restricted to staff's branch_id
 * 
 * ACID COMPLIANCE ANALYSIS:
 * 
 * add-stock Operation:
 *   ATOMICITY: GOOD - Uses transaction wrapper
 *   CONSISTENCY: GOOD - Validates product exists, enforces quantity rules
 *   ISOLATION: GOOD - FOR UPDATE prevents concurrent modifications
 *   DURABILITY: GOOD - COMMIT ensures persistence
 * 
 * damage Operation:
 *   ATOMICITY: GOOD - Uses transaction wrapper
 *   CONSISTENCY: GOOD - Validates sufficient stock before reduction
 *   ISOLATION: GOOD - FOR UPDATE prevents concurrent modifications
 *   DURABILITY: GOOD - COMMIT ensures persistence
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/staff_auth.php';

// Authenticate staff and get branch_id
$auth = requireStaffAuth();
$staffUserId = $auth['user_id'];
$branchId = $auth['branch_id'];

// Get request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Remove /api/staff prefix to get relative path
$path = str_replace('/api/staff', '', $path);
$path = ltrim($path, '/');
$pathParts = explode('/', $path);

// Extract product ID and action if present
$productIdParam = null;
$action = null;

// Parse path: inventory/{product_id} or inventory/{product_id}/{action}
// pathParts[0] = 'inventory', pathParts[1] = product_id (if exists), pathParts[2] = action (if exists)
if (isset($pathParts[1]) && is_numeric($pathParts[1])) {
    $productIdParam = intval($pathParts[1]);
    if (isset($pathParts[2])) {
        $action = $pathParts[2];
    }
}

try {
    switch ($method) {
        case 'GET':
            // List products with inventory for staff's branch
            $search = $_GET['search'] ?? '';
            $page = max(1, intval($_GET['page'] ?? 1));
            $limit = min(100, max(1, intval($_GET['limit'] ?? 20)));
            $offset = ($page - 1) * $limit;
            
            $whereConditions = [];
            $params = [];
            
            if ($search) {
                $whereConditions[] = "(p.product_name LIKE ? OR p.brand LIKE ? OR p.model LIKE ?)";
                $searchTerm = "%$search%";
                $params = array_merge($params, [$searchTerm, $searchTerm, $searchTerm]);
            }
            
            $whereClause = $whereConditions ? 'WHERE ' . implode(' AND ', $whereConditions) : '';
            
            // Check if currency column exists in products table
            try {
                $checkCurrency = $pdo->query("
                    SELECT COUNT(*) as col_exists 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = 'electronics_store' 
                      AND TABLE_NAME = 'products' 
                      AND COLUMN_NAME = 'currency'
                ");
                $hasCurrency = $checkCurrency->fetch()['col_exists'] > 0;
            } catch (Exception $e) {
                // If check fails, assume currency doesn't exist
                $hasCurrency = false;
            }
            
            // Build SELECT - always use PHP currency for staff panel
            $sql = "SELECT 
                        p.product_id,
                        p.product_name,
                        p.brand,
                        p.model,
                        p.price,
                        'PHP' AS currency,
                        c.category_name,
                        COALESCE(pi.stock_qty, 0) AS stock_quantity,
                        (SELECT image_url FROM product_images WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) as product_image
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.category_id
                    LEFT JOIN product_inventory pi ON p.product_id = pi.product_id AND pi.branch_id = ?
                    $whereClause
                    ORDER BY p.product_name ASC
                    LIMIT ? OFFSET ?";
            
            // Ensure branchId is cast to match product_inventory.branch_id type (INT UNSIGNED)
            $params = array_merge([(int)$branchId], $params, [$limit, $offset]);
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $products = $stmt->fetchAll();
            
            // Get total count
            $countSql = "SELECT COUNT(*) 
                        FROM products p
                        $whereClause";
            $countParams = array_slice($params, 1, -2); // Remove branchId, limit, offset
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
            ], 'Inventory retrieved successfully');
            break;
            
        case 'PUT':
            // Update stock quantity for branch
            if (!$productIdParam) {
                sendError('Product ID required', 400);
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!isset($input['stock_quantity']) || !is_numeric($input['stock_quantity']) || $input['stock_quantity'] < 0) {
                sendError('Stock quantity must be a non-negative number', 400);
            }
            
            $stockQty = (int)$input['stock_quantity'];
            
            // Check if product exists
            $checkProduct = $pdo->prepare("SELECT product_id FROM products WHERE product_id = ?");
            $checkProduct->execute([$productIdParam]);
            if (!$checkProduct->fetch()) {
                sendError('Product not found', 404);
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
                    pi.stock_qty,
                    p.product_name,
                    p.brand
                FROM product_inventory pi
                LEFT JOIN branches b ON pi.branch_id = b.branch_id
                LEFT JOIN products p ON pi.product_id = p.product_id
                WHERE pi.product_id = ? AND pi.branch_id = ?
            ");
            $stmt->execute([$productIdParam, $branchId]);
            $inventoryEntry = $stmt->fetch(PDO::FETCH_ASSOC);
            
            sendResponse($inventoryEntry, $existing ? 'Inventory updated successfully' : 'Inventory added successfully');
            break;
            
        case 'POST':
            // Handle add-stock or damage actions
            if (!$productIdParam || !$action) {
                sendError('Product ID and action required', 400);
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            if ($action === 'add-stock') {
                // Add stock to branch inventory with ACID transaction
                // ATOMICITY: Product check, inventory check, and stock update happen atomically
                // CONSISTENCY: Validates product exists, enforces quantity rules
                // ISOLATION: FOR UPDATE prevents concurrent stock modifications
                // DURABILITY: COMMIT ensures persistence
                if (!isset($input['quantity']) || !is_numeric($input['quantity']) || $input['quantity'] <= 0) {
                    sendError('Quantity must be a positive number', 400);
                }
                
                $quantity = (int)$input['quantity'];
                
                // ATOMICITY: Start transaction - all operations succeed or all fail
                $pdo->exec("START TRANSACTION");
                
                try {
                    // CONSISTENCY: Validate product exists
                    // Check if product exists
                    $checkProduct = $pdo->prepare("SELECT product_id FROM products WHERE product_id = ?");
                    $checkProduct->execute([$productIdParam]);
                    if (!$checkProduct->fetch()) {
                        $pdo->exec("ROLLBACK");
                        sendError('Product not found', 404);
                    }
                    
                    // ISOLATION: Row-level locking prevents concurrent inventory modifications
                    // Check if inventory entry exists WITH ROW-LEVEL LOCKING
                    // FOR UPDATE prevents concurrent modifications
                    $checkInv = $pdo->prepare("
                        SELECT stock_qty 
                        FROM product_inventory 
                        WHERE product_id = ? AND branch_id = ? 
                        FOR UPDATE
                    ");
                    $checkInv->execute([$productIdParam, $branchId]);
                    $existing = $checkInv->fetch();
                    
                    // ATOMICITY: Stock update within transaction
                    if ($existing) {
                        // Add to existing stock
                        $stmt = $pdo->prepare("
                            UPDATE product_inventory 
                            SET stock_qty = stock_qty + ? 
                            WHERE product_id = ? AND branch_id = ?
                        ");
                        $stmt->execute([$quantity, $productIdParam, $branchId]);
                    } else {
                        // Create new inventory entry
                        $stmt = $pdo->prepare("
                            INSERT INTO product_inventory (product_id, branch_id, stock_qty) 
                            VALUES (?, ?, ?)
                        ");
                        $stmt->execute([$productIdParam, $branchId, $quantity]);
                    }
                    
                    // DURABILITY: COMMIT ensures all changes are permanently saved
                    $pdo->exec("COMMIT");
                    sendResponse(['message' => "Added $quantity units to inventory"], 'Stock added successfully');
                } catch (Exception $e) {
                    // ATOMICITY: Rollback ensures no partial state on error
                    $pdo->exec("ROLLBACK");
                    error_log('Add stock error: ' . $e->getMessage());
                    sendError('Failed to add stock: ' . $e->getMessage(), 500);
                }
                
            } elseif ($action === 'damage') {
                // Mark items as damaged (reduce stock) with ACID transaction
                // ATOMICITY: Product check, stock validation, and stock reduction happen atomically
                // CONSISTENCY: Validates sufficient stock before reduction
                // ISOLATION: FOR UPDATE prevents concurrent stock modifications
                // DURABILITY: COMMIT ensures persistence
                if (!isset($input['quantity']) || !is_numeric($input['quantity']) || $input['quantity'] <= 0) {
                    sendError('Quantity must be a positive number', 400);
                }
                
                $quantity = (int)$input['quantity'];
                
                // ATOMICITY: Start transaction - all operations succeed or all fail
                $pdo->exec("START TRANSACTION");
                
                try {
                    // CONSISTENCY: Validate product exists
                    // Check if product exists
                    $checkProduct = $pdo->prepare("SELECT product_id FROM products WHERE product_id = ?");
                    $checkProduct->execute([$productIdParam]);
                    if (!$checkProduct->fetch()) {
                        $pdo->exec("ROLLBACK");
                        sendError('Product not found', 404);
                    }
                    
                    // ISOLATION: Row-level locking prevents concurrent stock modifications
                    // CONSISTENCY: Validate sufficient stock before reduction
                    // Check current stock WITH ROW-LEVEL LOCKING
                    // FOR UPDATE prevents concurrent modifications
                    $checkInv = $pdo->prepare("
                        SELECT stock_qty 
                        FROM product_inventory 
                        WHERE product_id = ? AND branch_id = ? 
                        FOR UPDATE
                    ");
                    $checkInv->execute([$productIdParam, $branchId]);
                    $existing = $checkInv->fetch();
                    
                    // CONSISTENCY: Enforce stock limits - cannot mark more as damaged than available
                    if (!$existing || $existing['stock_qty'] < $quantity) {
                        $pdo->exec("ROLLBACK");
                        sendError('Insufficient stock to mark as damaged', 400);
                    }
                    
                    // ATOMICITY: Stock reduction within transaction
                    // Reduce stock
                    $stmt = $pdo->prepare("
                        UPDATE product_inventory 
                        SET stock_qty = GREATEST(0, stock_qty - ?) 
                        WHERE product_id = ? AND branch_id = ?
                    ");
                    $stmt->execute([$quantity, $productIdParam, $branchId]);
                    
                    // DURABILITY: COMMIT ensures all changes are permanently saved
                    $pdo->exec("COMMIT");
                    sendResponse(['message' => "Marked $quantity units as damaged"], 'Items marked as damaged successfully');
                } catch (Exception $e) {
                    // ATOMICITY: Rollback ensures no partial state on error
                    $pdo->exec("ROLLBACK");
                    error_log('Mark damaged error: ' . $e->getMessage());
                    sendError('Failed to mark items as damaged: ' . $e->getMessage(), 500);
                }
            } else {
                sendError('Invalid action. Use "add-stock" or "damage"', 400);
            }
            break;
            
        default:
            sendError('Method not allowed', 405);
            break;
    }
} catch (PDOException $e) {
    error_log('Staff Inventory PDO Error: ' . $e->getMessage());
    error_log('Staff Inventory SQL State: ' . $e->getCode());
    error_log('Staff Inventory Error Info: ' . print_r($e->errorInfo ?? [], true));
    sendError('Database error: ' . $e->getMessage(), 500);
} catch (Throwable $e) {
    error_log('Staff Inventory Error: ' . $e->getMessage());
    error_log('Staff Inventory Stack Trace: ' . $e->getTraceAsString());
    sendError('Server error: ' . $e->getMessage(), 500);
}
?>

