<?php
error_log("=== PRODUCTS/GET_PRODUCTS.PHP CALLED ===");
error_log("Request URI: " . $_SERVER['REQUEST_URI']);
error_log("GET params: " . json_encode($_GET));

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
header('Content-Type: application/json');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Check if this is a PC builder request
if (isset($_GET['pc_builder']) && $_GET['pc_builder'] == '1') {
    error_log("Products: Routing to pc_builder_components.php");
    include __DIR__ . '/pc_builder_components.php';
    exit;
}

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
    error_log("Get_Products: Token found, length: " . strlen($token) . ", first 20 chars: " . substr($token, 0, 20));
    $userId = validateToken($token);
    if ($userId) {
      $userStmt = $pdo->prepare("SELECT branch_id FROM users WHERE user_id = ?");
      $userStmt->execute([$userId]);
      $user = $userStmt->fetch(PDO::FETCH_ASSOC);
      if ($user && $user['branch_id']) {
        $userBranchId = (int)$user['branch_id'];
        error_log("Get_Products: User logged in with branch_id = " . $userBranchId);
      } else {
        error_log("Get_Products: User logged in but no branch_id found (user_id: " . $userId . ")");
      }
    } else {
      // Token is expired or invalid - return 401
      error_log("Get_Products: Token validation failed - returning 401");
      sendError('Token expired. Please login again', 401);
    }
  } else {
    error_log("Get_Products: No Authorization header found - showing all products");
  }
  
  // Use user's branch_id if logged in, otherwise use query param (for non-logged-in users or admin override)
  $branchId = $userBranchId !== null ? $userBranchId : (isset($_GET['branch_id']) ? (int)$_GET['branch_id'] : 0);
  $limit    = isset($_GET['limit']) ? (int)$_GET['limit'] : 0;
  $currency = isset($_GET['currency']) ? strtoupper(trim($_GET['currency'])) : 'PHP';
  
  error_log("Get_Products: branchId = " . $branchId . " (userBranchId: " . ($userBranchId ?? 'null') . "), currency = " . $currency . ", limit = " . $limit);

  $cur = $pdo->prepare("SELECT code, rate_to_php FROM currencies WHERE code=? AND is_active=1 LIMIT 1");
  $cur->execute([$currency]);
  $row = $cur->fetch(PDO::FETCH_ASSOC);
  if (!$row) sendError('Invalid or inactive currency', 400);
  $rate = (float)$row['rate_to_php'];

  $base = 'price';
  $rateSql = ($currency === 'PHP') ? "p.$base" : "ROUND(p.$base * $rate, 2)";
  
  // If user is logged in, start from product_inventory filtered by branch_id, then join to products
  // If user is not logged in, show all products (no branch filter)
  if ($userBranchId !== null) {
    // User is logged in - Start from product_inventory filtered by user's branch_id
    $sql = "
      SELECT p.product_id, p.product_name, p.brand, p.model,
             p.$base AS price, ? AS currency, $rateSql AS display_price,
             pi_img.image_url AS primary_image_url,
             pi.stock_qty AS stock_quantity,
             c.category_name, p.created_at
      FROM product_inventory pi
      INNER JOIN products p ON pi.product_id = p.product_id
      LEFT JOIN categories c ON c.category_id = p.category_id
      LEFT JOIN (
        SELECT product_id, image_url,
          ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY is_primary DESC, sort_order ASC, created_at ASC) as rn
        FROM product_images
        WHERE is_primary = 1
      ) pi_img ON pi_img.product_id = p.product_id AND pi_img.rn = 1
      WHERE pi.branch_id = ?
      ORDER BY p.created_at DESC, p.product_id DESC";
    if ($limit > 0) $sql .= " LIMIT ".(int)$limit;

    // Parameters: currency, branch_id
    $params = [$currency, $branchId];
  } else {
    // User not logged in - show all products (no branch filter)
    $sql = "
      SELECT p.product_id, p.product_name, p.brand, p.model,
             p.$base AS price, ? AS currency, $rateSql AS display_price,
             pi_img.image_url AS primary_image_url,
             COALESCE(SUM(pi.stock_qty), 0) AS stock_quantity,
             c.category_name, p.created_at
      FROM products p
      LEFT JOIN categories c ON c.category_id = p.category_id
      LEFT JOIN product_inventory pi ON pi.product_id = p.product_id
      LEFT JOIN (
        SELECT product_id, image_url,
          ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY is_primary DESC, sort_order ASC, created_at ASC) as rn
        FROM product_images
        WHERE is_primary = 1
      ) pi_img ON pi_img.product_id = p.product_id AND pi_img.rn = 1
      WHERE 1=1
      GROUP BY p.product_id, p.product_name, p.brand, p.model, p.$base, pi_img.image_url, c.category_name, p.created_at
      ORDER BY p.created_at DESC, p.product_id DESC";
    if ($limit > 0) $sql .= " LIMIT ".(int)$limit;

    // Parameters: currency only
    $params = [$currency];
  }
  $st = $pdo->prepare($sql);
  $st->execute($params);
  $rows = $st->fetchAll(PDO::FETCH_ASSOC);

  error_log("Get_Products: Success - Found " . count($rows) . " products");
  sendResponse(['products'=>$rows], 'OK');
} catch (Throwable $e) {
  error_log("Get_Products: ERROR - " . $e->getMessage());
  error_log("Get_Products: Stack trace: " . $e->getTraceAsString());
  sendError('Failed to retrieve products (get_products): '.$e->getMessage(), 500);
}
