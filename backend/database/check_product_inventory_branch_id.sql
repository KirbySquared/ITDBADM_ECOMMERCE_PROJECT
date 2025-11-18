-- Check if product_inventory.branch_id matches branches.branch_id type

USE electronics_store;

-- Check branches.branch_id type
SELECT 
    'branches.branch_id' AS column_name,
    COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'electronics_store' 
  AND TABLE_NAME = 'branches' 
  AND COLUMN_NAME = 'branch_id';

-- Check product_inventory.branch_id type (if table exists)
SELECT 
    'product_inventory.branch_id' AS column_name,
    COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'electronics_store' 
  AND TABLE_NAME = 'product_inventory' 
  AND COLUMN_NAME = 'branch_id';

-- Check if product_inventory table exists
SELECT 
    TABLE_NAME,
    TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'electronics_store' 
  AND TABLE_NAME = 'product_inventory';

