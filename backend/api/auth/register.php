<?php
/**
 * USER REGISTRATION ENDPOINT
 * 
 * ACID COMPLIANCE ANALYSIS:
 * 
 * ATOMICITY: GOOD - Uses transaction wrapper
 *   - User creation and token generation are atomic
 *   - If any operation fails, entire transaction is rolled back
 *   - No partial user creation possible
 * 
 * CONSISTENCY: GOOD
 *   - Validates username/email uniqueness before INSERT (with row-level locking)
 *   - Validates branch_id exists before INSERT
 *   - Enforces role='user' and status='inactive' constraints
 *   - Database constraints (UNIQUE on username/email) prevent duplicates
 * 
 * ISOLATION: GOOD - Uses row-level locking
 *   - FOR UPDATE on uniqueness checks prevents race conditions
 *   - Prevents concurrent registration with same username/email
 *   - Transaction isolation level: READ COMMITTED (set in database.php)
 * 
 * DURABILITY: GOOD
 *   - COMMIT ensures all changes are permanently saved
 *   - ROLLBACK on error ensures no partial state
 *   - Database ensures durability after successful COMMIT
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/security_headers.php';
require_once __DIR__ . '/../../utils/rate_limiter.php';
require_once __DIR__ . '/../../utils/security_audit.php';
require_once __DIR__ . '/../../utils/input_validator.php';

// Set security headers
setSecurityHeaders();

// Rate limiting for registration (3 attempts per hour)
$clientId = getClientIdentifier();
$rateLimit = checkRateLimit($pdo, $clientId, 'register', 3, 3600);
if (!$rateLimit['allowed']) {
    logSecurityEvent($pdo, 'rate_limit_exceeded', 'medium', 
        "Registration rate limit exceeded", null);
    sendError('Too many registration attempts. Please try again later.', 429);
}

// Get request data
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$errors = validateRequired($input, ['username', 'first_name', 'last_name', 'email', 'password']);

if (!empty($errors)) {
    sendError('Validation failed', 400, $errors);
}

// Validate and sanitize all input
$username = validateString($input['username'] ?? '', 3, 20, '/^[a-zA-Z0-9_]+$/');
if ($username === false) {
    sendError('Username must be 3-20 characters and contain only letters, numbers, and underscores', 400);
}

$firstName = validateString($input['first_name'] ?? '', 1, 100);
if ($firstName === false) {
    sendError('First name must be 1-100 characters', 400);
}

$lastName = validateString($input['last_name'] ?? '', 1, 100);
if ($lastName === false) {
    sendError('Last name must be 1-100 characters', 400);
}

$email = validateEmail($input['email'] ?? '');
if ($email === false) {
    sendError('Invalid email format', 400);
}

$password = $input['password'] ?? '';
// Validate password strength
if (strlen($password) < 8) {
    sendError('Password must be at least 8 characters long', 400);
}
if (strlen($password) > 128) {
    sendError('Password must be less than 128 characters', 400);
}

// Validate branch_id if provided
$branchId = null;
if (isset($input['branch_id']) && !empty($input['branch_id'])) {
    $branchId = validateInteger($input['branch_id'], 1);
    if ($branchId === false) {
        sendError('Invalid branch ID', 400);
    }
}

// ATOMICITY: Start transaction - all operations succeed or all fail
$pdo->exec("START TRANSACTION");

try {
    // ISOLATION: Row-level locking prevents concurrent registration with same username/email
    // CONSISTENCY: Validate username uniqueness with row-level locking
    // Check if username already exists WITH ROW-LEVEL LOCKING
    $stmt = $pdo->prepare("SELECT user_id FROM users WHERE username = ? FOR UPDATE");
    $stmt->execute([$username]);
    
    if ($stmt->fetch()) {
        $pdo->exec("ROLLBACK");
        sendError('Username already exists. Please choose a different username.', 409);
    }
    
    // ISOLATION: Row-level locking prevents concurrent registration with same email
    // CONSISTENCY: Validate email uniqueness with row-level locking
    // Check if email already exists WITH ROW-LEVEL LOCKING
    $stmt = $pdo->prepare("SELECT user_id FROM users WHERE email = ? FOR UPDATE");
    $stmt->execute([$email]);
    
    if ($stmt->fetch()) {
        $pdo->exec("ROLLBACK");
        sendError('User with this email already exists', 409);
    }
    
    // Hash password with bcrypt - automatically generates unique salt for each password
    // Using PASSWORD_BCRYPT with cost 12 ensures each password gets a unique hash even if passwords are identical
    $hashedPassword = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    
    // ATOMICITY: User creation within transaction
    // All new registrations default to 'user' role - admins cannot be created via registration
    // Force role to 'user' - ignore any role value that might be sent in the request
    $userRole = 'user';
    
    // Validate that values are not null/empty
    if (empty($username) || empty($firstName) || empty($lastName) || empty($email) || empty($hashedPassword)) {
        throw new Exception('Required fields cannot be empty');
    }
    
    // CONSISTENCY: Validate branch_id exists before INSERT
    // Verify branch exists (branchId already validated above)
    if ($branchId !== null) {
        $branchCheck = $pdo->prepare("SELECT branch_id FROM branches WHERE branch_id = ?");
        $branchCheck->execute([$branchId]);
        if (!$branchCheck->fetch()) {
            $pdo->exec("ROLLBACK");
            sendError('Invalid branch selected', 400);
        }
    }
    
    // ATOMICITY: User INSERT within transaction
    // Insert user - set initial status to 'inactive' (will be set to 'active' on first login)
    $stmt = $pdo->prepare("
        INSERT INTO users (username, email, password_hash, first_name, last_name, phone, address, role, status, branch_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        'inactive', // status - will be set to 'active' on login
        $branchId // branch_id
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
    
    // ATOMICITY: Token generation within same transaction
    // Generate token
    $token = generateToken($userId);
    
    // Get created user - include status and branch info
    $stmt = $pdo->prepare("
        SELECT u.user_id, u.username, u.email, u.first_name, u.last_name, u.phone, u.address, u.role, u.status, u.branch_id, u.created_at,
               b.branch_name
        FROM users u
        LEFT JOIN branches b ON u.branch_id = b.branch_id
        WHERE u.user_id = ?
    ");
    $stmt->execute([$userId]);
    $newUser = $stmt->fetch();
    
    if (!$newUser) {
        throw new Exception('Failed to retrieve created user');
    }
    
    // Ensure role is 'user' and status is 'inactive' (security checks)
    $newUser['role'] = 'user';
    $newUser['status'] = 'inactive'; // New users start as inactive until first login
    
    // DURABILITY: COMMIT ensures all changes are permanently saved
    $pdo->exec("COMMIT");
    
    // Log successful registration
    logSecurityEvent($pdo, 'user_registered', 'low', 
        "New user registered", $userId, [
            'email' => $email,
            'username' => $username
        ]);
    
    sendResponse([
        'user' => $newUser,
        'token' => $token
    ], 'User registered successfully', 201);
    
} catch (PDOException $e) {
    // ATOMICITY: Rollback ensures no partial state on error
    if ($pdo->inTransaction()) {
        $pdo->exec("ROLLBACK");
    }
    
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
    // ATOMICITY: Rollback ensures no partial state on error
    if ($pdo->inTransaction()) {
        $pdo->exec("ROLLBACK");
    }
    
    error_log('Registration Error: ' . $e->getMessage());
    $errorMessage = 'Registration failed';
    if (getenv('APP_ENV') === 'development' || !getenv('APP_ENV')) {
        $errorMessage = 'Registration failed: ' . $e->getMessage();
    }
    sendError($errorMessage, 500);
}
?>
