-- Add branch_id column to orders table
-- This allows orders to be tracked by branch for staff panel filtering

USE electronics_store;

-- Check if branch_id column already exists before adding
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'electronics_store' 
      AND TABLE_NAME = 'orders' 
      AND COLUMN_NAME = 'branch_id'
);

-- Get the data type of branch_id from branches table
SET @branch_id_type = (
    SELECT DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'electronics_store' 
      AND TABLE_NAME = 'branches' 
      AND COLUMN_NAME = 'branch_id'
);

-- Add branch_id column to orders table (if it doesn't exist) - use same type as branches table
SET @sql = IF(@col_exists = 0,
    CONCAT('ALTER TABLE orders ADD COLUMN branch_id ', COALESCE(@branch_id_type, 'INT'), ' NULL AFTER shipping_address'),
    'SELECT "Column branch_id already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if foreign key already exists before adding
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = 'electronics_store' 
      AND TABLE_NAME = 'orders' 
      AND CONSTRAINT_NAME = 'fk_order_branch'
);

-- Add foreign key constraint (if it doesn't exist)
SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE orders ADD CONSTRAINT fk_order_branch FOREIGN KEY (branch_id) REFERENCES branches(branch_id) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT "Foreign key fk_order_branch already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if index already exists before adding
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = 'electronics_store' 
      AND TABLE_NAME = 'orders' 
      AND INDEX_NAME = 'idx_orders_branch_id'
);

-- Add index for better query performance (if it doesn't exist)
SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX idx_orders_branch_id ON orders(branch_id)',
    'SELECT "Index idx_orders_branch_id already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify the column was added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'electronics_store' 
  AND TABLE_NAME = 'orders' 
  AND COLUMN_NAME = 'branch_id';

SELECT 'Branch support successfully added to orders table!' AS Status;

