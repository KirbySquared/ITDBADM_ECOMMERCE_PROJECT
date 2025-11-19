<?php
/**
 * GENRES CRUD API ENDPOINT
 * 
 * This endpoint handles all genre management operations for admins.
 * 
 * ROUTES:
 * - GET /api/admin/genres - List all genres with pagination and filters
 * - POST /api/admin/genres - Create new genre
 * - GET /api/admin/genres/{id} - Get specific genre details
 * - PUT /api/admin/genres/{id} - Update genre
 * - DELETE /api/admin/genres/{id} - Delete genre
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token
 * - Validates admin role
 * - Returns 403 if not admin
 * 
 * ACID COMPLIANCE ANALYSIS:
 * 
 * POST (Create Genre):
 *   ATOMICITY: GOOD - Uses transaction wrapper
 *   CONSISTENCY: GOOD - Validates genre name, enforces business rules
 *   ISOLATION: GOOD - Uses FOR UPDATE on uniqueness checks
 *   DURABILITY: GOOD - COMMIT ensures persistence
 * 
 * PUT (Update Genre):
 *   ATOMICITY: GOOD - Uses transaction wrapper
 *   CONSISTENCY: GOOD - Validates constraints before update
 *   ISOLATION: GOOD - Uses FOR UPDATE on existence and uniqueness checks
 *   DURABILITY: GOOD - COMMIT ensures persistence
 * 
 * DELETE (Delete Genre):
 *   ATOMICITY: GOOD - Uses transaction with validation checks
 *   CONSISTENCY: GOOD - Validates no products exist before deletion
 *   ISOLATION: GOOD - Transaction isolates changes until COMMIT
 *   DURABILITY: GOOD - COMMIT ensures permanent deletion
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

// Get authorization header (case-insensitive)
$headers = function_exists('getallheaders') ? getallheaders() : [];
$token = null;

foreach ($headers as $k => $v) {
    if (strtolower($k) === 'authorization') {
        $token = preg_replace('/^Bearer\s+/i', '', $v);
        break;
    }
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

// Extract genre ID if present
$genreIdParam = null;
if (count($pathParts) >= 4 && is_numeric($pathParts[3])) {
    $genreIdParam = intval($pathParts[3]);
}

try {
    // Start transaction for ACID compliance
    $pdo->beginTransaction();
    
    switch ($method) {
        case 'GET':
            if ($genreIdParam) {
                // Get specific genre with product count
                $stmt = $pdo->prepare("
                    SELECT g.*, 
                           COUNT(p.product_id) as product_count
                    FROM genres g
                    LEFT JOIN products p ON g.genre_id = p.genre_id
                    WHERE g.genre_id = ?
                    GROUP BY g.genre_id
                ");
                $stmt->execute([$genreIdParam]);
                $genre = $stmt->fetch();
                
                if (!$genre) {
                    $pdo->rollBack();
                    sendError('Genre not found', 404);
                }
                
                $pdo->commit();
                sendResponse($genre, 'Genre retrieved successfully');
            } else {
                // List genres with pagination and filters
                $page = max(1, intval($_GET['page'] ?? 1));
                $limit = min(100, max(1, intval($_GET['limit'] ?? 10)));
                $offset = ($page - 1) * $limit;
                
                $search = $_GET['search'] ?? '';
                
                // Build query
                $whereConditions = [];
                $params = [];
                
                if ($search) {
                    $whereConditions[] = "(genre_name LIKE ? OR description LIKE ?)";
                    $searchTerm = "%$search%";
                    $params = array_merge($params, [$searchTerm, $searchTerm]);
                }
                
                $whereClause = $whereConditions ? 'WHERE ' . implode(' AND ', $whereConditions) : '';
                
                // Get genres with product count
                $sql = "SELECT g.*, 
                               COUNT(p.product_id) as product_count
                        FROM genres g
                        LEFT JOIN products p ON g.genre_id = p.genre_id
                        $whereClause
                        GROUP BY g.genre_id
                        ORDER BY g.genre_name ASC 
                        LIMIT ? OFFSET ?";
                
                $params[] = $limit;
                $params[] = $offset;
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $genres = $stmt->fetchAll();
                
                // Get total count
                $countSql = "SELECT COUNT(*) FROM genres $whereClause";
                $countStmt = $pdo->prepare($countSql);
                $countStmt->execute(array_slice($params, 0, -2)); // Remove limit and offset
                $total = $countStmt->fetchColumn();
                
                $pdo->commit();
                sendResponse([
                    'genres' => $genres,
                    'pagination' => [
                        'page' => $page,
                        'limit' => $limit,
                        'total' => $total,
                        'pages' => ceil($total / $limit)
                    ]
                ], 'Genres retrieved successfully');
            }
            break;
            
        case 'POST':
            // Create new genre
            $input = json_decode(file_get_contents('php://input'), true);
            
            $errors = validateRequired($input, ['genre_name']);
            if (!empty($errors)) {
                $pdo->rollBack();
                sendError('Validation failed', 400, $errors);
            }
            
            // ISOLATION: Row-level locking prevents concurrent genre name conflicts
            // CONSISTENCY: Validate genre name uniqueness with row-level locking
            // Check if genre name already exists WITH ROW-LEVEL LOCKING
            $stmt = $pdo->prepare("SELECT genre_id FROM genres WHERE genre_name = ? FOR UPDATE");
            $stmt->execute([$input['genre_name']]);
            if ($stmt->fetch()) {
                $pdo->rollBack();
                sendError('Genre name already exists', 409);
            }
            
            // Insert genre
            $stmt = $pdo->prepare("
                INSERT INTO genres (genre_name, description) 
                VALUES (?, ?)
            ");
            
            $stmt->execute([
                $input['genre_name'],
                $input['description'] ?? null
            ]);
            
            $newGenreId = $pdo->lastInsertId();
            
            // Get created genre
            $stmt = $pdo->prepare("
                SELECT g.*, 
                       COUNT(p.product_id) as product_count
                FROM genres g
                LEFT JOIN products p ON g.genre_id = p.genre_id
                WHERE g.genre_id = ?
                GROUP BY g.genre_id
            ");
            $stmt->execute([$newGenreId]);
            $newGenre = $stmt->fetch();
            
            $pdo->commit();
            sendResponse($newGenre, 'Genre created successfully', 201);
            break;
            
        case 'PUT':
            // Update genre
            if (!$genreIdParam) {
                $pdo->rollBack();
                sendError('Genre ID required', 400);
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            // ISOLATION: Row-level locking prevents concurrent genre modifications
            // CONSISTENCY: Validate genre exists before UPDATE
            // Check if genre exists WITH ROW-LEVEL LOCKING
            $stmt = $pdo->prepare("SELECT genre_id FROM genres WHERE genre_id = ? FOR UPDATE");
            $stmt->execute([$genreIdParam]);
            if (!$stmt->fetch()) {
                $pdo->rollBack();
                sendError('Genre not found', 404);
            }
            
            // ISOLATION: Row-level locking prevents concurrent genre name conflicts
            // CONSISTENCY: Validate genre name uniqueness with row-level locking
            // Check if genre name already exists (excluding current genre) WITH ROW-LEVEL LOCKING
            if (isset($input['genre_name'])) {
                $stmt = $pdo->prepare("SELECT genre_id FROM genres WHERE genre_name = ? AND genre_id != ? FOR UPDATE");
                $stmt->execute([$input['genre_name'], $genreIdParam]);
                if ($stmt->fetch()) {
                    $pdo->rollBack();
                    sendError('Genre name already exists', 409);
                }
            }
            
            // Build update query
            $updateFields = [];
            $params = [];
            
            $allowedFields = ['genre_name', 'description'];
            foreach ($allowedFields as $field) {
                if (isset($input[$field])) {
                    $updateFields[] = "$field = ?";
                    $params[] = $input[$field];
                }
            }
            
            if (empty($updateFields)) {
                $pdo->rollBack();
                sendError('No fields to update', 400);
            }
            
            $params[] = $genreIdParam;
            
            $sql = "UPDATE genres SET " . implode(', ', $updateFields) . " WHERE genre_id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            
            // Get updated genre with product count
            $stmt = $pdo->prepare("
                SELECT g.*, 
                       COUNT(p.product_id) as product_count
                FROM genres g
                LEFT JOIN products p ON g.genre_id = p.genre_id
                WHERE g.genre_id = ?
                GROUP BY g.genre_id
            ");
            $stmt->execute([$genreIdParam]);
            $updatedGenre = $stmt->fetch();
            
            $pdo->commit();
            sendResponse($updatedGenre, 'Genre updated successfully');
            break;
            
        case 'DELETE':
            // ATOMICITY: Genre validation and deletion happen atomically (within transaction)
            // CONSISTENCY: Validates no products exist before deletion
            // ISOLATION: Transaction isolates changes until COMMIT
            // DURABILITY: COMMIT ensures permanent deletion
            // Delete genre
            if (!$genreIdParam) {
                $pdo->rollBack();
                sendError('Genre ID required', 400);
            }
            
            // CONSISTENCY: Validate genre exists
            // Check if genre exists
            $stmt = $pdo->prepare("SELECT genre_id FROM genres WHERE genre_id = ?");
            $stmt->execute([$genreIdParam]);
            if (!$stmt->fetch()) {
                $pdo->rollBack();
                sendError('Genre not found', 404);
            }
            
            // CONSISTENCY: Validate no products reference this genre (maintains referential integrity)
            // Check if genre has products
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM products WHERE genre_id = ?");
            $stmt->execute([$genreIdParam]);
            $productCount = $stmt->fetchColumn();
            
            if ($productCount > 0) {
                $pdo->rollBack();
                sendError('Cannot delete genre with existing products. Please update or delete products first.', 409);
            }
            
            // ATOMICITY: Genre deletion within transaction
            // Delete genre
            $stmt = $pdo->prepare("DELETE FROM genres WHERE genre_id = ?");
            $stmt->execute([$genreIdParam]);
            
            // DURABILITY: COMMIT ensures all changes are permanently saved
            $pdo->commit();
            sendResponse(null, 'Genre deleted successfully');
            break;
            
        default:
            $pdo->rollBack();
            sendError('Method not allowed', 405);
            break;
    }
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    sendError('Database error: ' . $e->getMessage(), 500);
}
?>

