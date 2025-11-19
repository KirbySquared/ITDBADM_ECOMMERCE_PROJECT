<?php
/**
 * STORED PROCEDURE HELPER UTILITY
 * 
 * Provides helper functions to call stored procedures from PHP code
 * This ensures consistent error handling and result processing
 */

/**
 * Call a stored procedure and return results
 * 
 * @param PDO $pdo - Database connection
 * @param string $procedureName - Name of the stored procedure (e.g., 'sp_get_top_selling_products')
 * @param array $params - Array of parameters to pass to the procedure
 * @return array - Array of result rows
 */
function callStoredProcedure($pdo, $procedureName, $params = []) {
    try {
        // Build the CALL statement
        $placeholders = str_repeat('?,', count($params));
        $placeholders = rtrim($placeholders, ',');
        
        $sql = "CALL $procedureName($placeholders)";
        $stmt = $pdo->prepare($sql);
        
        // Execute with parameters
        $stmt->execute($params);
        
        // Fetch all results
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Close cursor (required for stored procedures in MySQL)
        $stmt->closeCursor();
        
        return $results;
    } catch (PDOException $e) {
        error_log("Stored procedure error ($procedureName): " . $e->getMessage());
        throw $e;
    }
}

/**
 * Call a stored procedure that returns a single result
 * 
 * @param PDO $pdo - Database connection
 * @param string $procedureName - Name of the stored procedure
 * @param array $params - Array of parameters to pass to the procedure
 * @return array|null - Single result row or null
 */
function callStoredProcedureSingle($pdo, $procedureName, $params = []) {
    $results = callStoredProcedure($pdo, $procedureName, $params);
    return !empty($results) ? $results[0] : null;
}

/**
 * Call a stored procedure that returns a message/status
 * 
 * @param PDO $pdo - Database connection
 * @param string $procedureName - Name of the stored procedure
 * @param array $params - Array of parameters to pass to the procedure
 * @return string|null - Message from procedure or null
 */
function callStoredProcedureMessage($pdo, $procedureName, $params = []) {
    $results = callStoredProcedure($pdo, $procedureName, $params);
    if (!empty($results) && isset($results[0]['message'])) {
        return $results[0]['message'];
    }
    return null;
}


