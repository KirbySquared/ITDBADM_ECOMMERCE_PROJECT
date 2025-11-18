<?php
// API Response Helper Functions

function sendResponse($data = null, $message = '', $statusCode = 200) {
    // Clean any buffered output
    if (ob_get_level()) {
        ob_clean();
    }
    
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
    // Clean any buffered output
    if (ob_get_level()) {
        ob_clean();
    }
    
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
        if (!isset($data[$field])) {
            $errors[$field] = ucfirst($field) . ' is required';
        } elseif (is_array($data[$field])) {
            // For arrays, check if they're empty
            if (empty($data[$field])) {
                $errors[$field] = ucfirst($field) . ' is required';
            }
        } else {
            // For strings, check if they're empty after trimming
            if (empty(trim($data[$field]))) {
                $errors[$field] = ucfirst($field) . ' is required';
            }
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
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload = json_encode([
        'user_id' => $userId,
        'iat' => time(),
        'exp' => time() + (24 * 60 * 60) // 24 hours
    ]);
    
    $base64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    
    $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, JWT_SECRET, true);
    $base64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    
    return $base64Header . "." . $base64Payload . "." . $base64Signature;
}

function validateToken($token) {
    try {
        if (empty($token)) {
            error_log("validateToken: Empty token provided");
            return false;
        }
        
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            error_log("validateToken: Invalid token format - expected 3 parts, got " . count($parts));
            return false;
        }
        
        list($base64Header, $base64Payload, $base64Signature) = $parts;
        
        // Verify signature
        $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, JWT_SECRET, true);
        $expectedSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
        
        if (!hash_equals($expectedSignature, $base64Signature)) {
            error_log("validateToken: Signature mismatch");
            return false;
        }
        
        // Decode payload
        $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $base64Payload)), true);
        
        if (!$payload || !isset($payload['user_id']) || !isset($payload['exp'])) {
            error_log("validateToken: Invalid payload or missing fields - payload: " . json_encode($payload));
            return false;
        }
        
        if ($payload['exp'] < time()) {
            error_log("validateToken: Token expired - exp: " . $payload['exp'] . ", now: " . time());
            return false;
        }
        
        error_log("validateToken: Success - user_id: " . $payload['user_id']);
        return $payload['user_id'];
    } catch (Exception $e) {
        error_log("validateToken: Exception - " . $e->getMessage());
        return false;
    }
}
?>
