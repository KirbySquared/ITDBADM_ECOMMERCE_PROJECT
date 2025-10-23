<?php
require_once '../../config/database.php';
require_once '../../utils/response.php';

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

// Find user by email
$stmt = $pdo->prepare("SELECT user_id, first_name, last_name, email, password_hash FROM users WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user) {
    sendError('Invalid credentials', 401);
}

// Verify password
if (!password_verify($password, $user['password_hash'])) {
    sendError('Invalid credentials', 401);
}

// Generate token
$token = generateToken($user['user_id']);

// Remove password from response
unset($user['password_hash']);

sendResponse([
    'user' => $user,
    'token' => $token
], 'Login successful');
?>
