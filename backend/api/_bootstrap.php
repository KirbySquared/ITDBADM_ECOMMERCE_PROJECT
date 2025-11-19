<?php
// api/_bootstrap.php

// ---- CORS (adjust origin if your dev server is different)
$origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost:5173';
header("Access-Control-Allow-Origin: $origin");
header("Vary: Origin");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// ---- JSON helpers
function ok($data) { echo json_encode(['success'=>true,'data'=>$data], JSON_UNESCAPED_UNICODE); exit; }
function bad($code, $msg) { http_response_code($code); echo json_encode(['success'=>false,'message'=>$msg]); exit; }

// ---- DB connection
// Prefer your existing database.php if it sets $pdo (PDO) already.
$pdo = null;
$databasePhp = __DIR__ . '/../database.php'; // adjust if your file lives elsewhere
if (file_exists($databasePhp)) {
  require_once $databasePhp; // should create $pdo = new PDO(...)
}

if (!$pdo) {
  // Fallback: read from .env if database.php didn't set $pdo
  $rootEnv = __DIR__ . '/../.env';
  $env = [];
  if (file_exists($rootEnv)) {
    foreach (file($rootEnv, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
      if (str_starts_with(trim($line), '#')) continue;
      [$k, $v] = array_map('trim', explode('=', $line, 2));
      $env[$k] = $v;
    }
  }
  $hostRaw = $env['DB_HOST'] ?? '127.0.0.1';
  $port = 3306;
  if (strpos($hostRaw, ':') !== false) { [$hostRaw, $port] = explode(':', $hostRaw, 2); }
  $port = (int)($env['DB_PORT'] ?? $port);
  $db   = $env['DB_NAME'] ?? 'electronics_store';
  $user = $env['DB_USER'] ?? 'root';
  $pass = $env['DB_PASS'] ?? '';

  $dsn = "mysql:host=$hostRaw;port=$port;dbname=$db;charset=utf8mb4";
  try {
    $pdo = new PDO($dsn, $user, $pass, [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
  } catch (Throwable $e) {
    bad(500, 'DB connection failed: ' . $e->getMessage());
  }
}

// Small helper: ensure currency is valid (now uses API, not database)
function ensure_currency(PDO $pdo, string $code) {
  // Validate currency code instead of checking database
  $supportedCurrencies = ['PHP', 'USD', 'KRW', 'JPY', 'EUR', 'GBP', 'CAD', 'AUD'];
  if (!in_array(strtoupper($code), $supportedCurrencies)) {
    bad(400, "Currency $code is not supported.");
  }
}
