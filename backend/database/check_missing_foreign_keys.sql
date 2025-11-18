-- ========================================
-- CHECK FOR MISSING FOREIGN KEYS
-- ========================================
-- This script identifies foreign keys that should exist but are missing
-- Based on the database schema design

USE electronics_store;

-- Expected Foreign Keys (based on schema design)
-- This query shows what foreign keys SHOULD exist vs what DOES exist

SELECT 
    'EXPECTED FOREIGN KEYS' AS check_type,
    t.TABLE_NAME AS table_name,
    kcu.COLUMN_NAME AS column_name,
    kcu.REFERENCED_TABLE_NAME AS referenced_table,
    kcu.REFERENCED_COLUMN_NAME AS referenced_column,
    CASE 
        WHEN kcu.CONSTRAINT_NAME IS NOT NULL THEN 'EXISTS ✓'
        ELSE 'MISSING ✗'
    END AS status
FROM information_schema.TABLES t
LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON t.TABLE_SCHEMA = kcu.TABLE_SCHEMA
    AND t.TABLE_NAME = kcu.TABLE_NAME
    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
WHERE t.TABLE_SCHEMA = DATABASE()
  AND t.TABLE_TYPE = 'BASE TABLE'
  AND (
    -- Expected foreign keys based on schema
    (t.TABLE_NAME = 'products' AND kcu.COLUMN_NAME = 'category_id' AND kcu.REFERENCED_TABLE_NAME = 'categories')
    OR (t.TABLE_NAME = 'products' AND kcu.COLUMN_NAME = 'genre_id' AND kcu.REFERENCED_TABLE_NAME = 'genres')
    OR (t.TABLE_NAME = 'product_images' AND kcu.COLUMN_NAME = 'product_id' AND kcu.REFERENCED_TABLE_NAME = 'products')
    OR (t.TABLE_NAME = 'product_inventory' AND kcu.COLUMN_NAME = 'branch_id' AND kcu.REFERENCED_TABLE_NAME = 'branches')
    OR (t.TABLE_NAME = 'product_inventory' AND kcu.COLUMN_NAME = 'product_id' AND kcu.REFERENCED_TABLE_NAME = 'products')
    OR (t.TABLE_NAME = 'orders' AND kcu.COLUMN_NAME = 'user_id' AND kcu.REFERENCED_TABLE_NAME = 'users')
    OR (t.TABLE_NAME = 'orders' AND kcu.COLUMN_NAME = 'branch_id' AND kcu.REFERENCED_TABLE_NAME = 'branches')
    OR (t.TABLE_NAME = 'order_items' AND kcu.COLUMN_NAME = 'order_id' AND kcu.REFERENCED_TABLE_NAME = 'orders')
    OR (t.TABLE_NAME = 'order_items' AND kcu.COLUMN_NAME = 'product_id' AND kcu.REFERENCED_TABLE_NAME = 'products')
    OR (t.TABLE_NAME = 'payments' AND kcu.COLUMN_NAME = 'order_id' AND kcu.REFERENCED_TABLE_NAME = 'orders')
    OR (t.TABLE_NAME = 'reviews' AND kcu.COLUMN_NAME = 'user_id' AND kcu.REFERENCED_TABLE_NAME = 'users')
    OR (t.TABLE_NAME = 'reviews' AND kcu.COLUMN_NAME = 'product_id' AND kcu.REFERENCED_TABLE_NAME = 'products')
    OR (t.TABLE_NAME = 'cart' AND kcu.COLUMN_NAME = 'user_id' AND kcu.REFERENCED_TABLE_NAME = 'users')
    OR (t.TABLE_NAME = 'cart' AND kcu.COLUMN_NAME = 'product_id' AND kcu.REFERENCED_TABLE_NAME = 'products')
    OR (t.TABLE_NAME = 'users' AND kcu.COLUMN_NAME = 'branch_id' AND kcu.REFERENCED_TABLE_NAME = 'branches')
    OR (t.TABLE_NAME = 'order_currency_snapshots' AND kcu.COLUMN_NAME = 'order_id' AND kcu.REFERENCED_TABLE_NAME = 'orders')
    OR (t.TABLE_NAME = 'transaction_log' AND kcu.COLUMN_NAME = 'performed_by' AND kcu.REFERENCED_TABLE_NAME = 'users')
  )
