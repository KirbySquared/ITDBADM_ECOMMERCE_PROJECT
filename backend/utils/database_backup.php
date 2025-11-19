<?php
/**
 * DATABASE BACKUP AND RECOVERY SYSTEM
 * 
 * RECOVER: Ensure service is not interrupted as a result of a security incident
 * Even through the outage of a primary database
 * 
 * Provides database backup and recovery utilities
 */

require_once __DIR__ . '/../config/database.php';

/**
 * Create database backup
 * 
 * @param PDO $pdo Database connection
 * @param string $backupDir Directory to store backups
 * @return array Backup information
 */
function createDatabaseBackup($pdo, $backupDir = null) {
    if (!$backupDir) {
        $backupDir = __DIR__ . '/../../backups';
    }
    
    // Create backup directory if it doesn't exist
    if (!is_dir($backupDir)) {
        mkdir($backupDir, 0755, true);
    }
    
    $backupFile = $backupDir . '/backup_' . date('Y-m-d_H-i-s') . '.sql';
    $dbName = DB_NAME;
    $dbHost = DB_HOST;
    $dbUser = DB_USER;
    $dbPass = DB_PASS;
    
    try {
        // Use mysqldump if available
        $command = sprintf(
            'mysqldump -h %s -u %s -p%s %s > %s 2>&1',
            escapeshellarg($dbHost),
            escapeshellarg($dbUser),
            escapeshellarg($dbPass),
            escapeshellarg($dbName),
            escapeshellarg($backupFile)
        );
        
        exec($command, $output, $returnCode);
        
        if ($returnCode === 0 && file_exists($backupFile)) {
            // Log backup creation
            logBackupEvent($pdo, 'backup_created', $backupFile, filesize($backupFile));
            
            return [
                'success' => true,
                'file' => $backupFile,
                'size' => filesize($backupFile),
                'created_at' => date('Y-m-d H:i:s')
            ];
        } else {
            // Fallback: Manual backup using PDO
            return createManualBackup($pdo, $backupFile);
        }
    } catch (Exception $e) {
        error_log("Backup creation error: " . $e->getMessage());
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

/**
 * Create manual backup using PDO queries
 * 
 * @param PDO $pdo Database connection
 * @param string $backupFile Backup file path
 * @return array Backup information
 */
function createManualBackup($pdo, $backupFile) {
    try {
        $backup = "-- Database Backup\n";
        $backup .= "-- Created: " . date('Y-m-d H:i:s') . "\n\n";
        
        // Get all tables
        $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
        
        foreach ($tables as $table) {
            $backup .= "-- Table: $table\n";
            
            // Get table structure
            $createTable = $pdo->query("SHOW CREATE TABLE `$table`")->fetch();
            $backup .= $createTable['Create Table'] . ";\n\n";
            
            // Get table data
            $rows = $pdo->query("SELECT * FROM `$table`")->fetchAll(PDO::FETCH_ASSOC);
            if (count($rows) > 0) {
                $backup .= "INSERT INTO `$table` VALUES\n";
                $values = [];
                foreach ($rows as $row) {
                    $rowValues = array_map(function($val) use ($pdo) {
                        return $val === null ? 'NULL' : $pdo->quote($val);
                    }, array_values($row));
                    $values[] = "(" . implode(", ", $rowValues) . ")";
                }
                $backup .= implode(",\n", $values) . ";\n\n";
            }
        }
        
        file_put_contents($backupFile, $backup);
        
        logBackupEvent($pdo, 'backup_created', $backupFile, filesize($backupFile));
        
        return [
            'success' => true,
            'file' => $backupFile,
            'size' => filesize($backupFile),
            'created_at' => date('Y-m-d H:i:s')
        ];
    } catch (Exception $e) {
        error_log("Manual backup error: " . $e->getMessage());
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

/**
 * Restore database from backup
 * 
 * @param PDO $pdo Database connection
 * @param string $backupFile Backup file path
 * @return array Restore information
 */
function restoreDatabaseBackup($pdo, $backupFile) {
    if (!file_exists($backupFile)) {
        return [
            'success' => false,
            'error' => 'Backup file not found'
        ];
    }
    
    try {
        $dbName = DB_NAME;
        $dbHost = DB_HOST;
        $dbUser = DB_USER;
        $dbPass = DB_PASS;
        
        // Use mysql command if available
        $command = sprintf(
            'mysql -h %s -u %s -p%s %s < %s 2>&1',
            escapeshellarg($dbHost),
            escapeshellarg($dbUser),
            escapeshellarg($dbPass),
            escapeshellarg($dbName),
            escapeshellarg($backupFile)
        );
        
        exec($command, $output, $returnCode);
        
        if ($returnCode === 0) {
            logBackupEvent($pdo, 'backup_restored', $backupFile, null);
            
            return [
                'success' => true,
                'file' => $backupFile,
                'restored_at' => date('Y-m-d H:i:s')
            ];
        } else {
            return [
                'success' => false,
                'error' => 'Restore failed: ' . implode("\n", $output)
            ];
        }
    } catch (Exception $e) {
        error_log("Backup restore error: " . $e->getMessage());
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

/**
 * Log backup event
 * 
 * @param PDO $pdo Database connection
 * @param string $eventType Event type
 * @param string $backupFile Backup file path
 * @param int|null $fileSize File size in bytes
 */
function logBackupEvent($pdo, $eventType, $backupFile, $fileSize = null) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO backup_logs (event_type, backup_file, file_size, created_at)
            VALUES (?, ?, ?, NOW())
        ");
        $stmt->execute([$eventType, $backupFile, $fileSize]);
    } catch (PDOException $e) {
        // Table might not exist, just log to error log
        error_log("Backup log error: " . $e->getMessage());
    }
}

/**
 * Get list of available backups
 * 
 * @param string $backupDir Backup directory
 * @return array List of backups
 */
function listBackups($backupDir = null) {
    if (!$backupDir) {
        $backupDir = __DIR__ . '/../../backups';
    }
    
    if (!is_dir($backupDir)) {
        return [];
    }
    
    $backups = [];
    $files = glob($backupDir . '/backup_*.sql');
    
    foreach ($files as $file) {
        $backups[] = [
            'file' => basename($file),
            'path' => $file,
            'size' => filesize($file),
            'created_at' => date('Y-m-d H:i:s', filemtime($file))
        ];
    }
    
    // Sort by creation date, newest first
    usort($backups, function($a, $b) {
        return strtotime($b['created_at']) - strtotime($a['created_at']);
    });
    
    return $backups;
}

?>


