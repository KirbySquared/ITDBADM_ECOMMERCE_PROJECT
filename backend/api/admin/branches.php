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
            // Create new branch
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
            
            // Check if branch name already exists
            $checkStmt = $pdo->prepare("SELECT branch_id FROM branches WHERE branch_name = ?");
            $checkStmt->execute([trim($input['branch_name'])]);
            if ($checkStmt->fetch()) {
                sendError('Branch name already exists', 409);
            }
            
            // Insert branch
            $stmt = $pdo->prepare("INSERT INTO branches (branch_name, address) VALUES (?, ?)");
            $stmt->execute([
                trim($input['branch_name']),
                isset($input['address']) ? trim($input['address']) : null
            ]);
            
            $newBranchId = $pdo->lastInsertId();
            
            // Get created branch
            $stmt = $pdo->prepare("SELECT branch_id, branch_name, address FROM branches WHERE branch_id = ?");
            $stmt->execute([$newBranchId]);
            $newBranch = $stmt->fetch(PDO::FETCH_ASSOC);
            
            sendResponse($newBranch, 'Branch created successfully', 201);
            break;
            
        case 'PUT':
            // Update branch
            if (!$branchIdParam) {
                sendError('Branch ID required', 400);
            }
            
            // Check if branch exists
            $checkStmt = $pdo->prepare("SELECT branch_id FROM branches WHERE branch_id = ?");
            $checkStmt->execute([$branchIdParam]);
            if (!$checkStmt->fetch()) {
                sendError('Branch not found', 404);
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input) {
                sendError('Invalid JSON input', 400);
            }
            
            $updateFields = [];
            $params = [];
            
            // Update branch_name if provided
            if (isset($input['branch_name']) && trim($input['branch_name']) !== '') {
                // Check if new name conflicts with existing branch
                $nameCheckStmt = $pdo->prepare("SELECT branch_id FROM branches WHERE branch_name = ? AND branch_id != ?");
                $nameCheckStmt->execute([trim($input['branch_name']), $branchIdParam]);
                if ($nameCheckStmt->fetch()) {
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
                sendError('No fields to update', 400);
            }
            
            $params[] = $branchIdParam;
            
            $sql = "UPDATE branches SET " . implode(', ', $updateFields) . " WHERE branch_id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            
            // Get updated branch
            $stmt = $pdo->prepare("SELECT branch_id, branch_name, address FROM branches WHERE branch_id = ?");
            $stmt->execute([$branchIdParam]);
            $updatedBranch = $stmt->fetch(PDO::FETCH_ASSOC);
            
            sendResponse($updatedBranch, 'Branch updated successfully');
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
            
            // Check if branch has inventory
            $inventoryCheck = $pdo->prepare("SELECT COUNT(*) as count FROM product_inventory WHERE branch_id = ?");
            $inventoryCheck->execute([$branchIdParam]);
            $inventoryCount = $inventoryCheck->fetch(PDO::FETCH_ASSOC)['count'];
            
            if ($inventoryCount > 0) {
                sendError("Cannot delete branch. It has $inventoryCount inventory entries. Please remove or transfer inventory first.", 409);
            }
            
            // Delete branch
            $stmt = $pdo->prepare("DELETE FROM branches WHERE branch_id = ?");
            $stmt->execute([$branchIdParam]);
            
            sendResponse(null, 'Branch deleted successfully');
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
