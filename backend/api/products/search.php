<?php
// backend/api/products/search.php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

header('Content-Type: application/json');

try {
    // Currency
    $currency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';

    // Branch (nullable)
    $branchId = isset($_GET['branch_id']) && $_GET['branch_id'] !== ''
        ? (int)$_GET['branch_id']
        : null;

    // Keyword
    $q = isset($_GET['q']) ? trim($_GET['q']) : '';

    // Genre
    $genreId = isset($_GET['genre_id']) && $_GET['genre_id'] !== ''
        ? (int)$_GET['genre_id']
        : null;

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

    // Prepare call to stored procedure
    $stmt = $pdo->prepare("CALL sp_search_products_advanced(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $currency,
        $branchId,
        $q,
        $genreId,
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
    // BUT we defined SP in opposite order (count then rows),
    // so we have to read them carefully:

    // 1) total
    $totalRow = $stmt->fetch(PDO::FETCH_ASSOC);
    $total = (int)($totalRow['total'] ?? 0);

    // Move to next result set (products)
    $stmt->nextRowset();
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Defensive fallback
    if ($total === 0) {
        $total = count($products);
    }

    $pages = $limit > 0 ? (int)ceil($total / $limit) : 1;

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
