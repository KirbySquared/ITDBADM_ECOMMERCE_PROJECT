<?php
/**
 * SECURITY MONITORING API ENDPOINT
 * 
 * DETECT: Monitor and alert for security events
 * 
 * Provides security monitoring and alerting capabilities for admins
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/security_audit.php';
require_once __DIR__ . '/../../utils/forensics.php';

header('Content-Type: application/json');

// Get authorization header
$headers = function_exists('getallheaders') ? getallheaders() : [];
$token = null;

foreach ($headers as $k => $v) {
    if (strtolower($k) === 'authorization') {
        $token = preg_replace('/^Bearer\s+/i', '', $v);
        break;
    }
}

if (!$token) {
    sendError('Authorization token required', 401);
}

// Validate token and check admin role
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
} catch (PDOException $e) {
    sendError('Database error', 500);
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $action = $_GET['action'] ?? 'dashboard';
        
        switch ($action) {
            case 'dashboard':
                // Get security dashboard statistics
                $stmt = $pdo->query("
                    SELECT 
                        COUNT(*) as total_events,
                        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_events,
                        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_events,
                        SUM(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as events_24h
                    FROM security_audit_log
                ");
                $stats = $stmt->fetch();
                
                // Get pending alerts
                $stmt = $pdo->query("
                    SELECT COUNT(*) as pending_alerts 
                    FROM security_alerts 
                    WHERE status = 'pending'
                ");
                $alerts = $stmt->fetch();
                
                // Get recent critical events
                $stmt = $pdo->query("
                    SELECT * FROM security_audit_log 
                    WHERE severity IN ('critical', 'high')
                    ORDER BY created_at DESC 
                    LIMIT 10
                ");
                $recentEvents = $stmt->fetchAll();
                
                sendResponse([
                    'statistics' => $stats,
                    'pending_alerts' => $alerts['pending_alerts'],
                    'recent_events' => $recentEvents
                ], 'Security dashboard data retrieved');
                
            case 'events':
                // Get security events with filters
                $filters = [
                    'event_type' => $_GET['event_type'] ?? null,
                    'severity' => $_GET['severity'] ?? null,
                    'user_id' => isset($_GET['user_id']) ? (int)$_GET['user_id'] : null,
                    'date_from' => $_GET['date_from'] ?? null,
                    'date_to' => $_GET['date_to'] ?? null
                ];
                
                // Remove null filters
                $filters = array_filter($filters, function($value) {
                    return $value !== null;
                });
                
                $limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));
                $offset = max(0, (int)($_GET['offset'] ?? 0));
                
                $events = getSecurityEvents($pdo, $filters, $limit, $offset);
                
                sendResponse([
                    'events' => $events,
                    'count' => count($events)
                ], 'Security events retrieved');
                
            case 'alerts':
                // Get security alerts
                $status = $_GET['status'] ?? 'pending';
                $limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));
                
                $stmt = $pdo->prepare("
                    SELECT * FROM security_alerts 
                    WHERE status = ?
                    ORDER BY created_at DESC 
                    LIMIT ?
                ");
                $stmt->execute([$status, $limit]);
                $alerts = $stmt->fetchAll();
                
                sendResponse([
                    'alerts' => $alerts,
                    'count' => count($alerts)
                ], 'Security alerts retrieved');
                
            case 'suspicious':
                // Detect suspicious activity
                $checkUserId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : null;
                $checkIp = $_GET['ip_address'] ?? null;
                
                $suspicious = detectSuspiciousActivity($pdo, $checkUserId, $checkIp);
                
                sendResponse([
                    'suspicious_activities' => $suspicious,
                    'count' => count($suspicious)
                ], 'Suspicious activity check completed');
                
            case 'forensics':
                // Get forensics data
                $incidentType = $_GET['incident_type'] ?? null;
                $dateFrom = $_GET['date_from'] ?? null;
                $dateTo = $_GET['date_to'] ?? null;
                $forensicsUserId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : null;
                
                $forensics = getForensicsData($pdo, $incidentType, $dateFrom, $dateTo, $forensicsUserId);
                
                sendResponse([
                    'forensics' => $forensics,
                    'count' => count($forensics)
                ], 'Forensics data retrieved');
                
            default:
                sendError('Invalid action', 400);
        }
        
    } elseif ($method === 'POST') {
        $action = $_GET['action'] ?? '';
        $input = json_decode(file_get_contents('php://input'), true);
        
        if ($action === 'alert_review') {
            // Mark alert as reviewed
            $alertId = (int)($input['alert_id'] ?? 0);
            $status = $input['status'] ?? 'reviewed';
            $notes = $input['notes'] ?? null;
            
            if (!$alertId) {
                sendError('Alert ID required', 400);
            }
            
            $stmt = $pdo->prepare("
                UPDATE security_alerts 
                SET status = ?, reviewed_by = ?, reviewed_at = NOW(), notes = ?
                WHERE alert_id = ?
            ");
            $stmt->execute([$status, $userId, $notes, $alertId]);
            
            sendResponse(['alert_id' => $alertId], 'Alert reviewed successfully');
        } else {
            sendError('Invalid action', 400);
        }
    } else {
        sendError('Method not allowed', 405);
    }
    
} catch (PDOException $e) {
    error_log('Security monitor API error: ' . $e->getMessage());
    sendError('Database error', 500);
} catch (Exception $e) {
    error_log('Security monitor API error: ' . $e->getMessage());
    sendError('An error occurred', 500);
}
?>


