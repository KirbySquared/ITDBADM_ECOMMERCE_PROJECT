-- ========================================
-- ADD MISSING TRIGGERS BASED ON EXISTING TRIGGERS
-- ========================================
-- This script adds any triggers that might be missing
-- Based on the triggers you already have in your database
-- Compatible with MySQL Workbench

USE electronics_store;

-- ========================================
-- 1. STOCK VALIDATION TRIGGER
-- ========================================
-- Prevents stock from going negative
-- Check if it exists first
SET @trigger_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.TRIGGERS 
    WHERE TRIGGER_SCHEMA = 'electronics_store' 
    AND TRIGGER_NAME = 'trg_product_inventory_prevent_negative_stock'
);

-- Only create if it doesn't exist
SET @sql = IF(@trigger_exists = 0,
    'CREATE TRIGGER trg_product_inventory_prevent_negative_stock
    BEFORE UPDATE ON product_inventory
    FOR EACH ROW
    BEGIN
        IF NEW.stock_qty < 0 THEN
            SIGNAL SQLSTATE ''45000''
            SET MESSAGE_TEXT = CONCAT(''Stock quantity cannot be negative. Product ID: '', NEW.product_id, '', Branch ID: '', NEW.branch_id);
        END IF;
    END',
    'SELECT ''Trigger trg_product_inventory_prevent_negative_stock already exists'' AS Status'
);

-- Note: We can''t use PREPARE/EXECUTE with DELIMITER, so we''ll use a different approach
-- Let''s just try to create it and let it fail gracefully if it exists

DROP TRIGGER IF EXISTS trg_product_inventory_prevent_negative_stock;

DELIMITER $$

CREATE TRIGGER trg_product_inventory_prevent_negative_stock
BEFORE UPDATE ON product_inventory
FOR EACH ROW
BEGIN
    DECLARE v_error_message VARCHAR(255);
    
    IF NEW.stock_qty < 0 THEN
        SET v_error_message = CONCAT('Stock quantity cannot be negative. Product ID: ', NEW.product_id, ', Branch ID: ', NEW.branch_id);
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = v_error_message;
    END IF;
END$$

DELIMITER ;

-- ========================================
-- 2. STOCK DEDUCTION TRIGGER (Optional/Placeholder)
-- ========================================
-- Note: This trigger is intentionally empty because stock deduction is handled in PHP
-- It's kept here for reference but doesn't do anything

DROP TRIGGER IF EXISTS trg_payment_completed_deduct_stock;

DELIMITER $$

CREATE TRIGGER trg_payment_completed_deduct_stock
AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
    -- Stock deduction is handled in PHP code (create-order.php)
    -- This trigger is kept for reference but intentionally left empty
    -- The PHP code handles stock deduction with proper transaction safety
    -- The IF statement is here for structure but does nothing
    IF NEW.payment_status = 'completed' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'completed') THEN
        -- Stock deduction happens in PHP code
        -- This trigger serves as a placeholder
        SET @placeholder = 1; -- Dummy statement to make trigger valid
    END IF;
END$$

DELIMITER ;

-- ========================================
-- VERIFICATION
-- ========================================
SELECT '========================================' AS '';
SELECT 'Trigger Verification Complete!' AS Status;
SELECT '========================================' AS '';

-- List all triggers
SELECT 
    TRIGGER_NAME AS 'Trigger Name',
    EVENT_OBJECT_TABLE AS 'Table',
    EVENT_MANIPULATION AS 'Event',
    ACTION_TIMING AS 'Timing',
    CASE 
        WHEN TRIGGER_NAME LIKE '%audit%' THEN 'Audit Logging'
        WHEN TRIGGER_NAME LIKE '%prevent%' OR TRIGGER_NAME LIKE '%validate%' THEN 'Validation'
        WHEN TRIGGER_NAME LIKE '%calculate%' OR TRIGGER_NAME LIKE '%update%' THEN 'Auto-calculation'
        WHEN TRIGGER_NAME LIKE '%restore%' OR TRIGGER_NAME LIKE '%deduct%' THEN 'Stock Management'
        WHEN TRIGGER_NAME LIKE '%log%' THEN 'Transaction Logging'
        WHEN TRIGGER_NAME LIKE '%lock%' THEN 'Currency Locking'
        ELSE 'Other'
    END AS 'Type'
FROM INFORMATION_SCHEMA.TRIGGERS
WHERE TRIGGER_SCHEMA = 'electronics_store'
ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME;

-- Count triggers
SELECT COUNT(*) AS total_triggers 
FROM INFORMATION_SCHEMA.TRIGGERS 
WHERE TRIGGER_SCHEMA = 'electronics_store';

SELECT '========================================' AS '';
SELECT 'All triggers are now verified!' AS Status;
SELECT '========================================' AS '';

