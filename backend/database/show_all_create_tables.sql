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
-- This uses information_schema to reconstruct the CREATE TABLE statements

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_export_all_create_tables$$

CREATE PROCEDURE sp_export_all_create_tables()
BEGIN
    -- This procedure returns a result set with all CREATE TABLE statements
    -- It uses information_schema to build the statements
    
    SELECT 
        t.TABLE_NAME AS table_name,
        CONCAT(
            'CREATE TABLE `', t.TABLE_NAME, '` (\n',
            GROUP_CONCAT(
                CONCAT('  `', c.COLUMN_NAME, '` ', c.COLUMN_TYPE,
                    IF(c.IS_NULLABLE = 'NO', ' NOT NULL', ''),
                    IF(c.COLUMN_DEFAULT IS NOT NULL AND c.COLUMN_DEFAULT != '', 
                        CONCAT(' DEFAULT ', 
                            IF(c.COLUMN_DEFAULT = 'CURRENT_TIMESTAMP', 
                                'CURRENT_TIMESTAMP',
                                IF(c.DATA_TYPE IN ('varchar', 'char', 'text', 'date', 'datetime', 'timestamp'),
                                    CONCAT('''', c.COLUMN_DEFAULT, ''''),
                                    c.COLUMN_DEFAULT
                                )
                            )
                        ), 
                        ''
                    ),
                    IF(c.EXTRA != '', CONCAT(' ', c.EXTRA), '')
                )
                ORDER BY c.ORDINAL_POSITION
                SEPARATOR ',\n'
            ),
            -- Add primary key constraints
            IFNULL(
                CONCAT(',\n  PRIMARY KEY (`', 
                    GROUP_CONCAT(
                        kcu.COLUMN_NAME 
                        ORDER BY kcu.ORDINAL_POSITION 
                        SEPARATOR '`, `'
                    ),
                    '`)'
                ),
                ''
            ),
            -- Add foreign key constraints
            IFNULL(
                CONCAT(',\n  ', 
                    GROUP_CONCAT(
                        CONCAT('FOREIGN KEY (`', kcu.COLUMN_NAME, '`) ',
                               'REFERENCES `', kcu.REFERENCED_TABLE_NAME, '` (`', kcu.REFERENCED_COLUMN_NAME, '`)'
                        )
                        SEPARATOR ',\n  '
                    )
                ),
                ''
            ),
            '\n) ENGINE=', IFNULL(t.ENGINE, 'InnoDB'),
            ' DEFAULT CHARSET=', IFNULL(t.TABLE_COLLATION, 'utf8mb4'),
            IF(t.TABLE_COMMENT != '', CONCAT(' COMMENT=''', t.TABLE_COMMENT, ''''), ''),
            ';'
        ) AS create_statement
    FROM information_schema.TABLES t
    INNER JOIN information_schema.COLUMNS c
        ON t.TABLE_SCHEMA = c.TABLE_SCHEMA 
        AND t.TABLE_NAME = c.TABLE_NAME
    LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu
        ON t.TABLE_SCHEMA = kcu.TABLE_SCHEMA
        AND t.TABLE_NAME = kcu.TABLE_NAME
        AND kcu.CONSTRAINT_NAME = 'PRIMARY'
    LEFT JOIN information_schema.KEY_COLUMN_USAGE fk
        ON t.TABLE_SCHEMA = fk.TABLE_SCHEMA
        AND t.TABLE_NAME = fk.TABLE_NAME
        AND fk.REFERENCED_TABLE_NAME IS NOT NULL
    WHERE t.TABLE_SCHEMA = DATABASE()
      AND t.TABLE_TYPE = 'BASE TABLE'
    GROUP BY t.TABLE_NAME, t.ENGINE, t.TABLE_COLLATION, t.TABLE_COMMENT
    ORDER BY t.TABLE_NAME;
    
END$$

DELIMITER ;

-- Usage:
-- CALL sp_get_all_create_tables();      -- Returns table names and SQL commands to run
-- CALL sp_export_all_create_tables();   -- Returns actual CREATE TABLE statements (reconstructed)

-- Alternative: Use mysqldump command line tool
-- mysqldump -u username -p --no-data electronics_store > schema_export.sql

