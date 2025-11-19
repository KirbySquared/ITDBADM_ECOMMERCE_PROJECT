<?php
/**
 * ADMIN VIEWS API ENDPOINT
 * 
 * Provides access to database views for reporting and analytics
 * 
 * GET /api/admin/views?view=<view_name>&filters...
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/currency_api.php';

header('Content-Type: application/json');

// Check authentication
$headers = getallheaders();
$token = null;

if (isset($headers['Authorization'])) {
    $token = str_replace('Bearer ', '', $headers['Authorization']);
}

if (!$token) {
    sendError('Authorization token required', 401);
}

$userId = validateToken($token);
if (!$userId) {
    sendError('Invalid or expired token', 401);
}

// Check if user is admin
try {
    $stmt = $pdo->prepare("SELECT role FROM users WHERE user_id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user || $user['role'] !== 'admin') {
        sendError('Admin access required', 403);
    }
} catch (PDOException $e) {
    sendError('Database error', 500);
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $viewName = $_GET['view'] ?? '';
    $limit = isset($_GET['limit']) ? min(1000, max(1, (int)$_GET['limit'])) : 100;
    $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;
    
    // List of allowed views (security: prevent SQL injection)
    $allowedViews = [
        'v_product_catalog',
        'v_product_availability_by_branch',
        'v_branch_inventory_levels',
        'v_daily_sales_totals',
        'v_order_summary',
        'v_order_details',
        'v_order_dashboard',
        'v_top_rated_products',
        'v_low_stock_alerts',
        'v_customer_purchase_summary',
        'v_product_prices_multi_currency',
        'v_order_status_timeline',
        'v_orders_with_payment_details',
        'v_shopping_cart_details',
        'v_transaction_log_activities'
    ];
    
    // If no view specified, return list of available views
    if (empty($viewName)) {
        sendResponse([
            'views' => $allowedViews,
            'count' => count($allowedViews)
        ], 'Available views retrieved successfully');
    }
    
    // Validate view name
    if (!in_array($viewName, $allowedViews)) {
        sendError('Invalid view name', 400);
    }
    
    try {
        // Build query with filters
        $sql = "SELECT * FROM `$viewName`";
        $params = [];
        $whereConditions = [];
        
        // Apply filters based on view and query parameters
        switch ($viewName) {
            case 'v_product_catalog':
                if (isset($_GET['category_name'])) {
                    $whereConditions[] = "category_name = ?";
                    $params[] = $_GET['category_name'];
                }
                if (isset($_GET['min_stock'])) {
                    $whereConditions[] = "total_stock_quantity >= ?";
                    $params[] = (int)$_GET['min_stock'];
                }
                break;
                
            case 'v_product_availability_by_branch':
                if (isset($_GET['branch_id'])) {
                    $whereConditions[] = "branch_id = ?";
                    $params[] = (int)$_GET['branch_id'];
                }
                if (isset($_GET['product_id'])) {
                    $whereConditions[] = "product_id = ?";
                    $params[] = (int)$_GET['product_id'];
                }
                if (isset($_GET['availability_status'])) {
                    $whereConditions[] = "availability_status = ?";
                    $params[] = $_GET['availability_status'];
                }
                break;
                
            case 'v_order_summary':
            case 'v_order_dashboard':
            case 'v_orders_with_payment_details':
                // Search by customer name (first_name or last_name)
                if (isset($_GET['customer_name']) && !empty(trim($_GET['customer_name']))) {
                    $customerName = trim($_GET['customer_name']);
                    $whereConditions[] = "(first_name LIKE ? OR last_name LIKE ? OR CONCAT(first_name, ' ', last_name) LIKE ?)";
                    $searchPattern = '%' . $customerName . '%';
                    $params[] = $searchPattern;
                    $params[] = $searchPattern;
                    $params[] = $searchPattern;
                }
                // Also support user_id for backward compatibility
                if (isset($_GET['user_id']) && !empty(trim($_GET['user_id']))) {
                    $whereConditions[] = "user_id = ?";
                    $params[] = (int)$_GET['user_id'];
                }
                if (isset($_GET['order_status'])) {
                    $whereConditions[] = "order_status = ?";
                    $params[] = $_GET['order_status'];
                }
                if (isset($_GET['payment_status'])) {
                    $whereConditions[] = "payment_status = ?";
                    $params[] = $_GET['payment_status'];
                }
                if (isset($_GET['date_from'])) {
                    $whereConditions[] = "DATE(order_date) >= ?";
                    $params[] = $_GET['date_from'];
                }
                if (isset($_GET['date_to'])) {
                    $whereConditions[] = "DATE(order_date) <= ?";
                    $params[] = $_GET['date_to'];
                }
                break;
                
            case 'v_daily_sales_totals':
                if (isset($_GET['branch_id'])) {
                    $whereConditions[] = "branch_id = ?";
                    $params[] = (int)$_GET['branch_id'];
                }
                if (isset($_GET['date_from'])) {
                    $whereConditions[] = "sale_date >= ?";
                    $params[] = $_GET['date_from'];
                }
                if (isset($_GET['date_to'])) {
                    $whereConditions[] = "sale_date <= ?";
                    $params[] = $_GET['date_to'];
                }
                if (isset($_GET['currency'])) {
                    $whereConditions[] = "currency = ?";
                    $params[] = strtoupper($_GET['currency']);
                }
                break;
                
            case 'v_low_stock_alerts':
            case 'v_branch_inventory_levels':
                if (isset($_GET['branch_id'])) {
                    $whereConditions[] = "branch_id = ?";
                    $params[] = (int)$_GET['branch_id'];
                }
                if (isset($_GET['alert_level'])) {
                    $whereConditions[] = "alert_level = ?";
                    $params[] = $_GET['alert_level'];
                }
                break;
                
            case 'v_shopping_cart_details':
                if (isset($_GET['user_id'])) {
                    $whereConditions[] = "user_id = ?";
                    $params[] = (int)$_GET['user_id'];
                }
                if (isset($_GET['days_in_cart'])) {
                    $whereConditions[] = "days_in_cart >= ?";
                    $params[] = (int)$_GET['days_in_cart'];
                }
                break;
                
            case 'v_transaction_log_activities':
                if (isset($_GET['performed_by'])) {
                    $whereConditions[] = "performed_by = ?";
                    $params[] = (int)$_GET['performed_by'];
                }
                if (isset($_GET['activity_type'])) {
                    $whereConditions[] = "activity_type = ?";
                    $params[] = $_GET['activity_type'];
                }
                if (isset($_GET['hours_ago'])) {
                    $whereConditions[] = "hours_ago <= ?";
                    $params[] = (int)$_GET['hours_ago'];
                }
                break;
        }
        
        // Add WHERE clause if conditions exist
        if (!empty($whereConditions)) {
            $sql .= " WHERE " . implode(" AND ", $whereConditions);
        }
        
        // Add ORDER BY
        $sql .= " ORDER BY 1 DESC"; // Order by first column descending (usually ID or date)
        
        // Add LIMIT and OFFSET
        $sql .= " LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        
        // Execute query
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Get currency parameter (default PHP)
        $currency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';
        if (!isValidCurrencyCode($currency)) {
            $currency = 'PHP';
        }
        
        // Convert amount fields based on view type
        // Note: Views store amounts in PHP (base currency), so we convert from PHP to requested currency
        if ($currency !== 'PHP') {
            $rate = getExchangeRateFromAPI($currency);
            if ($rate !== null && $rate > 0) {
                // Convert amount fields in results
                foreach ($results as &$row) {
                    // Convert common amount fields
                    $amountFields = ['total_revenue', 'total_amount', 'amount', 'price', 'unit_price', 'subtotal', 'total_price', 'purchase_value', 'average_price'];
                    foreach ($amountFields as $field) {
                        if (isset($row[$field]) && is_numeric($row[$field])) {
                            $amountInPhp = (float)$row[$field];
                            // Convert from PHP to requested currency
                            $row[$field] = round(convertPriceFromPhp($amountInPhp, $currency), 2);
                        }
                    }
                }
                unset($row); // Break reference
            }
        }
        
        // Get total count (without limit)
        $countSql = "SELECT COUNT(*) FROM `$viewName`";
        if (!empty($whereConditions)) {
            $countSql .= " WHERE " . implode(" AND ", $whereConditions);
        }
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute(array_slice($params, 0, -2)); // Remove limit and offset
        $total = $countStmt->fetchColumn();
        
        sendResponse([
            'view' => $viewName,
            'data' => $results,
            'pagination' => [
                'total' => (int)$total,
                'limit' => $limit,
                'offset' => $offset,
                'has_more' => ($offset + $limit) < $total
            ]
        ], 'View data retrieved successfully');
        
    } catch (PDOException $e) {
        error_log("Views API error: " . $e->getMessage());
        sendError('Failed to retrieve view data: ' . $e->getMessage(), 500);
    }
} else {
    sendError('Method not allowed', 405);
}

