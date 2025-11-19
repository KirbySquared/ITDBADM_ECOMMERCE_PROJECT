<?php
/**
 * RATE LIMITING SYSTEM
 * 
 * PREVENT: Using access controls to prevent abuse
 * 
 * Prevents brute force attacks and API abuse by limiting request rates
 */

require_once __DIR__ . '/../config/database.php';

/**
 * Check if request should be rate limited
 * 
 * @param PDO $pdo Database connection
 * @param string $identifier Unique identifier (user_id, ip_address, etc.)
 * @param string $action Action being rate limited (login, api_call, etc.)
 * @param int $maxAttempts Maximum attempts allowed
 * @param int $timeWindow Time window in seconds
 * @return array ['allowed' => bool, 'remaining' => int, 'reset_at' => timestamp]
 */
function checkRateLimit($pdo, $identifier, $action, $maxAttempts = 5, $timeWindow = 300) {
    try {
        // Clean old entries
        $pdo->exec("
            DELETE FROM rate_limits 
            WHERE expires_at < NOW()
        ");
        
        // Check current rate limit
        $stmt = $pdo->prepare("
            SELECT attempts, expires_at 
            FROM rate_limits 
            WHERE identifier = ? AND action = ?
        ");
        $stmt->execute([$identifier, $action]);
        $limit = $stmt->fetch();
        
        if (!$limit) {
            // First attempt, create new entry
            $expiresAt = date('Y-m-d H:i:s', time() + $timeWindow);
            $stmt = $pdo->prepare("
                INSERT INTO rate_limits (identifier, action, attempts, expires_at)
                VALUES (?, ?, 1, ?)
            ");
            $stmt->execute([$identifier, $action, $expiresAt]);
            
            return [
                'allowed' => true,
                'remaining' => $maxAttempts - 1,
                'reset_at' => $expiresAt
            ];
        }
        
        // Check if limit exceeded
        if ($limit['attempts'] >= $maxAttempts) {
            return [
                'allowed' => false,
                'remaining' => 0,
                'reset_at' => $limit['expires_at']
            ];
        }
        
        // Increment attempts
        $stmt = $pdo->prepare("
            UPDATE rate_limits 
            SET attempts = attempts + 1 
            WHERE identifier = ? AND action = ?
        ");
        $stmt->execute([$identifier, $action]);
        
        return [
            'allowed' => true,
            'remaining' => $maxAttempts - ($limit['attempts'] + 1),
            'reset_at' => $limit['expires_at']
        ];
        
    } catch (PDOException $e) {
        error_log("Rate limit check error: " . $e->getMessage());
        // On error, allow request (fail open)
        return [
            'allowed' => true,
            'remaining' => $maxAttempts,
            'reset_at' => null
        ];
    }
}

/**
 * Reset rate limit for identifier and action
 * 
 * @param PDO $pdo Database connection
 * @param string $identifier Identifier
 * @param string $action Action
 */
function resetRateLimit($pdo, $identifier, $action) {
    try {
        $stmt = $pdo->prepare("
            DELETE FROM rate_limits 
            WHERE identifier = ? AND action = ?
        ");
        $stmt->execute([$identifier, $action]);
    } catch (PDOException $e) {
        error_log("Rate limit reset error: " . $e->getMessage());
    }
}

/**
 * Get client identifier (IP address or user ID)
 * 
 * @param int|null $userId User ID if authenticated
 * @return string Identifier
 */
function getClientIdentifier($userId = null) {
    if ($userId) {
        return "user_" . $userId;
    }
    
    // Get IP address, handling proxies
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    
    // Check for forwarded IP (if behind proxy)
    if (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $forwarded = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $ip = trim($forwarded[0]);
    }
    
    return "ip_" . $ip;
}

?>


