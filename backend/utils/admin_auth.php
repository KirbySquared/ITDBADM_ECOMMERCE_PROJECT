<?php
// Admin authentication middleware
require_once '../config/database.php';
require_once '../utils/response.php';

function requireAdminAuth() {
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
        
        return $userId;
    } catch (PDOException $e) {
        sendError('Database error', 500);
    }
}

function requireAdminAuthWeb() {
    // For web-based admin panel (session-based)
    session_start();
    
    if (!isset($_SESSION['user_id'])) {
        header('Location: /admin/login.php');
        exit();
    }
    
    try {
        $stmt = $pdo->prepare("SELECT role FROM users WHERE user_id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        
        if (!$user || $user['role'] !== 'admin') {
            header('Location: /admin/login.php');
            exit();
        }
        
        return $_SESSION['user_id'];
    } catch (PDOException $e) {
        header('Location: /admin/login.php');
        exit();
    }
}
?>
