<?php
/**
 * FORENSICS LOGGING SYSTEM
 * 
 * RECOVER: Forensics - postmortem - fix vulnerability
 * 
 * Detailed logging for security incident investigation
 */

require_once __DIR__ . '/../config/database.php';

/**
 * Log detailed forensics information
 * 
 * @param PDO $pdo Database connection
 * @param string $incidentType Type of incident
 * @param string $description Incident description
 * @param int|null $userId User ID involved
 * @param array|null $context Additional context data
 * @return bool Success status
 */
function logForensics($pdo, $incidentType, $description, $userId = null, $context = null) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO forensics_log (
                incident_type,
                description,
                user_id,
                ip_address,
                user_agent,
                request_method,
                request_uri,
                request_headers,
                request_body,
                context_data,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        
        $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
        $requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'unknown';
        $requestUri = $_SERVER['REQUEST_URI'] ?? 'unknown';
        
        // Capture request headers (sanitized)
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (strpos($key, 'HTTP_') === 0) {
                $headerName = str_replace('_', '-', substr($key, 5));
                // Don't log sensitive headers
                if (!in_array(strtolower($headerName), ['authorization', 'cookie'])) {
                    $headers[$headerName] = $value;
                }
            }
        }
        
        // Capture request body (sanitized, limit size)
        $requestBody = null;
        if ($requestMethod === 'POST' || $requestMethod === 'PUT') {
            $body = file_get_contents('php://input');
            // Limit body size to 10KB for forensics
            if (strlen($body) <= 10240) {
                // Remove sensitive data
                $bodyData = json_decode($body, true);
                if ($bodyData) {
                    unset($bodyData['password']);
                    unset($bodyData['password_hash']);
                    unset($bodyData['token']);
                    $requestBody = json_encode($bodyData);
                } else {
                    $requestBody = substr($body, 0, 10240);
                }
            }
        }
        
        $contextJson = $context ? json_encode($context) : null;
        
        $stmt->execute([
            $incidentType,
            $description,
            $userId,
            $ipAddress,
            $userAgent,
            $requestMethod,
            $requestUri,
            json_encode($headers),
            $requestBody,
            $contextJson
        ]);
        
        return true;
    } catch (PDOException $e) {
        error_log("Forensics log error: " . $e->getMessage());
        return false;
    }
}

/**
 * Get forensics data for incident investigation
 * 
 * @param PDO $pdo Database connection
 * @param string $incidentType Incident type filter
 * @param string|null $dateFrom Start date
 * @param string|null $dateTo End date
 * @param int|null $userId User ID filter
 * @return array Forensics records
 */
function getForensicsData($pdo, $incidentType = null, $dateFrom = null, $dateTo = null, $userId = null) {
    try {
        $where = ["1=1"];
        $params = [];
        
        if ($incidentType) {
            $where[] = "incident_type = ?";
            $params[] = $incidentType;
        }
        
        if ($dateFrom) {
            $where[] = "created_at >= ?";
            $params[] = $dateFrom;
        }
        
        if ($dateTo) {
            $where[] = "created_at <= ?";
            $params[] = $dateTo;
        }
        
        if ($userId) {
            $where[] = "user_id = ?";
            $params[] = $userId;
        }
        
        $sql = "
            SELECT * FROM forensics_log 
            WHERE " . implode(" AND ", $where) . "
            ORDER BY created_at DESC
            LIMIT 1000
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        error_log("Get forensics data error: " . $e->getMessage());
        return [];
    }
}

/**
 * Analyze security incident timeline
 * 
 * @param PDO $pdo Database connection
 * @param string $incidentId Incident identifier
 * @return array Timeline analysis
 */
function analyzeIncidentTimeline($pdo, $incidentId) {
    try {
        // Get all related events
        $stmt = $pdo->prepare("
            SELECT 
                'security_audit' as source,
                event_type as type,
                description,
                user_id,
                ip_address,
                created_at
            FROM security_audit_log
            WHERE metadata LIKE ?
            UNION ALL
            SELECT 
                'forensics' as source,
                incident_type as type,
                description,
                user_id,
                ip_address,
                created_at
            FROM forensics_log
            WHERE description LIKE ?
            ORDER BY created_at ASC
        ");
        
        $search = "%$incidentId%";
        $stmt->execute([$search, $search]);
        
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        error_log("Incident timeline analysis error: " . $e->getMessage());
        return [];
    }
}

?>


