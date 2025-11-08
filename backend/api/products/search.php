<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

header('Content-Type: application/json');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
  // ---------------- Inputs ----------------
  $branchId  = isset($_GET['branch_id']) ? (int)$_GET['branch_id'] : 0;
  $currency  = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';
  $q         = isset($_GET['q']) ? trim($_GET['q']) : '';
  $platform  = isset($_GET['platform']) ? trim($_GET['platform']) : '';   // e.g. "PS5,PC"
  $genreId   = isset($_GET['genre_id']) ? (int)$_GET['genre_id'] : 0;     // or 0 for all
  $year      = isset($_GET['year']) ? (int)$_GET['year'] : 0;
  $month     = isset($_GET['month']) ? (int)$_GET['month'] : 0;
  $inStock   = isset($_GET['in_stock']) ? (int)$_GET['in_stock'] : 0;

  $priceMin  = isset($_GET['price_min']) ? (float)$_GET['price_min'] : 0.0;
  $priceMax  = isset($_GET['price_max']) ? (float)$_GET['price_max'] : 0.0;

  $page      = max(1, (int)($_GET['page'] ?? 1));
  $limit     = max(1, min(50, (int)($_GET['limit'] ?? 12)));
  $offset    = ($page - 1) * $limit;

  $sort      = $_GET['sort'] ?? 'newest'; // newest | price_asc | price_desc

  // ---------------- Currency & rate ----------------
  $curStmt = $pdo->prepare("SELECT rate_to_php FROM currencies WHERE code = ? AND is_active = 1 LIMIT 1");
  $curStmt->execute([$currency]);
  $row = $curStmt->fetch(PDO::FETCH_ASSOC);
  if (!$row) sendError('Invalid or inactive currency', 400);

  $rate = (float)$row['rate_to_php'];
  $base = 'price'; // base price column in PHP
  // Use a numeric literal for rate to avoid placeholder repetition issues
  $displayExpr = ($currency === 'PHP') ? "p.$base" : "ROUND(p.$base * {$rate}, 2)";

  // ---------------- Stock SQL (branch-aware) ----------------
  if ($branchId > 0) {
    $branchIdInt = (int)$branchId;
    $stockExpr = "(SELECT COALESCE(pi.stock_qty,0) FROM product_inventory pi
                   WHERE pi.branch_id = {$branchIdInt} AND pi.product_id = p.product_id)";
  } else {
    $stockExpr = "(SELECT COALESCE(SUM(pi.stock_qty),0) FROM product_inventory pi
                   WHERE pi.product_id = p.product_id)";
  }

  // ---------------- Dynamic WHERE ----------------
  $wheres = [];
  $params = [];

  if ($q !== '') {
    $wheres[] = "(p.product_name LIKE ? OR p.brand LIKE ? OR p.model LIKE ?)";
    $like = "%{$q}%";
    array_push($params, $like, $like, $like);
  }

  if ($platform !== '') {
    $parts = array_filter(array_map('trim', explode(',', $platform)));
    if ($parts) {
      $marks = implode(',', array_fill(0, count($parts), '?'));
      $wheres[] = "p.platform IN ($marks)";
      foreach ($parts as $pl) $params[] = $pl;
    }
  }

  if ($genreId > 0) {
    $wheres[] = "p.genre_id = ?";
    $params[] = $genreId;
  }

  if ($year > 0) {
    $wheres[] = "YEAR(p.release_date) = ?";
    $params[] = $year;
  }
  if ($month > 0) {
    $wheres[] = "MONTH(p.release_date) = ?";
    $params[] = $month;
  }

  // Price filter (in selected currency) using displayExpr
  if ($priceMin > 0) {
    $wheres[] = "$displayExpr >= ?";
    $params[] = $priceMin;
  }
  if ($priceMax > 0) {
    $wheres[] = "$displayExpr <= ?";
    $params[] = $priceMax;
  }

  if ($inStock === 1) {
    // Use the same stockExpr in WHERE; no extra params since we embedded branchId as int
    $wheres[] = "($stockExpr) > 0";
  }

  $whereClause = $wheres ? ('WHERE ' . implode(' AND ', $wheres)) : '';

  // ---------------- Sorting ----------------
  $orderBy = "p.created_at DESC, p.product_id DESC";
  if ($sort === 'price_asc')  $orderBy = "$displayExpr ASC";
  if ($sort === 'price_desc') $orderBy = "$displayExpr DESC";

  // ---------------- Branch filtering: Only show products with inventory in branch ----------------
  $branchJoin = '';
  $branchWhere = '';
  if ($branchId > 0) {
    // When branch_id is provided, only show products that have inventory in that branch
    $branchJoin = "INNER JOIN product_inventory pi ON p.product_id = pi.product_id AND pi.branch_id = {$branchIdInt}";
    // Only show products with stock > 0 in that branch
    $branchWhere = "AND pi.stock_qty > 0";
  }

  // ---------------- Count (for pagination) ----------------
  $countSql = "
    SELECT COUNT(*) AS cnt
    FROM products p
    $branchJoin
    LEFT JOIN categories c ON c.category_id = p.category_id
    LEFT JOIN genres g ON g.genre_id = p.genre_id
    $whereClause
    $branchWhere
  ";
  $countStmt = $pdo->prepare($countSql);
  $countStmt->execute($params);
  $total = (int)$countStmt->fetchColumn();

  // ---------------- Main query ----------------
  $sql = "
    SELECT
      p.product_id,
      p.product_name,
      p.brand,
      p.model,
      p.platform,
      p.release_date,
      p.$base AS price,
      ? AS currency,
      $displayExpr AS display_price,
      $stockExpr AS stock_quantity,
      (SELECT image_url FROM product_images
         WHERE product_id = p.product_id AND is_primary = 1
         ORDER BY sort_order ASC, created_at ASC
         LIMIT 1) AS primary_image_url,
      g.genre_name,
      c.category_name,
      p.created_at
    FROM products p
    $branchJoin
    LEFT JOIN categories c ON c.category_id = p.category_id
    LEFT JOIN genres g ON g.genre_id = p.genre_id
    $whereClause
    $branchWhere
    ORDER BY $orderBy
    LIMIT :limit OFFSET :offset
  ";

  // currency first, then WHERE params
  $mainParams = array_merge([$currency], $params);

  $stmt = $pdo->prepare($sql);
  // bind currency + dynamic filter params
  $i = 1;
  foreach ($mainParams as $val) {
    $stmt->bindValue($i++, $val, is_int($val) ? PDO::PARAM_INT : PDO::PARAM_STR);
  }
  // bind limit/offset as INT
  $stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
  $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

  $stmt->execute();
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  sendResponse([
    'products' => $rows,
    'pagination' => [
      'page'  => $page,
      'limit' => $limit,
      'total' => $total,
      'pages' => (int)ceil($total / $limit),
    ],
  ], 'OK');

} catch (Throwable $e) {
  sendError('Search failed: '.$e->getMessage(), 500);
}
