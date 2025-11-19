<?php
/**
 * PRODUCT IMAGES CRUD API ENDPOINT
 * 
 * This endpoint handles all product image management operations for admins.
 * 
 * ROUTES:
 * - GET /api/admin/products/{id}/images - Get all images for a product
 * - POST /api/admin/products/{id}/images - Add new image to product
 * - PUT /api/admin/products/{id}/images/{image_id} - Update image details
 * - DELETE /api/admin/products/{id}/images/{image_id} - Delete image
 * - PUT /api/admin/products/{id}/images/{image_id}/primary - Set image as primary
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token
 * - Validates admin role
 * - Returns 403 if not admin
 * 
 * ACID COMPLIANCE ANALYSIS:
 * 
 * POST (Add Image):
 *   ATOMICITY: GOOD - Uses transaction wrapper
 *   CONSISTENCY: GOOD - Validates product exists, enforces business rules
 *   ISOLATION: GOOD - Uses FOR UPDATE on product existence and primary image updates
 *   DURABILITY: GOOD - COMMIT ensures persistence
 * 
 * PUT (Update Image / Set Primary):
 *   ATOMICITY: GOOD - Uses transaction wrapper
 *   CONSISTENCY: GOOD - Ensures only one primary image per product
 *   ISOLATION: GOOD - Uses FOR UPDATE to prevent race conditions
 *   DURABILITY: GOOD - COMMIT ensures persistence
 * 
 * DELETE (Delete Image):
 *   ATOMICITY: GOOD - Uses transaction with primary image reassignment
 *   CONSISTENCY: GOOD - Automatically reassigns primary if deleted image was primary
 *   ISOLATION: GOOD - FOR UPDATE prevents concurrent modifications
 *   DURABILITY: GOOD - COMMIT ensures permanent deletion
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

// Extract product ID and image ID from path
$productIdParam = null;
$imageIdParam = null;

// Expected path format: /api/admin/products/{product_id}/images[/{image_id}]
if (count($pathParts) >= 5 && is_numeric($pathParts[3])) {
    $productIdParam = intval($pathParts[3]);
}
if (count($pathParts) >= 6 && is_numeric($pathParts[5])) {
    $imageIdParam = intval($pathParts[5]);
}

// Check if this is a "set primary" request
$isSetPrimaryRequest = false;
if (count($pathParts) >= 7 && $pathParts[6] === 'primary') {
    $isSetPrimaryRequest = true;
}

try {
    switch ($method) {
        case 'GET':
            // Get all images for a product
            if (!$productIdParam) {
                sendError('Product ID required', 400);
            }
            
            // Check if product exists
            $stmt = $pdo->prepare("SELECT product_id FROM products WHERE product_id = ?");
            $stmt->execute([$productIdParam]);
            if (!$stmt->fetch()) {
                sendError('Product not found', 404);
            }
            
            // Get all images for the product
            $stmt = $pdo->prepare("
                SELECT image_id, image_url, alt_text, is_primary, sort_order, created_at
                FROM product_images 
                WHERE product_id = ? 
                ORDER BY is_primary DESC, sort_order ASC, created_at ASC
            ");
            $stmt->execute([$productIdParam]);
            $images = $stmt->fetchAll();
            
            sendResponse($images, 'Product images retrieved successfully');
            break;
            
        case 'POST':
            // Add new image to product with ACID transaction
            if (!$productIdParam) {
                sendError('Product ID required', 400);
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            $errors = validateRequired($input, ['image_url']);
            if (!empty($errors)) {
                sendError('Validation failed', 400, $errors);
            }
            
            // Validate URL format
            if (!filter_var($input['image_url'], FILTER_VALIDATE_URL)) {
                sendError('Invalid image URL format', 400);
            }
            
            // ATOMICITY: Start transaction - all operations succeed or all fail
            $pdo->exec("START TRANSACTION");
            
            try {
                // ISOLATION: Row-level locking prevents concurrent product modifications
                // CONSISTENCY: Validate product exists before INSERT
                // Check if product exists WITH ROW-LEVEL LOCKING
                $stmt = $pdo->prepare("SELECT product_id FROM products WHERE product_id = ? FOR UPDATE");
                $stmt->execute([$productIdParam]);
                if (!$stmt->fetch()) {
                    $pdo->exec("ROLLBACK");
                    sendError('Product not found', 404);
                }
                
                // ATOMICITY: Primary image update within transaction
                // ISOLATION: Row-level locking prevents concurrent primary image modifications
                // If this is being set as primary, unset other primary images WITH ROW-LEVEL LOCKING
                if (isset($input['is_primary']) && $input['is_primary']) {
                    $stmt = $pdo->prepare("SELECT image_id FROM product_images WHERE product_id = ? AND is_primary = TRUE FOR UPDATE");
                    $stmt->execute([$productIdParam]);
                    $primaryImages = $stmt->fetchAll();
                    
                    if (!empty($primaryImages)) {
                        $stmt = $pdo->prepare("UPDATE product_images SET is_primary = FALSE WHERE product_id = ?");
                        $stmt->execute([$productIdParam]);
                    }
                }
                
                // ATOMICITY: Image INSERT within transaction
                // Insert new image
                $stmt = $pdo->prepare("
                    INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) 
                    VALUES (?, ?, ?, ?, ?)
                ");
                
                $stmt->execute([
                    $productIdParam,
                    $input['image_url'],
                    $input['alt_text'] ?? null,
                    isset($input['is_primary']) && $input['is_primary'] ? 1 : 0,
                    isset($input['sort_order']) ? (int)$input['sort_order'] : 0
                ]);
                
                $newImageId = $pdo->lastInsertId();
                
                // DURABILITY: COMMIT ensures all changes are permanently saved
                $pdo->exec("COMMIT");
                
                // Get created image
                $stmt = $pdo->prepare("
                    SELECT image_id, image_url, alt_text, is_primary, sort_order, created_at
                    FROM product_images WHERE image_id = ?
                ");
                $stmt->execute([$newImageId]);
                $newImage = $stmt->fetch();
                
                sendResponse($newImage, 'Image added successfully', 201);
            } catch (Exception $e) {
                // ATOMICITY: Rollback ensures no partial state on error
                $pdo->exec("ROLLBACK");
                error_log('Image creation error: ' . $e->getMessage());
                sendError('Failed to add image: ' . $e->getMessage(), 500);
            }
            break;
            
        case 'PUT':
            if (!$productIdParam || !$imageIdParam) {
                sendError('Product ID and Image ID required', 400);
            }
            
            // ATOMICITY: Start transaction - all operations succeed or all fail
            $pdo->exec("START TRANSACTION");
            
            try {
                if ($isSetPrimaryRequest) {
                    // Set image as primary with ACID transaction
                    // ISOLATION: Row-level locking prevents concurrent primary image modifications
                    // First, check if image exists and get all primary images WITH ROW-LEVEL LOCKING
                    $stmt = $pdo->prepare("SELECT image_id FROM product_images WHERE image_id = ? AND product_id = ? FOR UPDATE");
                    $stmt->execute([$imageIdParam, $productIdParam]);
                    if (!$stmt->fetch()) {
                        $pdo->exec("ROLLBACK");
                        sendError('Image not found', 404);
                    }
                    
                    // ATOMICITY: Primary image updates within transaction
                    // Unset all primary images for this product WITH ROW-LEVEL LOCKING
                    $stmt = $pdo->prepare("SELECT image_id FROM product_images WHERE product_id = ? AND is_primary = TRUE FOR UPDATE");
                    $stmt->execute([$productIdParam]);
                    $primaryImages = $stmt->fetchAll();
                    
                    if (!empty($primaryImages)) {
                        $stmt = $pdo->prepare("UPDATE product_images SET is_primary = FALSE WHERE product_id = ?");
                        $stmt->execute([$productIdParam]);
                    }
                    
                    // Set the specified image as primary
                    $stmt = $pdo->prepare("UPDATE product_images SET is_primary = TRUE WHERE image_id = ? AND product_id = ?");
                    $stmt->execute([$imageIdParam, $productIdParam]);
                    
                    // DURABILITY: COMMIT ensures all changes are permanently saved
                    $pdo->exec("COMMIT");
                    sendResponse(null, 'Primary image updated successfully');
                } else {
                    // Update image details with ACID transaction
                    $input = json_decode(file_get_contents('php://input'), true);
                    
                    // ISOLATION: Row-level locking prevents concurrent image modifications
                    // CONSISTENCY: Validate image exists before UPDATE
                    // Check if image exists WITH ROW-LEVEL LOCKING
                    $stmt = $pdo->prepare("SELECT image_id FROM product_images WHERE image_id = ? AND product_id = ? FOR UPDATE");
                    $stmt->execute([$imageIdParam, $productIdParam]);
                    if (!$stmt->fetch()) {
                        $pdo->exec("ROLLBACK");
                        sendError('Image not found', 404);
                    }
                    
                    // CONSISTENCY: Validate URL format
                    // Validate URL format if provided
                    if (isset($input['image_url']) && !filter_var($input['image_url'], FILTER_VALIDATE_URL)) {
                        $pdo->exec("ROLLBACK");
                        sendError('Invalid image URL format', 400);
                    }
                    
                    // ATOMICITY: Primary image update within transaction
                    // ISOLATION: Row-level locking prevents concurrent primary image modifications
                    // If this is being set as primary, unset other primary images WITH ROW-LEVEL LOCKING
                    if (isset($input['is_primary']) && $input['is_primary']) {
                        $stmt = $pdo->prepare("SELECT image_id FROM product_images WHERE product_id = ? AND is_primary = TRUE AND image_id != ? FOR UPDATE");
                        $stmt->execute([$productIdParam, $imageIdParam]);
                        $primaryImages = $stmt->fetchAll();
                        
                        if (!empty($primaryImages)) {
                            $stmt = $pdo->prepare("UPDATE product_images SET is_primary = FALSE WHERE product_id = ? AND image_id != ?");
                            $stmt->execute([$productIdParam, $imageIdParam]);
                        }
                    }
                    
                    // ATOMICITY: Image UPDATE within transaction
                    // Build update query
                    $updateFields = [];
                    $params = [];
                    
                    $allowedFields = ['image_url', 'alt_text', 'is_primary', 'sort_order'];
                    foreach ($allowedFields as $field) {
                        if (isset($input[$field])) {
                            $updateFields[] = "$field = ?";
                            // Properly cast values for database
                            if ($field === 'is_primary') {
                                $params[] = $input[$field] ? 1 : 0;
                            } elseif ($field === 'sort_order') {
                                $params[] = (int)$input[$field];
                            } else {
                                $params[] = $input[$field];
                            }
                        }
                    }
                    
                    if (empty($updateFields)) {
                        $pdo->exec("ROLLBACK");
                        sendError('No fields to update', 400);
                    }
                    
                    $params[] = $imageIdParam;
                    
                    $sql = "UPDATE product_images SET " . implode(', ', $updateFields) . " WHERE image_id = ?";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    
                    // DURABILITY: COMMIT ensures all changes are permanently saved
                    $pdo->exec("COMMIT");
                    
                    // Get updated image
                    $stmt = $pdo->prepare("
                        SELECT image_id, image_url, alt_text, is_primary, sort_order, created_at
                        FROM product_images WHERE image_id = ?
                    ");
                    $stmt->execute([$imageIdParam]);
                    $updatedImage = $stmt->fetch();
                    
                    sendResponse($updatedImage, 'Image updated successfully');
                }
            } catch (Exception $e) {
                // ATOMICITY: Rollback ensures no partial state on error
                $pdo->exec("ROLLBACK");
                error_log('Image update error: ' . $e->getMessage());
                sendError('Failed to update image: ' . $e->getMessage(), 500);
            }
            break;
            
        case 'DELETE':
            // Delete image with ACID transaction
            // ATOMICITY: Image deletion and primary reassignment happen atomically
            // CONSISTENCY: Ensures product always has a primary image if images exist
            // ISOLATION: FOR UPDATE prevents concurrent modifications
            // DURABILITY: COMMIT ensures permanent deletion
            if (!$productIdParam || !$imageIdParam) {
                sendError('Product ID and Image ID required', 400);
            }
            
            // ATOMICITY: Start transaction - all operations succeed or all fail
            $pdo->exec("START TRANSACTION");
            
            try {
                // ISOLATION: Row-level locking prevents concurrent image modifications
                // CONSISTENCY: Validate image exists
                // Check if image exists WITH ROW-LEVEL LOCKING
                $stmt = $pdo->prepare("
                    SELECT image_id, is_primary 
                    FROM product_images 
                    WHERE image_id = ? AND product_id = ? 
                    FOR UPDATE
                ");
                $stmt->execute([$imageIdParam, $productIdParam]);
                $image = $stmt->fetch();
                
                if (!$image) {
                    $pdo->exec("ROLLBACK");
                    sendError('Image not found', 404);
                }
                
                // ATOMICITY: Image deletion within transaction
                // Delete image
                $stmt = $pdo->prepare("DELETE FROM product_images WHERE image_id = ?");
                $stmt->execute([$imageIdParam]);
                
                // CONSISTENCY: Maintain data integrity - ensure product has primary image
                // ATOMICITY: Primary reassignment within same transaction
                // If primary image was deleted, set another as primary
                if ($image['is_primary']) {
                    $updateStmt = $pdo->prepare("
                        UPDATE product_images 
                        SET is_primary = 1 
                        WHERE product_id = ? 
                        ORDER BY sort_order ASC, image_id ASC 
                        LIMIT 1
                    ");
                    $updateStmt->execute([$productIdParam]);
                }
                
                // DURABILITY: COMMIT ensures all changes are permanently saved
                $pdo->exec("COMMIT");
                sendResponse(null, 'Image deleted successfully');
            } catch (Exception $e) {
                // ATOMICITY: Rollback ensures no partial state on error
                $pdo->exec("ROLLBACK");
                error_log('Image deletion error: ' . $e->getMessage());
                sendError('Failed to delete image: ' . $e->getMessage(), 500);
            }
            break;
            
        default:
            sendError('Method not allowed', 405);
            break;
    }
} catch (PDOException $e) {
    sendError('Database error: ' . $e->getMessage(), 500);
}
?>
