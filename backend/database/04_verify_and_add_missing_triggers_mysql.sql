-- ========================================
-- VERIFY AND ADD MISSING TRIGGERS
-- ========================================
-- This script verifies if additional triggers exist and creates them if missing
-- Run this AFTER running 01_create_missing_triggers_mysql.sql
-- Compatible with MySQL Workbench

USE electronics_store;

-- ========================================
-- 1. STOCK VALIDATION TRIGGER
-- ========================================
-- Prevents stock from going negative
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
-- 2. PRODUCT AUDIT TRIGGERS
-- ========================================
-- These triggers log product operations to audit_logs table
-- Note: Requires audit_logs table to exist

-- Check if audit_logs table exists
SET @audit_table_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'electronics_store' 
    AND TABLE_NAME = 'audit_logs'
);

-- Only create audit triggers if audit_logs table exists
SET @create_audit_triggers = IF(@audit_table_exists > 0, 1, 0);

-- 2.1. Product Create Audit
DROP TRIGGER IF EXISTS trg_products_create_audit;

DELIMITER $$

CREATE TRIGGER trg_products_create_audit
AFTER INSERT ON products
FOR EACH ROW
BEGIN
    IF @create_audit_triggers = 1 THEN
        INSERT INTO `audit_logs` (user_id, category, description)
        VALUES (
            @audit_user_id,
            'product',
            CONCAT('New product: ', COALESCE(NEW.product_name,'(no name)'), ' (ID=', NEW.product_id, ')')
        );
    END IF;
END$$

-- 2.2. Product Update Audit
DROP TRIGGER IF EXISTS trg_products_update_audit;

CREATE TRIGGER trg_products_update_audit
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
    IF @create_audit_triggers = 1 THEN
        DECLARE changed_fields TEXT DEFAULT '';

        -- Build a comma-separated list of changed fields
        IF NOT (OLD.category_id    <=> NEW.category_id)    THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'category_id');    END IF;
        IF NOT (OLD.product_name   <=> NEW.product_name)   THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'product_name');   END IF;
        IF NOT (OLD.brand          <=> NEW.brand)          THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'brand');          END IF;
        IF NOT (OLD.model          <=> NEW.model)          THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'model');          END IF;
        IF NOT (OLD.description    <=> NEW.description)    THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'description');    END IF;
        IF NOT (OLD.price          <=> NEW.price)          THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'price');          END IF;
        IF NOT (OLD.specifications <=> NEW.specifications) THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'specifications'); END IF;

        -- Only log when at least one field actually changed
        IF changed_fields <> '' THEN
            INSERT INTO `audit_logs` (user_id, category, description)
            VALUES (
                @audit_user_id, 
                'product',
                CONCAT('Product updated: ', COALESCE(NEW.product_name,'(no name)'),
                       ' (ID=', NEW.product_id, '); fields: ', changed_fields)
            );
        END IF;
    END IF;
END$$

-- 2.3. Product Delete Audit
DROP TRIGGER IF EXISTS trg_products_delete_audit;

CREATE TRIGGER trg_products_delete_audit
AFTER DELETE ON products
FOR EACH ROW
BEGIN
    IF @create_audit_triggers = 1 THEN
        INSERT INTO `audit_logs` (user_id, category, description)
        VALUES (
            @audit_user_id,
            'product',
            CONCAT('Product deleted: ', COALESCE(OLD.product_name,'(no name)'), ' (ID=', OLD.product_id, ')')
        );
    END IF;
END$$

DELIMITER ;

-- ========================================
-- 3. PRODUCT INVENTORY AUDIT TRIGGERS
-- ========================================
-- These triggers log inventory operations to audit_logs table

-- 3.1. Inventory Insert Audit
DROP TRIGGER IF EXISTS trg_product_inventory_insert_audit;

DELIMITER $$

CREATE TRIGGER trg_product_inventory_insert_audit
AFTER INSERT ON product_inventory
FOR EACH ROW
BEGIN
    IF @create_audit_triggers = 1 THEN
        DECLARE product_name_val VARCHAR(200);
        
        -- Get product name
        SELECT product_name INTO product_name_val
        FROM products
        WHERE product_id = NEW.product_id;
        
        INSERT INTO `audit_logs` (user_id, category, description)
        VALUES (
            @audit_user_id,
            'product',
            CONCAT('Inventory added: Product "', COALESCE(product_name_val, '(unknown)'), 
                   '" (ID=', NEW.product_id, ') - Branch ID: ', NEW.branch_id, 
                   ', Stock Qty: ', NEW.stock_qty)
        );
    END IF;
