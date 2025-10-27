<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

// Get request data
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$errors = validateRequired($input, ['username', 'first_name', 'last_name', 'email', 'password']);

if (!empty($errors)) {
    sendError('Validation failed', 400, $errors);
}

// Sanitize input
$username = sanitizeInput($input['username']);
$firstName = sanitizeInput($input['first_name']);
$lastName = sanitizeInput($input['last_name']);
$email = sanitizeInput($input['email']);
$password = $input['password'];

// Validate username format (3-20 characters, alphanumeric and underscores only)
if (strlen($username) < 3 || strlen($username) > 20) {
    sendError('Username must be between 3 and 20 characters', 400);
}

if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
    sendError('Username can only contain letters, numbers, and underscores', 400);
}

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendError('Invalid email format', 400);
}

// Check if username already exists
$stmt = $pdo->prepare("SELECT user_id FROM users WHERE username = ?");
$stmt->execute([$username]);

if ($stmt->fetch()) {
    sendError('Username already exists. Please choose a different username.', 409);
}

// Check if email already exists
$stmt = $pdo->prepare("SELECT user_id FROM users WHERE email = ?");
$stmt->execute([$email]);

if ($stmt->fetch()) {
    sendError('User with this email already exists', 409);
}

// Hash password
$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

// Insert new user
try {
    $stmt = $pdo->prepare("
        INSERT INTO users (username, first_name, last_name, email, password_hash) 
        VALUES (?, ?, ?, ?, ?)
    ");
    
    $stmt->execute([$username, $firstName, $lastName, $email, $hashedPassword]);
    
    $userId = $pdo->lastInsertId();
    
    // Generate token
    $token = generateToken($userId);
    
    // Get created user with all fields
    $stmt = $pdo->prepare("SELECT user_id, username, first_name, last_name, email, phone, address, role FROM users WHERE user_id = ?");
    $stmt->execute([$userId]);
    $newUser = $stmt->fetch();
    
    sendResponse([
        'user' => $newUser,
        'token' => $token
    ], 'User registered successfully', 201);
    
} catch (PDOException $e) {
    sendError('Registration failed', 500);
}
?>