ORDER BY t.TABLE_NAME, kcu.COLUMN_NAME;

-- Alternative: Show ALL existing foreign keys
SELECT 
    'EXISTING FOREIGN KEYS' AS check_type,
    kcu.TABLE_NAME AS table_name,
    kcu.COLUMN_NAME AS column_name,
    kcu.REFERENCED_TABLE_NAME AS referenced_table,
    kcu.REFERENCED_COLUMN_NAME AS referenced_column,
    kcu.CONSTRAINT_NAME AS constraint_name,
    rc.UPDATE_RULE AS update_rule,
    rc.DELETE_RULE AS delete_rule
FROM information_schema.KEY_COLUMN_USAGE kcu
INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
    ON kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
    AND kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
WHERE kcu.TABLE_SCHEMA = DATABASE()
  AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME;

-- Check for missing foreign keys by comparing expected vs actual
SELECT 
    'MISSING FOREIGN KEYS' AS check_type,
    expected.table_name,
    expected.column_name,
    expected.referenced_table,
    expected.referenced_column,
    CONCAT(
        'ALTER TABLE `', expected.table_name, 
        '` ADD CONSTRAINT fk_', expected.table_name, '_', expected.column_name,
        ' FOREIGN KEY (`', expected.column_name, 
        '`) REFERENCES `', expected.referenced_table, 
        '`(`', expected.referenced_column, '`)',
        CASE 
            WHEN expected.table_name IN ('users', 'orders') AND expected.column_name = 'branch_id' THEN ' ON DELETE SET NULL ON UPDATE CASCADE'
            WHEN expected.table_name = 'transaction_log' AND expected.column_name = 'performed_by' THEN ' ON DELETE SET NULL'
            ELSE ' ON DELETE CASCADE'
        END,
        ';'
    ) AS sql_to_add
FROM (
    -- Expected foreign keys
    SELECT 'products' AS table_name, 'category_id' AS column_name, 'categories' AS referenced_table, 'category_id' AS referenced_column
    UNION ALL SELECT 'products', 'genre_id', 'genres', 'genre_id'
    UNION ALL SELECT 'product_images', 'product_id', 'products', 'product_id'
    UNION ALL SELECT 'product_inventory', 'branch_id', 'branches', 'branch_id'
    UNION ALL SELECT 'product_inventory', 'product_id', 'products', 'product_id'
    UNION ALL SELECT 'orders', 'user_id', 'users', 'user_id'
    UNION ALL SELECT 'orders', 'branch_id', 'branches', 'branch_id'
    UNION ALL SELECT 'order_items', 'order_id', 'orders', 'order_id'
    UNION ALL SELECT 'order_items', 'product_id', 'products', 'product_id'
    UNION ALL SELECT 'payments', 'order_id', 'orders', 'order_id'
    UNION ALL SELECT 'reviews', 'user_id', 'users', 'user_id'
    UNION ALL SELECT 'reviews', 'product_id', 'products', 'product_id'
    UNION ALL SELECT 'cart', 'user_id', 'users', 'user_id'
    UNION ALL SELECT 'cart', 'product_id', 'products', 'product_id'
    UNION ALL SELECT 'users', 'branch_id', 'branches', 'branch_id'
    UNION ALL SELECT 'order_currency_snapshots', 'order_id', 'orders', 'order_id'
    UNION ALL SELECT 'transaction_log', 'performed_by', 'users', 'user_id'
) AS expected
LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu
    ON kcu.TABLE_SCHEMA = DATABASE()
    AND kcu.TABLE_NAME = expected.table_name
    AND kcu.COLUMN_NAME = expected.column_name
    AND kcu.REFERENCED_TABLE_NAME = expected.referenced_table
    AND kcu.REFERENCED_COLUMN_NAME = expected.referenced_column
WHERE kcu.CONSTRAINT_NAME IS NULL
ORDER BY expected.table_name, expected.column_name;

