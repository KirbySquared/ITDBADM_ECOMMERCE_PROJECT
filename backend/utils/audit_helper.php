<?php
/**
 * AUDIT HELPER UTILITY
 * 
 * Provides helper functions to set audit user ID for database triggers
 * This ensures triggers can log who performed actions
 */

/**
 * Set the audit user ID for the current database connection
 * This variable is used by triggers to log who performed actions
 * 
 * @param PDO $pdo - Database connection
 * @param int $userId - User ID performing the action
 */
function setAuditUserId($pdo, $userId) {
    if ($userId && $userId > 0) {
        $stmt = $pdo->prepare("SET @audit_user_id = ?");
        $stmt->execute([$userId]);
    } else {
        // Clear audit user ID if invalid
        $pdo->exec("SET @audit_user_id = NULL");
    }
}

/**
 * Clear the audit user ID
 * 
 * @param PDO $pdo - Database connection
 */
function clearAuditUserId($pdo) {
    $pdo->exec("SET @audit_user_id = NULL");
}

/**
 * Get the current audit user ID from the database session
 * 
 * @param PDO $pdo - Database connection
 * @return int|null - Current audit user ID or null
 */
function getAuditUserId($pdo) {
    $stmt = $pdo->query("SELECT @audit_user_id as audit_user_id");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    return $result && isset($result['audit_user_id']) ? (int)$result['audit_user_id'] : null;
}



