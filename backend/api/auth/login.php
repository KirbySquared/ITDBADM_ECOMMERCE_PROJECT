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
$stmt = $pdo->prepare("SELECT id, first_name, last_name, email, password FROM users WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user) {
    sendError('Invalid credentials', 401);
}

// Verify password
if (!password_verify($password, $user['password'])) {
    sendError('Invalid credentials', 401);
}

// Generate token
$token = generateToken($user['id']);

// Remove password from response
unset($user['password']);

sendResponse([
    'user' => $user,
    'token' => $token
], 'Login successful');
?>
