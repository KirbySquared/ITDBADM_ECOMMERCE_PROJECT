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
 * Check if request should be rate limited (READ-ONLY check, does not increment)
 * 
 * @param PDO $pdo Database connection
 * @param string $identifier Unique identifier (user_id, ip_address, etc.)
 * @param string $action Action being rate limited (login, api_call, etc.)
 * @param int $maxAttempts Maximum attempts allowed
 * @return array ['allowed' => bool, 'remaining' => int, 'reset_at' => timestamp, 'current_attempts' => int]
 */
function checkRateLimit($pdo, $identifier, $action, $maxAttempts = 5) {
    try {
        // First, check if rate_limits table exists
        $tableCheck = $pdo->query("
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = 'rate_limits'
        ");
        $tableExists = $tableCheck->fetch()['count'] > 0;
        
        if (!$tableExists) {
            error_log("WARNING: rate_limits table does not exist! Rate limiting is disabled. Run create_security_tables.sql");
            // Allow request if table doesn't exist (but log warning)
            return [
                'allowed' => true,
                'remaining' => $maxAttempts,
                'reset_at' => null,
                'current_attempts' => 0,
                'error' => 'Rate limiting system not configured'
            ];
        }
        
        // Clean old entries
        $pdo->exec("
            DELETE FROM rate_limits 
            WHERE expires_at < NOW()
        ");
        
        // Check current rate limit (READ-ONLY, no increment)
        $stmt = $pdo->prepare("
            SELECT attempts, expires_at 
            FROM rate_limits 
            WHERE identifier = ? AND action = ?
        ");
        $stmt->execute([$identifier, $action]);
        $limit = $stmt->fetch();
        
        if (!$limit) {
            // No previous attempts
            return [
                'allowed' => true,
                'remaining' => $maxAttempts,
                'reset_at' => null,
                'current_attempts' => 0
            ];
        }
        
        $currentAttempts = (int)$limit['attempts'];
        
        // Check if limit exceeded
        if ($currentAttempts >= $maxAttempts) {
            return [
                'allowed' => false,
                'remaining' => 0,
                'reset_at' => $limit['expires_at'],
                'current_attempts' => $currentAttempts
            ];
        }
        
        return [
            'allowed' => true,
            'remaining' => max(0, $maxAttempts - $currentAttempts),
            'reset_at' => $limit['expires_at'],
            'current_attempts' => $currentAttempts
        ];
        
    } catch (PDOException $e) {
        error_log("Rate limit check error: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        // Allow request on error (fail open) to avoid blocking legitimate users
        return [
            'allowed' => true,
            'remaining' => $maxAttempts,
            'reset_at' => null,
            'current_attempts' => 0,
            'error' => 'Rate limiting error: ' . $e->getMessage()
        ];
    }
}

/**
 * Increment rate limit counter (call this on failed attempts)
 * 
 * @param PDO $pdo Database connection
 * @param string $identifier Unique identifier
 * @param string $action Action being rate limited
 * @param int $maxAttempts Maximum attempts allowed
 * @param int $timeWindow Time window in seconds
 * @return array ['allowed' => bool, 'remaining' => int, 'reset_at' => timestamp]
 */
function incrementRateLimit($pdo, $identifier, $action, $maxAttempts = 5, $timeWindow = 300) {
    try {
        // Clean old entries
        $pdo->exec("
            DELETE FROM rate_limits 
            WHERE expires_at < NOW()
        ");
        
        // Check if entry exists
        $stmt = $pdo->prepare("
            SELECT attempts, expires_at 
            FROM rate_limits 
            WHERE identifier = ? AND action = ?
        ");
        $stmt->execute([$identifier, $action]);
        $limit = $stmt->fetch();
        
        if (!$limit) {
            // First failed attempt, create new entry
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
        
        // Increment attempts
        $stmt = $pdo->prepare("
            UPDATE rate_limits 
            SET attempts = attempts + 1 
            WHERE identifier = ? AND action = ?
        ");
        $stmt->execute([$identifier, $action]);
        
        // Get updated attempts count
        $stmt = $pdo->prepare("
            SELECT attempts, expires_at FROM rate_limits 
            WHERE identifier = ? AND action = ?
        ");
        $stmt->execute([$identifier, $action]);
        $updated = $stmt->fetch();
        $currentAttempts = (int)$updated['attempts'];
        
        // Check if limit exceeded after increment
        if ($currentAttempts >= $maxAttempts) {
            return [
                'allowed' => false,
                'remaining' => 0,
                'reset_at' => $updated['expires_at']
            ];
        }
        
        return [
            'allowed' => true,
            'remaining' => max(0, $maxAttempts - $currentAttempts),
            'reset_at' => $updated['expires_at']
        ];
        
    } catch (PDOException $e) {
        error_log("Rate limit increment error: " . $e->getMessage());
        // Don't block on increment error
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


