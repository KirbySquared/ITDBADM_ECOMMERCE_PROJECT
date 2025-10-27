<?php
/**
 * USER PROFILE UPDATE ENDPOINT
 * 
 * This endpoint allows authenticated users to update their own profile.
 * 
 * ROUTE: /api/auth/profile
 * METHOD: PUT
 * HEADERS: { "Authorization": "Bearer <jwt_token>" }
 * 
 * REQUEST BODY:
 * {
 *   "username": "john_doe",
 *   "email": "john@example.com",
 *   "first_name": "John",
 *   "last_name": "Doe",
 *   "phone": "123-456-7890",
 *   "address": "123 Main St",
 *   "password": "newpassword123" // optional
 * }
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token
 * - Users can only update their own profile
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

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

// Get request data
$input = json_decode(file_get_contents('php://input'), true);

// Get current user data
$stmt = $pdo->prepare("
    SELECT user_id, username, email, first_name, last_name, phone, address, role
    FROM users 
    WHERE user_id = ?
");
$stmt->execute([$userId]);
$currentUser = $stmt->fetch();

if (!$currentUser) {
    sendError('User not found', 404);
}

// Validate required fields
$errors = validateRequired($input, ['username', 'email', 'first_name', 'last_name']);
if (!empty($errors)) {
    sendError('Validation failed', 400, $errors);
}

// Check if username or email already exists (excluding current user)
$stmt = $pdo->prepare("SELECT user_id FROM users WHERE (username = ? OR email = ?) AND user_id != ?");
$stmt->execute([
    $input['username'],
    $input['email'],
    $userId
]);
if ($stmt->fetch()) {
    sendError('Username or email already exists', 409);
}

// Validate email format
if (isset($input['email']) && !filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
    sendError('Invalid email format', 400);
}

// Build update query
$updateFields = [];
$params = [];

$allowedFields = ['username', 'email', 'first_name', 'last_name', 'phone', 'address'];
foreach ($allowedFields as $field) {
    if (isset($input[$field])) {
        $updateFields[] = "$field = ?";
        $params[] = $input[$field];
    }
}

// Handle password update if provided
if (isset($input['password']) && !empty($input['password'])) {
    $updateFields[] = "password_hash = ?";
    $params[] = password_hash($input['password'], PASSWORD_DEFAULT);
}

if (empty($updateFields)) {
    sendError('No fields to update', 400);
}

$params[] = $userId;

$sql = "UPDATE users SET " . implode(', ', $updateFields) . " WHERE user_id = ?";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);

// Get updated user
$stmt = $pdo->prepare("
    SELECT user_id, username, email, first_name, last_name, phone, address, role
    FROM users 
    WHERE user_id = ?
");
$stmt->execute([$userId]);
$updatedUser = $stmt->fetch();

sendResponse(['user' => $updatedUser], 'Profile updated successfully');
?>

