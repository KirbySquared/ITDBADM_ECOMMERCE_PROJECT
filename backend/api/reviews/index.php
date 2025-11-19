<?php
/**
 * REVIEWS API ENDPOINT
 *
 * This endpoint handles review management operations.
 *
 * ROUTES:
 * - GET /api/reviews?product_id={id} - Get all reviews for a product
 * - POST /api/reviews - Create a new review (requires authentication)
 *
 * AUTHENTICATION:
 * - POST requires valid JWT token
 * - Users can only review products they have purchased
 * - Users can only create one review per product
 *
 * ACID COMPLIANCE ANALYSIS:
 *
 * POST (Create Review):
 *   ATOMICITY: GOOD - Uses transaction wrapper
 *   CONSISTENCY: GOOD - Validates product exists, verifies purchase, prevents duplicate reviews
 *   ISOLATION: GOOD - Uses FOR UPDATE on validation checks
 *   DURABILITY: GOOD - COMMIT ensures persistence
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
header('Content-Type: application/json');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Get authorization header for POST requests
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $token = null;
    $userId = null;
    
    if ($method === 'POST') {
        // Case-insensitive header check
        foreach ($headers as $k => $v) {
            if (strtolower($k) === 'authorization') {
                $token = preg_replace('/^Bearer\s+/i', '', $v);
                break;
            }
        }
        
        if (!$token) {
            sendError('Authorization token required', 401);
        }
        
        $userId = validateToken($token);
        if (!$userId) {
            sendError('Invalid or expired token', 401);
        }
    }
    
    if ($method === 'GET') {
        $productId = isset($_GET['product_id']) ? (int)$_GET['product_id'] : 0;
        
        if ($productId <= 0) {
            sendError('Invalid product ID', 400);
        }
        
        // Fetch all reviews for the product with user information and purchase verification
        // This connects reviews to orders and customers to verify if reviewer actually purchased
        $stmt = $pdo->prepare("
            SELECT 
                r.review_id,
                r.user_id,
                r.product_id,
                r.rating,
                r.comment,
                r.created_at,
                u.username,
                u.email,
                u.first_name,
                u.last_name,
                -- Check if user has purchased this product (verified purchase)
                CASE 
                    WHEN EXISTS (
                        SELECT 1 
                        FROM order_items oi
                        INNER JOIN orders o ON oi.order_id = o.order_id
                        INNER JOIN payments pay ON pay.order_id = o.order_id
                        WHERE oi.product_id = r.product_id 
                        AND o.user_id = r.user_id
                        AND pay.payment_status = 'completed'
                    ) THEN 1
                    ELSE 0
                END AS verified_purchase,
                -- Get purchase count for this user and product
                COALESCE((
                    SELECT SUM(oi.quantity)
                    FROM order_items oi
                    INNER JOIN orders o ON oi.order_id = o.order_id
                    INNER JOIN payments pay ON pay.order_id = o.order_id
                    WHERE oi.product_id = r.product_id 
                    AND o.user_id = r.user_id
                    AND pay.payment_status = 'completed'
                ), 0) AS purchase_quantity,
                -- Get first purchase date
                (
                    SELECT MIN(o.order_date)
                    FROM order_items oi
                    INNER JOIN orders o ON oi.order_id = o.order_id
                    INNER JOIN payments pay ON pay.order_id = o.order_id
                    WHERE oi.product_id = r.product_id 
                    AND o.user_id = r.user_id
                    AND pay.payment_status = 'completed'
                ) AS first_purchase_date
            FROM reviews r
            LEFT JOIN users u ON r.user_id = u.user_id
            WHERE r.product_id = ?
            ORDER BY r.created_at DESC
        ");
        $stmt->execute([$productId]);
        $reviews = $stmt->fetchAll();
        
        // Calculate average rating and distribution
        $totalReviews = count($reviews);
        $averageRating = 0;
        $ratingDistribution = [5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0];
        
        if ($totalReviews > 0) {
            $sum = 0;
            foreach ($reviews as $review) {
                $rating = (int)$review['rating'];
                $sum += $rating;
                if (isset($ratingDistribution[$rating])) {
                    $ratingDistribution[$rating]++;
                }
            }
            $averageRating = round($sum / $totalReviews, 2);
        }
        
        // Calculate percentages for each rating
        $ratingPercentages = [];
        foreach ($ratingDistribution as $rating => $count) {
            $ratingPercentages[$rating] = $totalReviews > 0 
                ? round(($count / $totalReviews) * 100, 1) 
                : 0;
        }
        
        // Calculate additional statistics
        $verifiedPurchases = 0;
        $totalPurchases = 0;
        foreach ($reviews as $review) {
            if ($review['verified_purchase'] == 1) {
                $verifiedPurchases++;
            }
            $totalPurchases += (int)$review['purchase_quantity'];
        }
        
        sendResponse([
            'reviews' => $reviews,
            'summary' => [
                'total_reviews' => $totalReviews,
                'average_rating' => $averageRating,
                'rating_distribution' => $ratingDistribution,
                'rating_percentages' => $ratingPercentages,
                'verified_purchases' => $verifiedPurchases,
                'total_purchases_by_reviewers' => $totalPurchases
            ]
        ], 'Reviews fetched successfully');
        
    } elseif ($method === 'POST') {
        // Create a new review with ACID transaction support
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['product_id']) || !isset($input['rating'])) {
            sendError('Product ID and rating are required', 400);
        }
        
        $productId = (int)$input['product_id'];
        $rating = (int)$input['rating'];
        $comment = isset($input['comment']) ? trim($input['comment']) : null;
        
        // Validate rating
        if ($rating < 1 || $rating > 5) {
            sendError('Rating must be between 1 and 5', 400);
        }
        
        // ATOMICITY: Start transaction - all operations succeed or all fail
        $pdo->exec("START TRANSACTION");
        
        try {
            // ISOLATION: Row-level locking prevents concurrent product modifications
            // CONSISTENCY: Validate product exists before INSERT
            // Check if product exists WITH ROW-LEVEL LOCKING
            $stmt = $pdo->prepare("SELECT product_id FROM products WHERE product_id = ? FOR UPDATE");
            $stmt->execute([$productId]);
            if (!$stmt->fetch()) {
                $pdo->exec("ROLLBACK");
                sendError('Product not found', 404);
            }
            
            // CONSISTENCY: Verify that user has purchased this product (connect to orders)
            // ISOLATION: Row-level locking prevents concurrent order modifications
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as purchase_count
                FROM order_items oi
                INNER JOIN orders o ON oi.order_id = o.order_id
                INNER JOIN payments pay ON pay.order_id = o.order_id
                WHERE oi.product_id = ? 
                AND o.user_id = ? 
                AND pay.payment_status = 'completed'
                FOR UPDATE
            ");
            $stmt->execute([$productId, $userId]);
            $purchase = $stmt->fetch();
            
            if (!$purchase || (int)$purchase['purchase_count'] === 0) {
                $pdo->exec("ROLLBACK");
                sendError('You can only review products you have purchased', 403);
            }
            
            // CONSISTENCY: Prevent duplicate reviews
            // ISOLATION: Row-level locking prevents concurrent review creation
            // Check if user already reviewed this product WITH ROW-LEVEL LOCKING
            $stmt = $pdo->prepare("SELECT review_id FROM reviews WHERE user_id = ? AND product_id = ? FOR UPDATE");
            $stmt->execute([$userId, $productId]);
            if ($stmt->fetch()) {
                $pdo->exec("ROLLBACK");
                sendError('You have already reviewed this product', 409);
            }
            
            // ATOMICITY: Review INSERT within transaction
            // Insert review
            $stmt = $pdo->prepare("
                INSERT INTO reviews (user_id, product_id, rating, comment)
                VALUES (?, ?, ?, ?)
            ");
            $stmt->execute([$userId, $productId, $rating, $comment]);
            $reviewId = $pdo->lastInsertId();
            
            // DURABILITY: COMMIT ensures all changes are permanently saved
            // Commit transaction
            $pdo->exec("COMMIT");
            
            // Fetch the created review with user info
            $stmt = $pdo->prepare("
                SELECT 
                    r.review_id,
                    r.user_id,
                    r.product_id,
                    r.rating,
                    r.comment,
                    r.created_at,
                    u.username,
                    u.email,
                    u.first_name,
                    u.last_name,
                    1 AS verified_purchase,
                    (SELECT SUM(oi.quantity)
                     FROM order_items oi
                     INNER JOIN orders o ON oi.order_id = o.order_id
                     INNER JOIN payments pay ON pay.order_id = o.order_id
                     WHERE oi.product_id = r.product_id 
                     AND o.user_id = r.user_id
                     AND pay.payment_status = 'completed') AS purchase_quantity
                FROM reviews r
                LEFT JOIN users u ON r.user_id = u.user_id
                WHERE r.review_id = ?
            ");
            $stmt->execute([$reviewId]);
            $review = $stmt->fetch();
            
            sendResponse($review, 'Review created successfully', 201);
        } catch (Exception $e) {
            // ATOMICITY: Rollback ensures no partial state on error
            $pdo->exec("ROLLBACK");
            error_log('Review creation error: ' . $e->getMessage());
            sendError('Failed to create review: ' . $e->getMessage(), 500);
        }
        
    } else {
        sendError('Method not allowed', 405);
    }
} catch (Exception $e) {
    error_log("Reviews API Error: " . $e->getMessage());
    sendError('Failed to fetch reviews: ' . $e->getMessage(), 500);
}
?>

