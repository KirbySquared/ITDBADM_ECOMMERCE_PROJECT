<?php
/**
 * SECURITY AUDIT LOGGING SYSTEM
 * 
 * ASSESS: Locate risks and vulnerabilities, ensure necessary security controls
 * DETECT: Audit, monitor, alert for security events
 * 
 * This system logs all security-relevant events for forensics and monitoring
 */

require_once __DIR__ . '/../config/database.php';

/**
 * Log security event to audit table
 * 
 * @param PDO $pdo Database connection
 * @param string $eventType Type of security event (login_failed, access_denied, etc.)
 * @param string $severity Severity level (low, medium, high, critical)
 * @param string $description Event description
 * @param int|null $userId User ID if applicable
 * @param array|null $metadata Additional metadata
 * @return bool Success status
 */
function logSecurityEvent($pdo, $eventType, $severity, $description, $userId = null, $metadata = null) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO security_audit_log (
                event_type, 
                severity, 
                description, 
                user_id, 
                ip_address, 
                user_agent, 
                metadata, 
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        
        $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
        $metadataJson = $metadata ? json_encode($metadata) : null;
        
        $stmt->execute([
            $eventType,
            $severity,
            $description,
            $userId,
            $ipAddress,
            $userAgent,
            $metadataJson
        ]);
        
        // If critical severity, trigger alert
        if ($severity === 'critical') {
            triggerSecurityAlert($pdo, $eventType, $description, $userId);
        }
        
        return true;
    } catch (PDOException $e) {
        error_log("Security audit log error: " . $e->getMessage());
        return false;
    }
}

/**
 * Trigger security alert for critical events
 * 
 * @param PDO $pdo Database connection
 * @param string $eventType Event type
 * @param string $description Event description
 * @param int|null $userId User ID
 */
function triggerSecurityAlert($pdo, $eventType, $description, $userId = null) {
    try {
        // Log to alerts table
        $stmt = $pdo->prepare("
            INSERT INTO security_alerts (
                alert_type,
                description,
                user_id,
                ip_address,
                status,
                created_at
            ) VALUES (?, ?, ?, ?, 'pending', NOW())
        ");
        
        $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $stmt->execute([$eventType, $description, $userId, $ipAddress]);
        
        // In production, you could send email/SMS notifications here
        error_log("SECURITY ALERT: $eventType - $description (User: $userId, IP: $ipAddress)");
    } catch (PDOException $e) {
        error_log("Security alert error: " . $e->getMessage());
    }
}

/**
 * Get security events for analysis
 * 
 * @param PDO $pdo Database connection
 * @param array $filters Filters (event_type, severity, user_id, date_from, date_to)
 * @param int $limit Limit results
 * @param int $offset Offset for pagination
 * @return array Security events
 */
function getSecurityEvents($pdo, $filters = [], $limit = 100, $offset = 0) {
    try {
        $where = ["1=1"];
        $params = [];
        
        if (isset($filters['event_type'])) {
            $where[] = "event_type = ?";
            $params[] = $filters['event_type'];
        }
        
        if (isset($filters['severity'])) {
            $where[] = "severity = ?";
            $params[] = $filters['severity'];
        }
        
        if (isset($filters['user_id'])) {
            $where[] = "user_id = ?";
            $params[] = $filters['user_id'];
        }
        
        if (isset($filters['date_from'])) {
            $where[] = "created_at >= ?";
            $params[] = $filters['date_from'];
        }
        
        if (isset($filters['date_to'])) {
            $where[] = "created_at <= ?";
            $params[] = $filters['date_to'];
        }
        
        $params[] = $limit;
        $params[] = $offset;
        
        $sql = "
            SELECT * FROM security_audit_log 
            WHERE " . implode(" AND ", $where) . "
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        error_log("Get security events error: " . $e->getMessage());
        return [];
    }
}

/**
 * Check for suspicious activity patterns
 * 
 * @param PDO $pdo Database connection
 * @param int|null $userId User ID to check
 * @param string $ipAddress IP address to check
 * @return array Suspicious activities found
 */
function detectSuspiciousActivity($pdo, $userId = null, $ipAddress = null) {
    $suspicious = [];
    
    try {
        $ipAddress = $ipAddress ?? ($_SERVER['REMOTE_ADDR'] ?? null);
        
        // Check for multiple failed login attempts
        if ($userId) {
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as count 
                FROM security_audit_log 
                WHERE event_type = 'login_failed' 
                AND user_id = ? 
                AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
            ");
            $stmt->execute([$userId]);
            $result = $stmt->fetch();
            if ($result && $result['count'] >= 5) {
                $suspicious[] = [
                    'type' => 'multiple_failed_logins',
                    'severity' => 'high',
                    'description' => "User $userId has $result[count] failed login attempts in the last hour"
                ];
            }
        }
        
        // Check for multiple failed logins from same IP
        if ($ipAddress) {
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as count 
                FROM security_audit_log 
                WHERE event_type = 'login_failed' 
                AND ip_address = ? 
                AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
            ");
            $stmt->execute([$ipAddress]);
            $result = $stmt->fetch();
            if ($result && $result['count'] >= 10) {
                $suspicious[] = [
                    'type' => 'brute_force_attempt',
                    'severity' => 'critical',
                    'description' => "IP $ipAddress has $result[count] failed login attempts in the last hour"
                ];
            }
        }
        
        // Check for access denied patterns
        if ($userId) {
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as count 
                FROM security_audit_log 
                WHERE event_type = 'access_denied' 
                AND user_id = ? 
                AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
            ");
            $stmt->execute([$userId]);
            $result = $stmt->fetch();
            if ($result && $result['count'] >= 10) {
                $suspicious[] = [
                    'type' => 'unauthorized_access_attempts',
                    'severity' => 'high',
                    'description' => "User $userId has $result[count] access denied events in the last hour"
                ];
            }
        }
        
    } catch (PDOException $e) {
        error_log("Detect suspicious activity error: " . $e->getMessage());
    }
    
    return $suspicious;
}

?>


