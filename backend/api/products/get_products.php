<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
header('Content-Type: application/json');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
  $branchId = isset($_GET['branch_id']) ? (int)$_GET['branch_id'] : 0;
  $limit    = isset($_GET['limit']) ? (int)$_GET['limit'] : 0;
  $currency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';

  $cur = $pdo->prepare("SELECT code, rate_to_php FROM currencies WHERE code=? AND is_active=1 LIMIT 1");
  $cur->execute([$currency]);
  $row = $cur->fetch(PDO::FETCH_ASSOC);
  if (!$row) sendError('Invalid or inactive currency', 400);
  $rate = (float)$row['rate_to_php'];

  $base = 'price';
  $rateSql = ($currency === 'PHP') ? "p.$base" : "ROUND(p.$base * $rate, 2)";
  $stockSql = ($branchId > 0)
    ? "(SELECT COALESCE(pi.stock_qty,0) FROM product_inventory pi WHERE pi.branch_id=? AND pi.product_id=p.product_id)"
    : "(SELECT COALESCE(SUM(pi.stock_qty),0) FROM product_inventory pi WHERE pi.product_id=p.product_id)";

  $sql = "
    SELECT p.product_id, p.product_name, p.brand, p.model,
           p.$base AS price, ? AS currency, $rateSql AS display_price,
           (SELECT image_url FROM product_images WHERE product_id=p.product_id AND is_primary=1 ORDER BY sort_order, created_at LIMIT 1) AS primary_image_url,
           $stockSql AS stock_quantity,
           c.category_name, p.created_at
    FROM products p
    LEFT JOIN categories c ON c.category_id=p.category_id
    ORDER BY p.created_at DESC, p.product_id DESC";
  if ($limit > 0) $sql .= " LIMIT ".(int)$limit;

  $params = ($branchId > 0) ? [$currency, $branchId] : [$currency];
  $st = $pdo->prepare($sql);
  $st->execute($params);
  $rows = $st->fetchAll(PDO::FETCH_ASSOC);

  sendResponse(['products'=>$rows], 'OK');
} catch (Throwable $e) {
  sendError('Failed to retrieve products (get_products): '.$e->getMessage(), 500);
}
