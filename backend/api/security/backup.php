<?php
/**
 * DATABASE BACKUP API ENDPOINT
 * 
 * RECOVER: Database backup and restore operations
 * 
 * Allows admins to create and restore database backups
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/database_backup.php';
require_once __DIR__ . '/../../utils/security_audit.php';

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
        $action = $_GET['action'] ?? 'list';
        
        if ($action === 'list') {
            // List available backups
            $backups = listBackups();
            sendResponse(['backups' => $backups], 'Backups listed successfully');
        } else {
            sendError('Invalid action', 400);
        }
        
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $action = $input['action'] ?? 'create';
        
        if ($action === 'create') {
            // Create backup
            $backupDir = $input['backup_dir'] ?? null;
            $result = createDatabaseBackup($pdo, $backupDir);
            
            if ($result['success']) {
                // Log security event
                logSecurityEvent($pdo, 'backup_created', 'medium', 
                    "Database backup created: {$result['file']}", $userId);
                
                sendResponse($result, 'Backup created successfully');
            } else {
                sendError($result['error'] ?? 'Backup creation failed', 500);
            }
            
        } elseif ($action === 'restore') {
            // Restore backup
            $backupFile = $input['backup_file'] ?? null;
            
            if (!$backupFile) {
                sendError('Backup file required', 400);
            }
            
            // Log before restore
            logSecurityEvent($pdo, 'backup_restore_initiated', 'high', 
                "Database restore initiated: $backupFile", $userId);
            
            $result = restoreDatabaseBackup($pdo, $backupFile);
            
            if ($result['success']) {
                logSecurityEvent($pdo, 'backup_restored', 'high', 
                    "Database restored from: $backupFile", $userId);
                
                sendResponse($result, 'Backup restored successfully');
            } else {
                logSecurityEvent($pdo, 'backup_restore_failed', 'high', 
                    "Database restore failed: {$result['error']}", $userId);
                
                sendError($result['error'] ?? 'Backup restore failed', 500);
            }
        } else {
            sendError('Invalid action', 400);
        }
    } else {
        sendError('Method not allowed', 405);
    }
    
} catch (PDOException $e) {
    error_log('Backup API error: ' . $e->getMessage());
    sendError('Database error', 500);
} catch (Exception $e) {
    error_log('Backup API error: ' . $e->getMessage());
    sendError('An error occurred: ' . $e->getMessage(), 500);
}
?>


