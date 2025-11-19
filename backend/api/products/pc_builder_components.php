<?php
// /api/pc_builder_components.php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/currency_api.php';

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    // Get currency from query parameter, default to PHP
    $currency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';
    
    // Validate currency code
    if (!isValidCurrencyCode($currency)) {
        sendError('Invalid currency code', 400);
    }
    
    // Get exchange rate from API (automatic, always up-to-date)
    $rateToPhp = getExchangeRateFromAPI($currency);
    if ($rateToPhp === null) {
        sendError('Failed to fetch exchange rate for ' . $currency, 500);
    }
    
    // Adjust these to match the rows in your `categories` table
    $pcCategories = [
        'CPU',
        'Motherboard',
        'GPU',
        'RAM',
        'Storage',
        'Power Supply',
        'Case',
        'CPU Cooler',
        'Fan'
    ];

    // Create placeholders for IN (...)
    $placeholders = implode(',', array_fill(0, count($pcCategories), '?'));
    
    // Base price column (stored in PHP)
    $base = 'price';
    $rateSql = ($currency === 'PHP') ? "p.$base" : "ROUND(p.$base * $rateToPhp, 2)";

    $sql = "
        SELECT 
            c.category_id,
            c.category_name,
            p.product_id,
            p.product_name,
            p.brand,
            p.model,
            p.$base AS price_php,
            ? AS currency,
            $rateSql AS price,
            (SELECT image_url FROM product_images
              WHERE product_id=p.product_id AND is_primary=1
              ORDER BY sort_order ASC, created_at ASC LIMIT 1) AS primary_image_url
        FROM products p
        INNER JOIN categories c ON c.category_id = p.category_id
        WHERE c.category_name IN ($placeholders)
        ORDER BY c.category_name, p.product_name
    ";

    // Parameters: currency, then category names
    $params = array_merge([$currency], $pcCategories);
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Group products by category
    $grouped = [];
    foreach ($rows as $row) {
        $cid = (int)$row['category_id'];

        if (!isset($grouped[$cid])) {
            $grouped[$cid] = [
                'category_id'   => $cid,
                'category_name' => $row['category_name'],
                'products'      => []
            ];
        }

        $grouped[$cid]['products'][] = [
            'product_id'       => (int)$row['product_id'],
            'product_name'     => $row['product_name'],
            'brand'            => $row['brand'],
            'model'            => $row['model'],
            'price'            => (float)$row['price'],
            'price_php'        => (float)$row['price_php'], // Base price in PHP
            'currency'         => $row['currency'],
            'primary_image_url'=> $row['primary_image_url']
        ];
    }

    sendResponse(
        ['categories' => array_values($grouped)],
        'PC builder components loaded successfully'
    );

} catch (PDOException $e) {
    error_log('PC Builder Components: PDOException - ' . $e->getMessage());
    sendError('Failed to load PC builder components', 500);
} catch (Exception $e) {
    error_log('PC Builder Components: Exception - ' . $e->getMessage());
    sendError('Failed to load PC builder components', 500);
}
