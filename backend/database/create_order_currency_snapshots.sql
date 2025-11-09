-- ========================================
-- CREATE ORDER_CURRENCY_SNAPSHOTS TABLE
-- ========================================
-- This table stores currency exchange rates at the time of order creation
-- This ensures accurate historical pricing even if exchange rates change later

USE electronics_store;

-- Check if table already exists
SET @table_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'electronics_store' 
      AND TABLE_NAME = 'order_currency_snapshots'
);

-- Create table if it doesn't exist
SET @sql = IF(@table_exists = 0,
    'CREATE TABLE order_currency_snapshots (
        order_id INT NOT NULL,
        currency_code VARCHAR(3) NOT NULL,
        rate_to_php DECIMAL(10, 6) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (order_id),
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
        INDEX idx_currency_code (currency_code),
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'SELECT "Table order_currency_snapshots already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify the table was created
DESCRIBE order_currency_snapshots;

SELECT 'Order currency snapshots table ready!' AS Status;

