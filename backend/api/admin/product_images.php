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
            // Add new image to product
            if (!$productIdParam) {
                sendError('Product ID required', 400);
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            $errors = validateRequired($input, ['image_url']);
            if (!empty($errors)) {
                sendError('Validation failed', 400, $errors);
            }
            
            // Check if product exists
            $stmt = $pdo->prepare("SELECT product_id FROM products WHERE product_id = ?");
            $stmt->execute([$productIdParam]);
            if (!$stmt->fetch()) {
                sendError('Product not found', 404);
            }
            
            // Validate URL format
            if (!filter_var($input['image_url'], FILTER_VALIDATE_URL)) {
                sendError('Invalid image URL format', 400);
            }
            
            // If this is being set as primary, unset other primary images
            if (isset($input['is_primary']) && $input['is_primary']) {
                $stmt = $pdo->prepare("UPDATE product_images SET is_primary = FALSE WHERE product_id = ?");
                $stmt->execute([$productIdParam]);
            }
            
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
            
            // Get created image
            $stmt = $pdo->prepare("
                SELECT image_id, image_url, alt_text, is_primary, sort_order, created_at
                FROM product_images WHERE image_id = ?
            ");
            $stmt->execute([$newImageId]);
            $newImage = $stmt->fetch();
            
            sendResponse($newImage, 'Image added successfully', 201);
            break;
            
        case 'PUT':
            if (!$productIdParam || !$imageIdParam) {
                sendError('Product ID and Image ID required', 400);
            }
            
            if ($isSetPrimaryRequest) {
                // Set image as primary
                // First, unset all primary images for this product
                $stmt = $pdo->prepare("UPDATE product_images SET is_primary = FALSE WHERE product_id = ?");
                $stmt->execute([$productIdParam]);
                
                // Set the specified image as primary
                $stmt = $pdo->prepare("UPDATE product_images SET is_primary = TRUE WHERE image_id = ? AND product_id = ?");
                $stmt->execute([$imageIdParam, $productIdParam]);
                
                if ($stmt->rowCount() === 0) {
                    sendError('Image not found', 404);
                }
                
                sendResponse(null, 'Primary image updated successfully');
            } else {
                // Update image details
                $input = json_decode(file_get_contents('php://input'), true);
                
                // Check if image exists
                $stmt = $pdo->prepare("SELECT image_id FROM product_images WHERE image_id = ? AND product_id = ?");
                $stmt->execute([$imageIdParam, $productIdParam]);
                if (!$stmt->fetch()) {
                    sendError('Image not found', 404);
                }
                
                // Validate URL format if provided
                if (isset($input['image_url']) && !filter_var($input['image_url'], FILTER_VALIDATE_URL)) {
                    sendError('Invalid image URL format', 400);
                }
                
                // If this is being set as primary, unset other primary images
                if (isset($input['is_primary']) && $input['is_primary']) {
                    $stmt = $pdo->prepare("UPDATE product_images SET is_primary = FALSE WHERE product_id = ? AND image_id != ?");
                    $stmt->execute([$productIdParam, $imageIdParam]);
                }
                
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
                    sendError('No fields to update', 400);
                }
                
                $params[] = $imageIdParam;
                
                $sql = "UPDATE product_images SET " . implode(', ', $updateFields) . " WHERE image_id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                
                // Get updated image
                $stmt = $pdo->prepare("
                    SELECT image_id, image_url, alt_text, is_primary, sort_order, created_at
                    FROM product_images WHERE image_id = ?
                ");
                $stmt->execute([$imageIdParam]);
                $updatedImage = $stmt->fetch();
                
                sendResponse($updatedImage, 'Image updated successfully');
            }
            break;
            
        case 'DELETE':
            // Delete image
            if (!$productIdParam || !$imageIdParam) {
                sendError('Product ID and Image ID required', 400);
            }
            
            // Check if image exists
            $stmt = $pdo->prepare("SELECT image_id FROM product_images WHERE image_id = ? AND product_id = ?");
            $stmt->execute([$imageIdParam, $productIdParam]);
            if (!$stmt->fetch()) {
                sendError('Image not found', 404);
            }
            
            // Delete image
            $stmt = $pdo->prepare("DELETE FROM product_images WHERE image_id = ?");
            $stmt->execute([$imageIdParam]);
            
            sendResponse(null, 'Image deleted successfully');
            break;
            
        default:
            sendError('Method not allowed', 405);
            break;
    }
} catch (PDOException $e) {
    sendError('Database error: ' . $e->getMessage(), 500);
}
?>