END$$

-- 3.2. Inventory Update Audit
DROP TRIGGER IF EXISTS trg_product_inventory_update_audit;

CREATE TRIGGER trg_product_inventory_update_audit
AFTER UPDATE ON product_inventory
FOR EACH ROW
BEGIN
    IF @create_audit_triggers = 1 THEN
        DECLARE product_name_val VARCHAR(200);
        DECLARE change_desc TEXT DEFAULT '';
        
        -- Get product name
        SELECT product_name INTO product_name_val
        FROM products
        WHERE product_id = NEW.product_id;
        
        -- Check what changed
        IF OLD.stock_qty != NEW.stock_qty THEN
            SET change_desc = CONCAT('Stock: ', OLD.stock_qty, ' -> ', NEW.stock_qty);
        END IF;
        
        IF OLD.branch_id != NEW.branch_id THEN
            IF change_desc <> '' THEN
                SET change_desc = CONCAT(change_desc, ', ');
            END IF;
            SET change_desc = CONCAT(change_desc, 'Branch: ', OLD.branch_id, ' -> ', NEW.branch_id);
        END IF;
        
        -- Only log if something actually changed
        IF change_desc <> '' THEN
            INSERT INTO `audit_logs` (user_id, category, description)
            VALUES (
                @audit_user_id,
                'product',
                CONCAT('Inventory updated: Product "', COALESCE(product_name_val, '(unknown)'), 
                       '" (ID=', NEW.product_id, ') - ', change_desc)
            );
        END IF;
    END IF;
END$$

-- 3.3. Inventory Delete Audit
DROP TRIGGER IF EXISTS trg_product_inventory_delete_audit;

CREATE TRIGGER trg_product_inventory_delete_audit
AFTER DELETE ON product_inventory
FOR EACH ROW
BEGIN
    IF @create_audit_triggers = 1 THEN
        DECLARE product_name_val VARCHAR(200);
        
        -- Get product name
        SELECT product_name INTO product_name_val
        FROM products
        WHERE product_id = OLD.product_id;
        
        INSERT INTO `audit_logs` (user_id, category, description)
        VALUES (
            @audit_user_id,
            'product',
            CONCAT('Inventory removed: Product "', COALESCE(product_name_val, '(unknown)'), 
                   '" (ID=', OLD.product_id, ') - Branch ID: ', OLD.branch_id, 
                   ', Stock Qty: ', OLD.stock_qty)
        );
    END IF;
END$$

DELIMITER ;

-- ========================================
-- 4. USER REGISTRATION AUDIT TRIGGER
-- ========================================
-- Logs user registration to audit_logs table

DROP TRIGGER IF EXISTS trg_users_registration_audit;

DELIMITER $$

CREATE TRIGGER trg_users_registration_audit
AFTER INSERT ON users
FOR EACH ROW
BEGIN
    IF @create_audit_triggers = 1 THEN
        INSERT INTO `audit_logs` (user_id, category, description)
        VALUES (NEW.user_id, 'user', CONCAT('New User: ', NEW.username));
    END IF;
END$$

DELIMITER ;

-- ========================================
-- 5. STOCK DEDUCTION TRIGGER (Optional)
-- ========================================
-- Note: This trigger has an empty body because stock deduction is handled in PHP
-- It's kept here for reference but doesn't do anything
-- Stock deduction happens in create-order.php when payment_status = 'completed'

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
-- VERIFY ALL TRIGGERS
-- ========================================
SELECT 'All additional triggers created/verified!' AS Status;

-- List all triggers
SELECT 
    TRIGGER_NAME,
    EVENT_MANIPULATION,
    EVENT_OBJECT_TABLE,
    ACTION_TIMING
FROM INFORMATION_SCHEMA.TRIGGERS
WHERE TRIGGER_SCHEMA = 'electronics_store'
ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME;

-- Count triggers
SELECT COUNT(*) AS total_triggers 
FROM INFORMATION_SCHEMA.TRIGGERS 
WHERE TRIGGER_SCHEMA = 'electronics_store';

