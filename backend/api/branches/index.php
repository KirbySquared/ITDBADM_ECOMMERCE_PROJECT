<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

header('Content-Type: application/json');

try {
  $stmt = $pdo->query("SELECT branch_id, branch_name, address FROM branches ORDER BY branch_name");
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
  sendResponse(['branches' => $rows], 'Branches loaded');
} catch (Throwable $e) {
  sendError('Failed to fetch branches: '.$e->getMessage(), 500);
}
