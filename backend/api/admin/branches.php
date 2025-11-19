<?php
/**
 * BRANCHES CRUD API ENDPOINT
 * 
 * This endpoint handles all branch management operations for admins.
 * 
 * ROUTES:
 * - GET /api/admin/branches - List all branches with pagination and filters
 * - POST /api/admin/branches - Create new branch
 * - GET /api/admin/branches/{id} - Get specific branch details
 * - PUT /api/admin/branches/{id} - Update branch
 * - DELETE /api/admin/branches/{id} - Delete branch
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token
 * - Validates admin role
 * - Returns 403 if not admin
 * 
 * ACID COMPLIANCE ANALYSIS:
 * 
 * POST (Create Branch):
 *   ATOMICITY: GOOD - Uses transaction wrapper
 *   CONSISTENCY: GOOD - Validates branch name, enforces business rules
 *   ISOLATION: GOOD - Uses FOR UPDATE on uniqueness checks
 *   DURABILITY: GOOD - COMMIT ensures persistence
 * 
 * PUT (Update Branch):
 *   ATOMICITY: GOOD - Uses transaction wrapper
 *   CONSISTENCY: GOOD - Validates constraints before update
 *   ISOLATION: GOOD - Uses FOR UPDATE on existence and uniqueness checks
 *   DURABILITY: GOOD - COMMIT ensures persistence
 * 
 * DELETE (Delete Branch):
 *   ATOMICITY: GOOD - Uses transaction, deletes related records atomically
 *   CONSISTENCY: GOOD - Deletes product_inventory first, then branch
 *   ISOLATION: GOOD - Transaction isolates changes until COMMIT
 *   DURABILITY: GOOD - COMMIT ensures permanent deletion
 */
