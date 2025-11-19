<?php
/**
 * SECURITY MIDDLEWARE WRAPPER
 * 
 * Easy-to-use wrapper that adds all security features to an endpoint
 * 
 * USAGE:
 * require_once __DIR__ . '/../../utils/security_middleware.php';
 * applySecurityMiddleware($pdo, $userId, 'endpoint_name');
 */

require_once __DIR__ . '/security_headers.php';
require_once __DIR__ . '/rate_limiter.php';
require_once __DIR__ . '/security_audit.php';

/**
 * Apply security middleware to an endpoint
 * 
 * @param PDO $pdo Database connection
 * @param int|null $userId User ID if authenticated
 * @param string $endpointName Name of the endpoint for rate limiting
 * @param array $options Configuration options
 * @return array Security check results
 */
function applySecurityMiddleware($pdo, $userId = null, $endpointName = 'api_call', $options = []) {
    $results = [
        'headers_set' => false,
        'rate_limit_passed' => true,
        'rate_limit_info' => null
    ];
    
    // Set security headers
    setSecurityHeaders();
    $results['headers_set'] = true;
    
    // Apply rate limiting if enabled (default: enabled)
    $rateLimitEnabled = $options['rate_limit'] ?? true;
    if ($rateLimitEnabled) {
        $maxAttempts = $options['max_attempts'] ?? 100;
        $timeWindow = $options['time_window'] ?? 3600; // 1 hour default
        
        $clientId = getClientIdentifier($userId);
        $rateLimit = checkRateLimit($pdo, $clientId, $endpointName, $maxAttempts, $timeWindow);
        
        $results['rate_limit_passed'] = $rateLimit['allowed'];
        $results['rate_limit_info'] = $rateLimit;
        
        if (!$rateLimit['allowed']) {
            // Log rate limit exceeded
            logSecurityEvent($pdo, 'rate_limit_exceeded', 'medium', 
                "Rate limit exceeded for endpoint: $endpointName", $userId, [
                    'endpoint' => $endpointName,
                    'identifier' => $clientId
                ]);
            
            return $results; // Return early, caller should check and send error
        }
    }
    
    return $results;
}

/**
 * Quick security check for authenticated endpoints
 * 
 * @param PDO $pdo Database connection
 * @param int $userId User ID
 * @param string $endpointName Endpoint name
 * @param bool $requireAuth Require authentication
 * @return bool|array True if passed, or array with error info
 */
function quickSecurityCheck($pdo, $userId, $endpointName, $requireAuth = true) {
    if ($requireAuth && !$userId) {
        return [
            'error' => 'Authentication required',
            'code' => 401
        ];
    }
    
    $results = applySecurityMiddleware($pdo, $userId, $endpointName);
    
    if (!$results['rate_limit_passed']) {
        return [
            'error' => 'Rate limit exceeded',
            'code' => 429,
            'reset_at' => $results['rate_limit_info']['reset_at']
        ];
    }
    
    return true;
}

?>


