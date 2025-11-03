<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
header('Content-Type: application/json');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
  $id       = isset($_GET['id']) ? (int)$_GET['id'] : 0;
  $branchId = isset($_GET['branch_id']) ? (int)$_GET['branch_id'] : 0;
  $currency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';

  if ($id <= 0) sendError('Invalid product ID', 400);

  $cur = $pdo->prepare("SELECT code, rate_to_php FROM currencies WHERE code=? AND is_active=1 LIMIT 1");
  $cur->execute([$currency]);
  $row = $cur->fetch(PDO::FETCH_ASSOC);
  if (!$row) sendError('Invalid or inactive currency', 400);
  $rate = (float)$row['rate_to_php'];

  $base = 'price';
  $rateSql = ($currency === 'PHP') ? "p.$base" : "ROUND(p.$base * $rate, 2)";
  $stockSql = ($branchId > 0)
    ? "(SELECT COALESCE(pi.stock_qty,0) FROM product_inventory pi WHERE pi.branch_id=? AND pi.product_id=p.product_id) AS stock_quantity"
    : "(SELECT COALESCE(SUM(pi.stock_qty),0) FROM product_inventory pi WHERE pi.product_id=p.product_id) AS stock_quantity";

  $sql = "
    SELECT p.product_id, p.product_name, p.brand, p.model, p.description,
           p.$base AS price_php, ? AS currency, $rateSql AS display_price,
           (SELECT image_url FROM product_images WHERE product_id=p.product_id AND is_primary=1 ORDER BY sort_order, created_at LIMIT 1) AS primary_image_url,
           $stockSql,
           c.category_name, p.created_at
    FROM products p
    LEFT JOIN categories c ON c.category_id=p.category_id
    WHERE p.product_id=? LIMIT 1";
  $params = ($branchId > 0) ? [$currency, $branchId, $id] : [$currency, $id];

  $st = $pdo->prepare($sql);
  $st->execute($params);
  $prod = $st->fetch(PDO::FETCH_ASSOC);
  if (!$prod) sendError('Product not found', 404);

  $imgs = $pdo->prepare("SELECT image_id,image_url,alt_text,is_primary,sort_order,created_at FROM product_images WHERE product_id=? ORDER BY is_primary DESC, sort_order, created_at");
  $imgs->execute([$id]);
  $prod['images'] = $imgs->fetchAll(PDO::FETCH_ASSOC);

  sendResponse(['product'=>$prod], 'OK');
} catch (Throwable $e) {
  sendError('Failed to retrieve product (get_product): '.$e->getMessage(), 500);
}