// Ensure clean JSON output
if (ob_get_level()) {
    ob_clean();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/admin_auth.php';

// Require admin authentication
requireAdminAuth();

// Get request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Strip /api/admin from path to match router's processing
$path = str_replace('/api/admin', '', $path);
$pathParts = explode('/', trim($path, '/'));

// Extract branch ID if present
// After stripping /api/admin, path is either 'branches' or 'branches/{id}'
$branchIdParam = null;
if (count($pathParts) >= 2 && is_numeric($pathParts[1])) {
    $branchIdParam = intval($pathParts[1]);
}

try {
    switch ($method) {
        case 'GET':
            if ($branchIdParam) {
                // Get single branch
                $stmt = $pdo->prepare("SELECT branch_id, branch_name, address FROM branches WHERE branch_id = ?");
                $stmt->execute([$branchIdParam]);
                $branch = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$branch) {
                    sendError('Branch not found', 404);
                }
                
                sendResponse($branch, 'Branch retrieved successfully');
            } else {
                // List branches with pagination
                $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
                $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 10;
                $offset = ($page - 1) * $limit;
                $search = isset($_GET['search']) ? trim($_GET['search']) : '';
                
                $whereClause = '';
                $params = [];
                
                if ($search) {
                    $whereClause = "WHERE branch_name LIKE ? OR address LIKE ?";
                    $params = ["%$search%", "%$search%"];
                }
                
                // Get total count
                $countSql = "SELECT COUNT(*) as total FROM branches $whereClause";
                $countStmt = $pdo->prepare($countSql);
                $countStmt->execute($params);
                $total = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
                
                // Get branches
                $sql = "SELECT branch_id, branch_name, address FROM branches $whereClause ORDER BY branch_name LIMIT ? OFFSET ?";
                $allParams = array_merge($params, [$limit, $offset]);
                $stmt = $pdo->prepare($sql);
                $stmt->execute($allParams);
                $branches = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                sendResponse([
                    'branches' => $branches,
                    'pagination' => [
                        'page' => $page,
                        'limit' => $limit,
                        'total' => intval($total),
                        'pages' => ceil($total / $limit)
                    ]
                ], 'Branches retrieved successfully');
            }
            break;
            
        case 'POST':
            // Create new branch with ACID transaction
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input) {
                sendError('Invalid JSON input', 400);
            }
            
            // Validate required fields
            $requiredFields = ['branch_name'];
            $missingFields = [];
            foreach ($requiredFields as $field) {
                if (!isset($input[$field]) || trim($input[$field]) === '') {
                    $missingFields[] = $field;
                }
            }
            
            if (!empty($missingFields)) {
                sendError('Missing required fields: ' . implode(', ', $missingFields), 400);
            }
            
            // ATOMICITY: Start transaction - all operations succeed or all fail
            $pdo->exec("START TRANSACTION");
            
            try {
                // ISOLATION: Row-level locking prevents concurrent branch name conflicts
                // CONSISTENCY: Validate branch name uniqueness with row-level locking
                // Check if branch name already exists WITH ROW-LEVEL LOCKING
                $checkStmt = $pdo->prepare("SELECT branch_id FROM branches WHERE branch_name = ? FOR UPDATE");
                $checkStmt->execute([trim($input['branch_name'])]);
                if ($checkStmt->fetch()) {
                    $pdo->exec("ROLLBACK");
                    sendError('Branch name already exists', 409);
                }
                
                // ATOMICITY: Branch INSERT within transaction
                // Insert branch
                $stmt = $pdo->prepare("INSERT INTO branches (branch_name, address) VALUES (?, ?)");
                $stmt->execute([
                    trim($input['branch_name']),
                    isset($input['address']) ? trim($input['address']) : null
                ]);
                
                $newBranchId = $pdo->lastInsertId();
                
                // DURABILITY: COMMIT ensures all changes are permanently saved
                $pdo->exec("COMMIT");
                
                // Get created branch
                $stmt = $pdo->prepare("SELECT branch_id, branch_name, address FROM branches WHERE branch_id = ?");
                $stmt->execute([$newBranchId]);
                $newBranch = $stmt->fetch(PDO::FETCH_ASSOC);
                
                sendResponse($newBranch, 'Branch created successfully', 201);
            } catch (Exception $e) {
                // ATOMICITY: Rollback ensures no partial state on error
                $pdo->exec("ROLLBACK");
                error_log('Branch creation error: ' . $e->getMessage());
                sendError('Failed to create branch: ' . $e->getMessage(), 500);
            }
            break;
            
        case 'PUT':
            // Update branch with ACID transaction
            if (!$branchIdParam) {
                sendError('Branch ID required', 400);
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input) {
                sendError('Invalid JSON input', 400);
            }
            
            // ATOMICITY: Start transaction - all operations succeed or all fail
            $pdo->exec("START TRANSACTION");
            
            try {
                // ISOLATION: Row-level locking prevents concurrent branch modifications
                // CONSISTENCY: Validate branch exists before UPDATE
                // Check if branch exists WITH ROW-LEVEL LOCKING
                $checkStmt = $pdo->prepare("SELECT branch_id FROM branches WHERE branch_id = ? FOR UPDATE");
                $checkStmt->execute([$branchIdParam]);
                if (!$checkStmt->fetch()) {
                    $pdo->exec("ROLLBACK");
                    sendError('Branch not found', 404);
                }
                
                $updateFields = [];
                $params = [];
                
                // Update branch_name if provided
                if (isset($input['branch_name']) && trim($input['branch_name']) !== '') {
                    // ISOLATION: Row-level locking prevents concurrent branch name conflicts
                    // CONSISTENCY: Validate branch name uniqueness with row-level locking
                    // Check if new name conflicts with existing branch WITH ROW-LEVEL LOCKING
                    $nameCheckStmt = $pdo->prepare("SELECT branch_id FROM branches WHERE branch_name = ? AND branch_id != ? FOR UPDATE");
                    $nameCheckStmt->execute([trim($input['branch_name']), $branchIdParam]);
                    if ($nameCheckStmt->fetch()) {
                        $pdo->exec("ROLLBACK");
                        sendError('Branch name already exists', 409);
                    }
                    $updateFields[] = "branch_name = ?";
                    $params[] = trim($input['branch_name']);
                }
                
                // Update address if provided
                if (isset($input['address'])) {
                    $updateFields[] = "address = ?";
                    $params[] = trim($input['address']) !== '' ? trim($input['address']) : null;
                }
                
                if (empty($updateFields)) {
                    $pdo->exec("ROLLBACK");
                    sendError('No fields to update', 400);
                }
                
                $params[] = $branchIdParam;
                
                // ATOMICITY: Branch UPDATE within transaction
                $sql = "UPDATE branches SET " . implode(', ', $updateFields) . " WHERE branch_id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                
                // DURABILITY: COMMIT ensures all changes are permanently saved
                $pdo->exec("COMMIT");
                
                // Get updated branch
                $stmt = $pdo->prepare("SELECT branch_id, branch_name, address FROM branches WHERE branch_id = ?");
                $stmt->execute([$branchIdParam]);
                $updatedBranch = $stmt->fetch(PDO::FETCH_ASSOC);
                
                sendResponse($updatedBranch, 'Branch updated successfully');
            } catch (Exception $e) {
                // ATOMICITY: Rollback ensures no partial state on error
                $pdo->exec("ROLLBACK");
                error_log('Branch update error: ' . $e->getMessage());
                sendError('Failed to update branch: ' . $e->getMessage(), 500);
            }
            break;
            
        case 'DELETE':
            // Delete branch
            if (!$branchIdParam) {
                sendError('Branch ID required', 400);
            }
            
            // Check if branch exists
            $checkStmt = $pdo->prepare("SELECT branch_id, branch_name FROM branches WHERE branch_id = ?");
            $checkStmt->execute([$branchIdParam]);
            $branch = $checkStmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$branch) {
                sendError('Branch not found', 404);
            }
            
            // ATOMICITY: Start transaction - all deletions succeed or all fail
            // This ensures proper ACID compliance:
            // - ATOMICITY: All deletions succeed or all fail
            // - CONSISTENCY: Foreign key constraints are maintained
            // - ISOLATION: Changes are isolated until COMMIT
            // - DURABILITY: Once COMMIT, changes are permanent
            $pdo->exec("START TRANSACTION");
            
            try {
                // ATOMICITY: Product inventory deletion within transaction
                // CONSISTENCY: Delete child records first (product_inventory) before parent (branches)
                // Delete related records in order (respecting foreign key constraints)
                // 1. Delete from product_inventory (has foreign key to branches)
                // This will remove all inventory entries for this branch
                $stmt = $pdo->prepare("DELETE FROM product_inventory WHERE branch_id = ?");
                $stmt->execute([$branchIdParam]);
                
                // ATOMICITY: Branch deletion within same transaction
                // CONSISTENCY: Delete branch after all child records are deleted
                // 2. Finally, delete the branch itself
                $stmt = $pdo->prepare("DELETE FROM branches WHERE branch_id = ?");
                $stmt->execute([$branchIdParam]);
                
                // DURABILITY: COMMIT ensures all changes are permanently saved
                // Commit transaction - all deletions are now permanent
                $pdo->exec("COMMIT");
                
                sendResponse(null, 'Branch deleted successfully');
            } catch (PDOException $e) {
                // Rollback on error - all changes are discarded
                $pdo->exec("ROLLBACK");
                throw $e; // Re-throw to be caught by outer catch block
            }
            break;
            
        default:
            sendError('Method not allowed', 405);
            break;
    }
} catch (PDOException $e) {
    error_log('Branches API PDO Error: ' . $e->getMessage());
    sendError('Database error: ' . $e->getMessage(), 500);
} catch (Throwable $e) {
    error_log('Branches API Error: ' . $e->getMessage());
    sendError('An error occurred: ' . $e->getMessage(), 500);
}
