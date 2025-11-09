-- ========================================
-- CREATE TRANSACTION_LOG TABLE
-- ========================================
-- This table logs all transactions and important actions in the system
-- Used for audit trails and debugging

USE electronics_store;

-- Check if table already exists
SET @table_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'electronics_store' 
      AND TABLE_NAME = 'transaction_log'
);

-- Create table if it doesn't exist
SET @sql = IF(@table_exists = 0,
    'CREATE TABLE transaction_log (
        id INT PRIMARY KEY AUTO_INCREMENT,
        entity VARCHAR(50) NOT NULL,
        entity_id INT NOT NULL,
        action VARCHAR(50) NOT NULL,
        meta JSON,
        performed_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_entity (entity, entity_id),
        INDEX idx_action (action),
        INDEX idx_performed_by (performed_by),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (performed_by) REFERENCES users(user_id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'SELECT "Table transaction_log already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify the table was created
DESCRIBE transaction_log;

SELECT 'Transaction log table ready!' AS Status;

