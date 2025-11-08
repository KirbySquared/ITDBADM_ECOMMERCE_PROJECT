<?php
/**
 * /api/cart index router
 *
 * Routes HTTP methods to the appropriate cart handlers:
 *  - GET     -> get_cart.php
 *  - POST    -> add_to_cart.php
 *  - PUT     -> update_cart.php
 *  - DELETE  -> remove_from_cart.php
 */

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($method) {
    case 'GET':
        // Get current user's cart (with currency & conversions)
        require __DIR__ . '/get_cart.php';
        break;

    case 'POST':
        // Add item to cart (product_id, quantity)
        require __DIR__ . '/add_to_cart.php';
        break;

    case 'PUT':
        // Update quantity of a cart line (cart_id, quantity)
        require __DIR__ . '/update_cart.php';
        break;

    case 'DELETE':
        // Remove a cart line (cart_id)
        require __DIR__ . '/remove_from_cart.php';
        break;

    case 'OPTIONS':
        // Optional: if you need CORS preflight to succeed
        http_response_code(204);
        exit;

    default:
        require_once __DIR__ . '/../utils/response.php';
        sendError('Method not allowed', 405);
}
