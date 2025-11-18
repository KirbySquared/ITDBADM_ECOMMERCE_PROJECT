<?php
/**
 * USERS CRUD API ENDPOINT
 * 
 * This endpoint handles all user management operations for admins.
 * 
 * ROUTES:
 * - GET /api/admin/users - List all users with pagination and filters
 * - POST /api/admin/users - Create new user
 * - GET /api/admin/users/{id} - Get specific user details
 * - PUT /api/admin/users/{id} - Update user
 * - DELETE /api/admin/users/{id} - Delete user
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token
 * - Validates admin role
 * - Returns 403 if not admin
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

// Check if user is admin
try {
    $stmt = $pdo->prepare("SELECT role FROM users WHERE user_id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    
    if (!$user || $user['role'] !== 'admin') {
        sendError('Admin access required', 403);
    }
} catch (PDOException $e) {
    sendError('Database error', 500);
}

// Get request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$pathParts = explode('/', trim($path, '/'));

// Extract user ID if present
$userIdParam = null;
if (count($pathParts) >= 4 && is_numeric($pathParts[3])) {
    $userIdParam = intval($pathParts[3]);
}

try {
    switch ($method) {
        case 'GET':
            if ($userIdParam) {
                // Get specific user
                $stmt = $pdo->prepare("
                    SELECT user_id, username, email, first_name, last_name, phone, address, role, branch_id, created_at, updated_at
                    FROM users 
                    WHERE user_id = ?
                ");
                $stmt->execute([$userIdParam]);
                $user = $stmt->fetch();
                
                if (!$user) {
                    sendError('User not found', 404);
                }
                
                sendResponse($user, 'User retrieved successfully');
            } else {
                // List users with pagination and filters
                $page = max(1, intval($_GET['page'] ?? 1));
                $limit = min(100, max(1, intval($_GET['limit'] ?? 10)));
                $offset = ($page - 1) * $limit;
                
                $search = $_GET['search'] ?? '';
                $role = $_GET['role'] ?? 'all';
                $status = $_GET['status'] ?? 'all';
                
                // Build query
                $whereConditions = [];
                $params = [];
                
                if ($search) {
                    $whereConditions[] = "(username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)";
                    $searchTerm = "%$search%";
                    $params = array_merge($params, [$searchTerm, $searchTerm, $searchTerm, $searchTerm]);
                }
                
                if ($role !== 'all') {
                    $whereConditions[] = "role = ?";
                    $params[] = $role;
                }
                
                $whereClause = $whereConditions ? 'WHERE ' . implode(' AND ', $whereConditions) : '';
                
                // Get users
                $sql = "SELECT user_id, username, email, first_name, last_name, phone, role, branch_id, created_at, updated_at
                        FROM users 
                        $whereClause
                        ORDER BY created_at DESC 
                        LIMIT ? OFFSET ?";
                
                $params[] = $limit;
                $params[] = $offset;
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $users = $stmt->fetchAll();
                
                // Get total count
                $countSql = "SELECT COUNT(*) FROM users $whereClause";
                $countStmt = $pdo->prepare($countSql);
                $countStmt->execute(array_slice($params, 0, -2)); // Remove limit and offset
                $total = $countStmt->fetchColumn();
                
                sendResponse([
                    'users' => $users,
                    'pagination' => [
                        'page' => $page,
                        'limit' => $limit,
                        'total' => $total,
                        'pages' => ceil($total / $limit)
                    ]
                ], 'Users retrieved successfully');
            }
            break;
            
        case 'POST':
            // Create new user
            $input = json_decode(file_get_contents('php://input'), true);
            
            $errors = validateRequired($input, ['username', 'email', 'first_name', 'last_name', 'password']);
            if (!empty($errors)) {
                sendError('Validation failed', 400, $errors);
            }
            
            // Validate email format
            if (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
                sendError('Invalid email format', 400);
            }
            
            // Check if username or email already exists
            $stmt = $pdo->prepare("SELECT user_id FROM users WHERE username = ? OR email = ?");
            $stmt->execute([$input['username'], $input['email']]);
            if ($stmt->fetch()) {
                sendError('Username or email already exists', 409);
            }
            
            // Validate staff role requires branch_id
            $userRole = $input['role'] ?? 'user';
            if ($userRole === 'staff') {
                if (!isset($input['branch_id']) || empty($input['branch_id'])) {
                    sendError('Staff users must be assigned to a branch. Branch ID is required.', 400);
                }
                
                // Validate branch exists
                $branchId = (int)$input['branch_id'];
                $branchCheck = $pdo->prepare("SELECT branch_id FROM branches WHERE branch_id = ?");
                $branchCheck->execute([$branchId]);
                if (!$branchCheck->fetch()) {
                    sendError('Invalid branch selected', 400);
                }
            }
            
            // Hash password
            $hashedPassword = password_hash($input['password'], PASSWORD_DEFAULT);
            
            // Insert user - set initial status to 'inactive' (will be set to 'active' on first login)
            $stmt = $pdo->prepare("
                INSERT INTO users (username, email, password_hash, first_name, last_name, phone, address, role, status, branch_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            $stmt->execute([
                $input['username'],
                $input['email'],
                $hashedPassword,
                $input['first_name'],
                $input['last_name'],
                $input['phone'] ?? null,
                $input['address'] ?? null,
                $userRole,
                'inactive', // status - will be set to 'active' on login
                ($userRole === 'staff' && isset($input['branch_id'])) ? (int)$input['branch_id'] : null
            ]);
            
            $newUserId = $pdo->lastInsertId();
            
            // Get created user - include status and branch_id
            $stmt = $pdo->prepare("
                SELECT user_id, username, email, first_name, last_name, phone, address, role, branch_id, status, created_at
                FROM users WHERE user_id = ?
            ");
            $stmt->execute([$newUserId]);
            $newUser = $stmt->fetch();
            
            sendResponse($newUser, 'User created successfully', 201);
            break;
            
        case 'PUT':
            // Update user
            if (!$userIdParam) {
                sendError('User ID required', 400);
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Check if user exists
            $stmt = $pdo->prepare("SELECT user_id FROM users WHERE user_id = ?");
            $stmt->execute([$userIdParam]);
            if (!$stmt->fetch()) {
                sendError('User not found', 404);
            }
            
            // Check if username or email already exists (excluding current user)
            if (isset($input['username']) || isset($input['email'])) {
                $stmt = $pdo->prepare("SELECT user_id FROM users WHERE (username = ? OR email = ?) AND user_id != ?");
                $stmt->execute([
                    $input['username'] ?? '',
                    $input['email'] ?? '',
                    $userIdParam
                ]);
                if ($stmt->fetch()) {
                    sendError('Username or email already exists', 409);
                }
            }
            
            // Validate email format if provided
            if (isset($input['email']) && !filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
                sendError('Invalid email format', 400);
            }
            
            // Get current user's role and branch_id for validation
            $currentUserStmt = $pdo->prepare("SELECT role, branch_id FROM users WHERE user_id = ?");
            $currentUserStmt->execute([$userIdParam]);
            $currentUser = $currentUserStmt->fetch();
            
            // Determine the role after update (use new role if provided, otherwise current role)
            $newRole = isset($input['role']) ? $input['role'] : ($currentUser ? $currentUser['role'] : 'user');
            
            // Validate staff role requires branch_id
            if ($newRole === 'staff') {
                // Determine branch_id after update
                $newBranchId = isset($input['branch_id']) ? $input['branch_id'] : ($currentUser ? $currentUser['branch_id'] : null);
                
                // If updating to staff role or user is already staff, branch_id is required
                if (empty($newBranchId)) {
                    sendError('Staff users must be assigned to a branch. Branch ID is required.', 400);
                }
                
                // Validate branch exists if branch_id is being updated
                if (isset($input['branch_id'])) {
                    $branchId = (int)$input['branch_id'];
                    $branchCheck = $pdo->prepare("SELECT branch_id FROM branches WHERE branch_id = ?");
                    $branchCheck->execute([$branchId]);
                    if (!$branchCheck->fetch()) {
                        sendError('Invalid branch selected', 400);
                    }
                }
            }
            
            // Build update query
            $updateFields = [];
            $params = [];
            
            $allowedFields = ['username', 'email', 'first_name', 'last_name', 'phone', 'address', 'role', 'branch_id'];
            foreach ($allowedFields as $field) {
                if (isset($input[$field])) {
                    $updateFields[] = "$field = ?";
                    // Handle branch_id: convert to int if provided, otherwise null
                    if ($field === 'branch_id') {
                        $params[] = !empty($input[$field]) ? (int)$input[$field] : null;
                    } else {
                        $params[] = $input[$field];
                    }
                }
            }
            
            // Handle password update
            if (isset($input['password']) && !empty($input['password'])) {
                $updateFields[] = "password_hash = ?";
                $params[] = password_hash($input['password'], PASSWORD_DEFAULT);
            }
            
            if (empty($updateFields)) {
                sendError('No fields to update', 400);
            }
            
            $params[] = $userIdParam;
            
            $sql = "UPDATE users SET " . implode(', ', $updateFields) . " WHERE user_id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            
            // Get updated user
            $stmt = $pdo->prepare("
                SELECT user_id, username, email, first_name, last_name, phone, address, role, branch_id, created_at, updated_at
                FROM users WHERE user_id = ?
            ");
            $stmt->execute([$userIdParam]);
            $updatedUser = $stmt->fetch();
            
            sendResponse($updatedUser, 'User updated successfully');
            break;
            
        case 'DELETE':
            // Delete user
            if (!$userIdParam) {
                sendError('User ID required', 400);
            }
            
            // Check if user exists
            $stmt = $pdo->prepare("SELECT user_id, role FROM users WHERE user_id = ?");
            $stmt->execute([$userIdParam]);
            $user = $stmt->fetch();
            
            if (!$user) {
                sendError('User not found', 404);
            }
            
            // Prevent deleting admin users
            if ($user['role'] === 'admin') {
                sendError('Cannot delete admin users', 403);
            }
            
            // Delete user (cascade will handle related records)
            $stmt = $pdo->prepare("DELETE FROM users WHERE user_id = ?");
            $stmt->execute([$userIdParam]);
            
            sendResponse(null, 'User deleted successfully');
            break;
            
        default:
            sendError('Method not allowed', 405);
            break;
    }
} catch (PDOException $e) {
    sendError('Database error: ' . $e->getMessage(), 500);
}
?>
