<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

// Get request data
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$errors = validateRequired($input, ['email', 'password']);
if (!empty($errors)) {
    sendError('Validation failed', 400, $errors);
}

// Sanitize input
$email = sanitizeInput($input['email']);
$password = $input['password'];

// Find user by email (now also selecting status)
$stmt = $pdo->prepare("
    SELECT user_id, username, first_name, last_name, email, phone, address, password_hash, status
    FROM users
    WHERE email = ?
");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user) {
    sendError('Invalid credentials', 401);
}

// Verify password
if (!password_verify($password, $user['password_hash'])) {
    sendError('Invalid credentials', 401);
}

// At this point, credentials are valid — set status to 'active'
try {
    $upd = $pdo->prepare("
        UPDATE users
        SET status = 'active'   
        WHERE user_id = ?
    ");
    $upd->execute([$user['user_id']]);

    // Reflect the updated status in the response without extra round-trip
    $user['status'] = 'active';
} catch (Exception $e) {
    // If updating status fails, still avoid leaking internals to the client
    // You can log $e->getMessage() server-side if desired.
}

// Generate token
$token = generateToken($user['user_id']);

// Remove password from response
unset($user['password_hash']);

// Respond
sendResponse([
    'user' => $user,
    'token' => $token
], 'Login successful');
