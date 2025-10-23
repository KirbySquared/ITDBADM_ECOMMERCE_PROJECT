<?php
require_once '../../config/database.php';
require_once '../../utils/response.php';

// Get request data
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$errors = validateRequired($input, ['first_name', 'last_name', 'email', 'password']);

if (!empty($errors)) {
    sendError('Validation failed', 400, $errors);
}

// Sanitize input
$firstName = sanitizeInput($input['first_name']);
$lastName = sanitizeInput($input['last_name']);
$email = sanitizeInput($input['email']);
$password = $input['password'];

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendError('Invalid email format', 400);
}

// Check if user already exists
$stmt = $pdo->prepare("SELECT user_id FROM users WHERE email = ?");
$stmt->execute([$email]);

if ($stmt->fetch()) {
    sendError('User with this email already exists', 409);
}

// Hash password
$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

// Generate username from email
$username = explode('@', $email)[0];

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
    
    sendResponse([
        'user' => [
            'user_id' => $userId,
            'username' => $username,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email
        ],
        'token' => $token
    ], 'User registered successfully', 201);
    
} catch (PDOException $e) {
    sendError('Registration failed', 500);
}
?>
