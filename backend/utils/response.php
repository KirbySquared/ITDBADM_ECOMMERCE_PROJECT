<?php
// API Response Helper Functions

function sendResponse($data = null, $message = '', $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    
    $response = [
        'success' => $statusCode < 400,
        'message' => $message,
        'data' => $data
    ];
    
    echo json_encode($response);
    exit();
}

function sendError($message = 'An error occurred', $statusCode = 400, $errors = null) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    
    $response = [
        'success' => false,
        'message' => $message,
        'errors' => $errors
    ];
    
    echo json_encode($response);
    exit();
}

function validateRequired($data, $requiredFields) {
    $errors = [];
    
    foreach ($requiredFields as $field) {
        if (!isset($data[$field]) || empty(trim($data[$field]))) {
            $errors[$field] = ucfirst($field) . ' is required';
        }
    }
    
    return $errors;
}

function sanitizeInput($data) {
    if (is_array($data)) {
        return array_map('sanitizeInput', $data);
    }
    return htmlspecialchars(strip_tags(trim($data)));
}

function generateToken($userId) {
    $payload = [
        'user_id' => $userId,
        'iat' => time(),
        'exp' => time() + (24 * 60 * 60) // 24 hours
    ];
    
    return base64_encode(json_encode($payload));
}

function validateToken($token) {
    try {
        $payload = json_decode(base64_decode($token), true);
        
        if (!$payload || !isset($payload['user_id']) || !isset($payload['exp'])) {
            return false;
        }
        
        if ($payload['exp'] < time()) {
            return false;
        }
        
        return $payload['user_id'];
    } catch (Exception $e) {
        return false;
    }
}
?>
