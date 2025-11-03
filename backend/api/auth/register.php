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

// Sanitize all input
$username = sanitizeInput($input['username'] ?? '');
$firstName = sanitizeInput($input['first_name'] ?? '');
$lastName = sanitizeInput($input['last_name'] ?? '');
$email = sanitizeInput($input['email'] ?? '');
$password = $input['password'] ?? ''; // Don't sanitize password - it's hashed anyway

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
// All new registrations default to 'user' role - admins cannot be created via registration
try {
    // Force role to 'user' - ignore any role value that might be sent in the request
    $userRole = 'user';
    
    // Validate that values are not null/empty
    if (empty($username) || empty($firstName) || empty($lastName) || empty($email) || empty($hashedPassword)) {
        throw new Exception('Required fields cannot be empty');
    }
    
    // Insert user - set initial status to 'inactive' (will be set to 'active' on first login)
    $stmt = $pdo->prepare("
        INSERT INTO users (username, email, password_hash, first_name, last_name, phone, address, role, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    
    $result = $stmt->execute([
        $username,
        $email,
        $hashedPassword,
        $firstName,
        $lastName,
        null, // phone
        null, // address
        'user', // role
        'inactive' // status - will be set to 'active' on login
    ]);
    
    if (!$result) {
        $errorInfo = $stmt->errorInfo();
        error_log('INSERT failed. Error info: ' . print_r($errorInfo, true));
        error_log('SQL State: ' . ($errorInfo[0] ?? 'unknown'));
        error_log('Error Code: ' . ($errorInfo[1] ?? 'unknown'));
        error_log('Error Message: ' . ($errorInfo[2] ?? 'unknown'));
        throw new PDOException('Insert failed: ' . ($errorInfo[2] ?? 'Unknown error'));
    }
    
    $userId = $pdo->lastInsertId();
    
    if (!$userId) {
        throw new Exception('Failed to get inserted user ID');
    }
    
    // Generate token
    $token = generateToken($userId);
    
    // Get created user - include status
    $stmt = $pdo->prepare("
        SELECT user_id, username, email, first_name, last_name, phone, address, role, status, created_at
        FROM users WHERE user_id = ?
    ");
    $stmt->execute([$userId]);
    $newUser = $stmt->fetch();
    
    if (!$newUser) {
        throw new Exception('Failed to retrieve created user');
    }
    
    // Ensure role is 'user' and status is 'inactive' (security checks)
    $newUser['role'] = 'user';
    $newUser['status'] = 'inactive'; // New users start as inactive until first login
    
    sendResponse([
        'user' => $newUser,
        'token' => $token
    ], 'User registered successfully', 201);
    
} catch (PDOException $e) {
    // Log detailed error information
    error_log('Registration PDO Error: ' . $e->getMessage());
    error_log('PDO Error Code: ' . $e->getCode());
    error_log('PDO Error Info: ' . print_r($stmt->errorInfo() ?? [], true));
    
    $errorMessage = 'Registration failed';
    if (getenv('APP_ENV') === 'development' || !getenv('APP_ENV')) {
        $errorMessage = 'Registration failed: ' . $e->getMessage();
        if (isset($stmt) && $stmt->errorInfo()) {
            $errorMessage .= ' | SQL Error: ' . ($stmt->errorInfo()[2] ?? 'Unknown SQL error');
        }
    }
    sendError($errorMessage, 500);
} catch (Exception $e) {
    error_log('Registration Error: ' . $e->getMessage());
    $errorMessage = 'Registration failed';
    if (getenv('APP_ENV') === 'development' || !getenv('APP_ENV')) {
        $errorMessage = 'Registration failed: ' . $e->getMessage();
    }
    sendError($errorMessage, 500);
}
?>
