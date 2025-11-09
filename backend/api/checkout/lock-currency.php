<?php
/**
 * CURRENCY LOCK ENDPOINT
 * 
 * Locks the exchange rate for checkout to prevent price changes during checkout process.
 * 
 * POST /api/checkout/lock-currency
 * Body: { "currency": "USD" }
 * 
 * Returns: { lock_id, currency, rate_to_php, locked_at, expires_at }
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

header('Content-Type: application/json');

// Get authorization header
$headers = getallheaders();
$token = null;

if (isset($headers['Authorization'])) {
    $token = str_replace('Bearer ', '', $headers['Authorization']);
}
if (!$token) {
    sendError('Authorization token required', 401);
}

// Validate token
$userId = validateToken($token);
if (!$userId) {
    sendError('Invalid or expired token', 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $currency = strtoupper(trim($input['currency'] ?? 'PHP'));
    
    // Validate currency exists and is active
    $stmt = $pdo->prepare("SELECT code, rate_to_php FROM currencies WHERE code = ? AND is_active = 1 LIMIT 1");
    $stmt->execute([$currency]);
    $currencyRow = $stmt->fetch();
    
    if (!$currencyRow) {
        sendError('Invalid or inactive currency', 400);
    }
    
    $rateToPhp = (float)$currencyRow['rate_to_php'];
    
    // Generate unique lock ID
    $lockId = bin2hex(random_bytes(16));
    $lockedAt = date('Y-m-d H:i:s');
    $expiresAt = date('Y-m-d H:i:s', strtotime('+30 minutes')); // Lock expires in 30 minutes
    
    // Store lock in session or database (using a simple approach with a locks table or session)
    // For simplicity, we'll return the lock data and the frontend will store it in sessionStorage
    // In production, you might want to store this in a database table
    
    sendResponse([
        'lock_id' => $lockId,
        'currency' => $currency,
        'rate_to_php' => $rateToPhp,
        'locked_at' => $lockedAt,
        'expires_at' => $expiresAt
    ], 'Currency locked successfully');
    
} catch (PDOException $e) {
    error_log('Currency lock error: ' . $e->getMessage());
    sendError('Failed to lock currency', 500);
} catch (Exception $e) {
    error_log('Currency lock error: ' . $e->getMessage());
    sendError('Failed to lock currency', 500);
}
?>

