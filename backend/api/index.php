<?php
require_once '../config/database.php';
require_once '../utils/response.php';

// Get request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = str_replace('/gamestore/api', '', $path);

// Remove leading slash
$path = ltrim($path, '/');

// Route the request
switch ($path) {
    case 'auth/register':
        if ($method === 'POST') {
            include 'auth/register.php';
        } else {
            sendError('Method not allowed', 405);
        }
        break;
        
    case 'auth/login':
        if ($method === 'POST') {
            include 'auth/login.php';
        } else {
            sendError('Method not allowed', 405);
        }
        break;
        
    case 'products':
        if ($method === 'GET') {
            include 'products/get_products.php';
        } else {
            sendError('Method not allowed', 405);
        }
        break;
        
    case 'products/' . (isset($_GET['id']) ? $_GET['id'] : ''):
        if ($method === 'GET') {
            include 'products/get_product.php';
        } else {
            sendError('Method not allowed', 405);
        }
        break;
        
    case 'categories':
        if ($method === 'GET') {
            include 'categories/get_categories.php';
        } else {
            sendError('Method not allowed', 405);
        }
        break;
        
    case 'cart':
        if ($method === 'GET') {
            include 'cart/get_cart.php';
        } elseif ($method === 'POST') {
            include 'cart/add_to_cart.php';
        } elseif ($method === 'PUT') {
            include 'cart/update_cart.php';
        } elseif ($method === 'DELETE') {
            include 'cart/remove_from_cart.php';
        } else {
            sendError('Method not allowed', 405);
        }
        break;
        
    default:
        sendError('Endpoint not found', 404);
        break;
}
?>
