<?php
// backend/api/products/search.php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

header('Content-Type: application/json');

try {
    // Check if user is logged in and get their branch_id (case-insensitive header check)
    $userBranchId = null;
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $token = null;
    
    // Case-insensitive header check
    foreach ($headers as $k => $v) {
        if (strtolower($k) === 'authorization') {
            $token = preg_replace('/^Bearer\s+/i', '', $v);
            break;
        }
    }
    
    // If token exists, validate it and get user's branch_id
    if ($token) {
        error_log("Products/Search: Token found, length: " . strlen($token) . ", first 20 chars: " . substr($token, 0, 20));
        $userId = validateToken($token);
        if ($userId) {
            $userStmt = $pdo->prepare("SELECT branch_id FROM users WHERE user_id = ?");
            $userStmt->execute([$userId]);
            $user = $userStmt->fetch(PDO::FETCH_ASSOC);
            if ($user && $user['branch_id']) {
                $userBranchId = (int)$user['branch_id'];
                error_log("Products/Search: User logged in with branch_id = " . $userBranchId);
            } else {
                error_log("Products/Search: User logged in but no branch_id found (user_id: " . $userId . ")");
            }
        } else {
            // Token is expired or invalid - treat as non-logged-in user (allow browsing)
            error_log("Products/Search: Token validation failed - treating as non-logged-in user");
            $userBranchId = null;
        }
    } else {
        error_log("Products/Search: No Authorization header found - showing products without branch assignment");
    }
    
    // Currency
    $currency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';

    // Branch - use user's branch_id if logged in, otherwise use query param
    $branchId = $userBranchId !== null ? $userBranchId : (isset($_GET['branch_id']) && $_GET['branch_id'] !== '' ? (int)$_GET['branch_id'] : null);

    // Keyword
    $q = isset($_GET['q']) ? trim($_GET['q']) : '';

    // Category (stored procedure uses genre_id parameter to filter by category_id)
    $categoryId = isset($_GET['category_id']) && $_GET['category_id'] !== ''
        ? (int)$_GET['category_id']
        : null;

    // Genre (for actual genre filtering - currently stored procedure doesn't support this, but keeping for future)
    $genreId = isset($_GET['genre_id']) && $_GET['genre_id'] !== ''
        ? (int)$_GET['genre_id']
        : null;
    
    // Use category_id for stored procedure (it uses genre_id parameter to filter by category_id)
    // If both are provided, category_id takes precedence
    $spCategoryFilter = $categoryId !== null ? $categoryId : null;

    // Year / Month
    $year  = isset($_GET['year'])  && $_GET['year']  !== '' ? (int)$_GET['year']  : null;
    $month = isset($_GET['month']) && $_GET['month'] !== '' ? (int)$_GET['month'] : null;

    // Price range (in display currency, but SP uses PHP base directly)
    $priceMin = isset($_GET['price_min']) && $_GET['price_min'] !== '' ? (float)$_GET['price_min'] : null;
    $priceMax = isset($_GET['price_max']) && $_GET['price_max'] !== '' ? (float)$_GET['price_max'] : null;

    // In-stock filter
    $inStock = isset($_GET['in_stock']) && $_GET['in_stock'] === '1' ? 1 : 0;

    // Sorting and pagination
    $sort  = isset($_GET['sort']) && $_GET['sort'] !== '' ? $_GET['sort'] : 'newest';
    $page  = isset($_GET['page']) && (int)$_GET['page'] > 0 ? (int)$_GET['page'] : 1;
    $limit = isset($_GET['limit']) && (int)$_GET['limit'] > 0 ? (int)$_GET['limit'] : 12;
    $offset = ($page - 1) * $limit;

    // DEBUG: Log all parameters before calling stored procedure
    error_log("Products/Search: ========== SEARCH REQUEST ==========");
    error_log("Products/Search: userBranchId = " . ($userBranchId !== null ? $userBranchId : 'NULL'));
    error_log("Products/Search: branchId (final) = " . ($branchId !== null ? $branchId : 'NULL'));
    error_log("Products/Search: currency = " . $currency);
    error_log("Products/Search: q = " . ($q ?: 'NULL'));
    error_log("Products/Search: categoryId = " . ($categoryId !== null ? $categoryId : 'NULL'));
    error_log("Products/Search: genreId = " . ($genreId !== null ? $genreId : 'NULL'));
    error_log("Products/Search: spCategoryFilter = " . ($spCategoryFilter !== null ? $spCategoryFilter : 'NULL'));
    error_log("Products/Search: year = " . ($year !== null ? $year : 'NULL'));
    error_log("Products/Search: month = " . ($month !== null ? $month : 'NULL'));
    error_log("Products/Search: priceMin = " . ($priceMin !== null ? $priceMin : 'NULL'));
    error_log("Products/Search: priceMax = " . ($priceMax !== null ? $priceMax : 'NULL'));
    error_log("Products/Search: inStock = " . $inStock);
    error_log("Products/Search: sort = " . $sort);
    error_log("Products/Search: page = " . $page);
    error_log("Products/Search: limit = " . $limit);
    error_log("Products/Search: offset = " . $offset);
    
    // Check if there are any products without branch assignment (for non-logged-in users)
    if ($branchId === null) {
        $checkStmt = $pdo->query("SELECT COUNT(*) as count FROM products p WHERE NOT EXISTS (SELECT 1 FROM product_inventory pi WHERE pi.product_id = p.product_id)");
        $checkResult = $checkStmt->fetch(PDO::FETCH_ASSOC);
        error_log("Products/Search: [DEBUG] Total products without branch assignment = " . ($checkResult['count'] ?? 0));
    }

    // Prepare call to stored procedure (now updated to handle branch filtering correctly)
    // Note: stored procedure uses p_genre_id parameter to filter by category_id
    $stmt = $pdo->prepare("CALL sp_search_products_advanced(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $currency,
        $branchId,  // NULL for non-logged-in users, branch_id for logged-in users
        $q,
        $spCategoryFilter,  // Use category_id for category filtering (stored procedure uses this param to filter by category_id)
        $year,
        $month,
        $priceMin,
        $priceMax,
        $inStock,
        $sort,
        $limit,
        $offset
    ]);

    // SP returns:
    //  - first result set: total count (1 row)
    //  - second result set: actual product rows

    // 1) total
    $totalRow = $stmt->fetch(PDO::FETCH_ASSOC);
    $total = (int)($totalRow['total'] ?? 0);
    error_log("Products/Search: [DEBUG] Stored procedure returned total = " . $total);

    // Move to next result set (products)
    $stmt->nextRowset();
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    error_log("Products/Search: [DEBUG] Stored procedure returned " . count($products) . " products");

    // Defensive fallback
    if ($total === 0) {
        $total = count($products);
        error_log("Products/Search: [DEBUG] Total was 0, using count of products array = " . $total);
    }

    $pages = $limit > 0 ? (int)ceil($total / $limit) : 1;
    
    error_log("Products/Search: [DEBUG] Final response: total = " . $total . ", products count = " . count($products) . ", pages = " . $pages);
    error_log("Products/Search: ========== END SEARCH REQUEST ==========");

    sendResponse([
        'products' => $products,
        'pagination' => [
            'page'  => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => $pages,
        ]
    ], 'Products search successful');

} catch (PDOException $e) {
    // You can log $e->getMessage() here
    sendError('Failed to perform advanced search: ' . $e->getMessage(), 500);
}
