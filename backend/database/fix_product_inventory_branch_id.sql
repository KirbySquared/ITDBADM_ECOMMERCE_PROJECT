-- Fix product_inventory.branch_id to match branches.branch_id (INT UNSIGNED)

USE electronics_store;

-- Show current types
SELECT 
    'branches.branch_id' AS column_name,
    COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'electronics_store' 
  AND TABLE_NAME = 'branches' 
  AND COLUMN_NAME = 'branch_id'

UNION ALL

SELECT 
    'product_inventory.branch_id' AS column_name,
    COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'electronics_store' 
  AND TABLE_NAME = 'product_inventory' 
  AND COLUMN_NAME = 'branch_id';

-- Get branches.branch_id type
SET @branch_type = (
    SELECT COLUMN_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'electronics_store' 
      AND TABLE_NAME = 'branches' 
      AND COLUMN_NAME = 'branch_id'
);

-- Get product_inventory.branch_id type
SET @inv_branch_type = (
    SELECT COLUMN_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'electronics_store' 
      AND TABLE_NAME = 'product_inventory' 
      AND COLUMN_NAME = 'branch_id'
);

-- Check if types match
SET @types_match = (@branch_type = @inv_branch_type);

-- If types don't match, modify product_inventory.branch_id
SET @sql = IF(@types_match = 0 AND @branch_type IS NOT NULL AND @inv_branch_type IS NOT NULL,
    CONCAT('ALTER TABLE product_inventory MODIFY COLUMN branch_id ', @branch_type, ' NOT NULL'),
    'SELECT "Column types already match or columns not found" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify they match now
SELECT 
    'VERIFICATION' AS check_type,
    (SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'electronics_store' AND TABLE_NAME = 'branches' AND COLUMN_NAME = 'branch_id') AS branches_type,
    (SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'electronics_store' AND TABLE_NAME = 'product_inventory' AND COLUMN_NAME = 'branch_id') AS product_inventory_type,
    CASE 
        WHEN (SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'electronics_store' AND TABLE_NAME = 'branches' AND COLUMN_NAME = 'branch_id') = 
             (SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'electronics_store' AND TABLE_NAME = 'product_inventory' AND COLUMN_NAME = 'branch_id')
        THEN 'MATCH - Types are compatible!'
        ELSE 'MISMATCH - Check types above'
    END AS status;

SELECT 'Product inventory branch_id type check completed!' AS Status;

