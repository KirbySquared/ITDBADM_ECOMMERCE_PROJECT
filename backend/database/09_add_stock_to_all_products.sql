
-- ADD STOCK TO ALL PRODUCTS

-- This script adds 10 stock units to all products in all branches
-- If inventory already exists, it will be updated to 10
-- If inventory doesn't exist, it will be created with 10 stock

USE electronics_store;


-- METHOD 1: Using INSERT ... ON DUPLICATE KEY UPDATE

-- First, ensure there's a unique constraint on (product_id, branch_id)
-- Check if unique constraint exists, if not create it
SET @dbname = DATABASE();
SET @tablename = 'product_inventory';
SET @index_name = 'unique_product_branch';

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (INDEX_NAME = @index_name)
      AND (NON_UNIQUE = 0)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE UNIQUE INDEX ', @index_name, ' ON ', @tablename, '(product_id, branch_id)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Now insert/update stock for all products in all branches
-- Using REPLACE INTO which will insert or update based on unique key
-- First, let's try with INSERT IGNORE and then UPDATE, or use a stored procedure approach

-- Method: Insert new records, then update existing ones
-- Step 1: Insert new inventory records (ignore duplicates)
INSERT IGNORE INTO product_inventory (product_id, branch_id, stock_qty)
SELECT 
    p.product_id,
    b.branch_id,
    10 AS stock_qty
FROM products p
CROSS JOIN branches b;

-- Step 2: Update all records to 10 stock
UPDATE product_inventory
SET stock_qty = 10;


-- VERIFICATION

-- Check how many inventory records were created/updated
SELECT 
    COUNT(*) AS total_inventory_records,
    COUNT(DISTINCT product_id) AS unique_products,
    COUNT(DISTINCT branch_id) AS unique_branches,
    SUM(stock_qty) AS total_stock_units,
    AVG(stock_qty) AS average_stock_per_record
FROM product_inventory;

-- Show sample of inventory records
SELECT 
    pi.product_id,
    p.product_name,
    pi.branch_id,
    b.branch_name,
    pi.stock_qty
FROM product_inventory pi
JOIN products p ON pi.product_id = p.product_id
JOIN branches b ON pi.branch_id = b.branch_id
ORDER BY pi.product_id, pi.branch_id
LIMIT 20;

-- Check if any products are missing inventory
SELECT 
    p.product_id,
    p.product_name,
    COUNT(pi.product_id) AS inventory_count
FROM products p
LEFT JOIN product_inventory pi ON p.product_id = pi.product_id
GROUP BY p.product_id, p.product_name
HAVING inventory_count = 0;

SELECT 'Stock added to all products successfully! Each product now has 10 stock in each branch.' AS Status;

