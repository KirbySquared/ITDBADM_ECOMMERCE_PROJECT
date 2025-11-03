<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/response.php';
header('Content-Type: application/json');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// TODO: replace with your real auth; must return current user_id
function requireUserId(): int {
  $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
  if (!$auth) sendError('Unauthorized', 401);
  return 1; // stub
}

try {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') sendError('Method not allowed', 405);

  $userId    = requireUserId();
  $input     = json_decode(file_get_contents('php://input'), true) ?? [];
  $productId = (int)($input['product_id'] ?? 0);
  $qty       = max(1, (int)($input['quantity'] ?? 1));
  if ($productId <= 0) sendError('product_id required', 422);

  // (optional) verify product exists
  $chk = $pdo->prepare("SELECT product_id FROM products WHERE product_id = ? LIMIT 1");
  $chk->execute([$productId]);
  if (!$chk->fetch()) sendError('Product not found', 404);

  $pdo->beginTransaction();

  // lock existing cart row for upsert
  $sel = $pdo->prepare("SELECT cart_id, quantity FROM cart WHERE user_id = ? AND product_id = ? FOR UPDATE");
  $sel->execute([$userId, $productId]);
  $row = $sel->fetch(PDO::FETCH_ASSOC);

  if ($row) {
    $upd = $pdo->prepare("UPDATE cart SET quantity = ?, added_at = NOW() WHERE cart_id = ?");
    $upd->execute([(int)$row['quantity'] + $qty, $row['cart_id']]);
  } else {
    $ins = $pdo->prepare("INSERT INTO cart (user_id, product_id, quantity, added_at) VALUES (?, ?, ?, NOW())");
    $ins->execute([$userId, $productId, $qty]);
  }

  $pdo->commit();
  sendResponse(['ok' => true], 'Added to cart');
} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  sendError($e->getMessage(), 500);
}
