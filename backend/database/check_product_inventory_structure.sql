-- Check product_inventory table structure

USE electronics_store;

-- Show all columns in product_inventory table
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'electronics_store' 
  AND TABLE_NAME = 'product_inventory'
ORDER BY ORDINAL_POSITION;

-- Specifically check if branch_id exists
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN 'EXISTS'
        ELSE 'DOES NOT EXIST'
    END AS branch_id_status,
    COALESCE(MAX(COLUMN_TYPE), 'N/A') AS column_type
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'electronics_store' 
  AND TABLE_NAME = 'product_inventory' 
  AND COLUMN_NAME = 'branch_id';

