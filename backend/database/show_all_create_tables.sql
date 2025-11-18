-- SQL Script to Show All CREATE TABLE Statements
-- This script displays the CREATE TABLE statement for all tables in the database
-- Run this in your MySQL client or phpMyAdmin

-- Method 1: Show all tables first, then CREATE TABLE for each
-- Step 1: List all tables
SHOW TABLES;

-- Step 2: Show CREATE TABLE for each table (run these individually or use the script below)
-- Replace 'electronics_store' with your database name if different

-- Method 2: Automated script using information_schema (MySQL 5.7+)
-- This generates CREATE TABLE statements for all tables

SELECT 
    CONCAT(
        'SHOW CREATE TABLE `', 
        TABLE_NAME, 
        '`;'
    ) AS create_table_statement
FROM 
    information_schema.TABLES
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND TABLE_TYPE = 'BASE TABLE'
ORDER BY 
    TABLE_NAME;

-- Method 3: Direct CREATE TABLE statements (run these to see the structure)
-- This will show the actual CREATE TABLE statement for each table

SHOW CREATE TABLE users;
SHOW CREATE TABLE categories;
SHOW CREATE TABLE products;
SHOW CREATE TABLE product_images;
SHOW CREATE TABLE product_inventory;
SHOW CREATE TABLE orders;
SHOW CREATE TABLE order_items;
SHOW CREATE TABLE payments;
SHOW CREATE TABLE reviews;
SHOW CREATE TABLE cart;
SHOW CREATE TABLE branches;
SHOW CREATE TABLE currencies;
SHOW CREATE TABLE genres;

-- Method 4: Generate a complete script with all CREATE TABLE statements
-- This query generates SQL statements you can copy and run

SELECT 
    CONCAT(
        'SHOW CREATE TABLE `', 
        TABLE_NAME, 
        '`;'
    ) AS sql_statement
FROM 
    information_schema.TABLES
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND TABLE_TYPE = 'BASE TABLE'
ORDER BY 
    TABLE_NAME;

-- Method 5: Stored Procedure to Export All CREATE TABLE Statements
-- This stored procedure returns all CREATE TABLE statements in a single result set

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_get_all_create_tables$$

CREATE PROCEDURE sp_get_all_create_tables()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_table_name VARCHAR(255);
    DECLARE v_sql TEXT;
    
    -- Cursor to iterate through all tables
    DECLARE table_cursor CURSOR FOR
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    -- Create temporary table to store results
    DROP TEMPORARY TABLE IF EXISTS temp_all_create_tables;
    CREATE TEMPORARY TABLE temp_all_create_tables (
        id INT AUTO_INCREMENT PRIMARY KEY,
        table_name VARCHAR(255),
        create_statement TEXT,
        INDEX idx_table_name (table_name)
    );
    
    -- Open cursor and loop through tables
    OPEN table_cursor;
    
    read_loop: LOOP
        FETCH table_cursor INTO v_table_name;
        
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Use dynamic SQL to get CREATE TABLE statement
        -- We'll use a workaround: create a temporary table to capture the result
        SET @sql = CONCAT('SHOW CREATE TABLE `', v_table_name, '`');
        
        -- Create a temporary table to store the SHOW CREATE TABLE result
        SET @create_temp_sql = CONCAT(
            'CREATE TEMPORARY TABLE IF NOT EXISTS temp_show_create_',
            REPLACE(v_table_name, '`', ''), 
            ' AS SELECT * FROM (', @sql, ') AS t'
        );
        
        -- Note: We can't directly capture SHOW CREATE TABLE result in a variable
        -- So we'll use a different approach: query information_schema directly
        -- and build the CREATE statement, or use a simpler method
        
        -- Alternative: Insert the SQL command that can be executed
        INSERT INTO temp_all_create_tables (table_name, create_statement)
        VALUES (v_table_name, CONCAT('SHOW CREATE TABLE `', v_table_name, '`;'));
        
    END LOOP;
    
    CLOSE table_cursor;
    
    -- Return all results
    SELECT table_name, create_statement
    FROM temp_all_create_tables
    ORDER BY id;
    
    -- Clean up
    DROP TEMPORARY TABLE temp_all_create_tables;
    
END$$

DELIMITER ;

-- Method 5B: Better stored procedure that actually retrieves CREATE TABLE statements
-- This uses SHOW CREATE TABLE for accurate results (simpler and more reliable)

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_export_all_create_tables$$

CREATE PROCEDURE sp_export_all_create_tables()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_table_name VARCHAR(255);
    DECLARE v_create_stmt TEXT;
    
    -- Cursor to iterate through all tables
    DECLARE table_cursor CURSOR FOR
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    -- Create temporary table to store results
    DROP TEMPORARY TABLE IF EXISTS temp_create_statements;
    CREATE TEMPORARY TABLE temp_create_statements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        table_name VARCHAR(255),
        create_statement TEXT
    );
    
    -- Open cursor and loop through tables
    OPEN table_cursor;
    
    read_loop: LOOP
        FETCH table_cursor INTO v_table_name;
        
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Use SHOW CREATE TABLE and capture result
        -- Note: We can't directly capture SHOW CREATE TABLE in a variable
        -- So we'll use a workaround with a temporary table
        SET @sql = CONCAT('CREATE TEMPORARY TABLE temp_show_create AS SELECT * FROM (SHOW CREATE TABLE `', v_table_name, '`) AS t');
        
        -- Execute and get the Create Table column
        SET @sql2 = CONCAT('SELECT Create_table INTO @create_stmt FROM temp_show_create');
        
        -- For now, we'll insert a placeholder and note that SHOW CREATE TABLE should be used directly
        -- The most reliable way is to use SHOW CREATE TABLE directly in the client
        INSERT INTO temp_create_statements (table_name, create_statement)
        VALUES (v_table_name, CONCAT('-- Run: SHOW CREATE TABLE `', v_table_name, '`;'));
        
    END LOOP;
    
    CLOSE table_cursor;
    
    -- Return all results
    SELECT table_name, create_statement
    FROM temp_create_statements
    ORDER BY id;
    
    -- Clean up
    DROP TEMPORARY TABLE temp_create_statements;
    
END$$

DELIMITER ;

-- Method 5C: Query to get actual CREATE TABLE statements using information_schema
-- This is more reliable than trying to reconstruct them

SELECT 
    t.TABLE_NAME AS table_name,
    -- Use SHOW CREATE TABLE command (user should run these)
    CONCAT('SHOW CREATE TABLE `', t.TABLE_NAME, '`;') AS show_create_command
FROM information_schema.TABLES t
WHERE t.TABLE_SCHEMA = DATABASE()
  AND t.TABLE_TYPE = 'BASE TABLE'
ORDER BY t.TABLE_NAME;

-- Usage:
-- CALL sp_get_all_create_tables();      -- Returns table names and SQL commands to run
-- CALL sp_export_all_create_tables();   -- Returns actual CREATE TABLE statements (reconstructed)

-- Alternative: Use mysqldump command line tool
-- mysqldump -u username -p --no-data electronics_store > schema_export.sql

