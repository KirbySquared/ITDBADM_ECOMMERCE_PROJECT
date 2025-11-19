-- ========================================
-- COMPLETE SQL QUERIES FOR ALL TRIGGERS AND STORED PROCEDURES
-- ========================================
-- This file contains all CREATE TRIGGER and CREATE PROCEDURE statements
-- for the electronics_store database
-- 
-- Total: 28 Triggers + 18 Stored Procedures = 46 Database Objects
-- 
-- Run this script in MySQL Workbench or your MySQL client
-- ========================================

USE electronics_store;

-- ========================================
-- PART 1: TRIGGERS (28 Total)
-- ========================================

-- ========================================
-- ORDER ITEMS TRIGGERS (5)
-- ========================================

-- 1. Auto-calculate subtotal on INSERT
DROP TRIGGER IF EXISTS trg_order_items_calculate_subtotal;

DELIMITER $$

CREATE TRIGGER trg_order_items_calculate_subtotal
BEFORE INSERT ON order_items
FOR EACH ROW
BEGIN
    IF NEW.subtotal IS NULL OR NEW.subtotal = 0 THEN
        SET NEW.subtotal = NEW.quantity * NEW.unit_price;
    END IF;
END$$

-- 2. Auto-calculate subtotal on UPDATE
DROP TRIGGER IF EXISTS trg_order_items_update_subtotal;

CREATE TRIGGER trg_order_items_update_subtotal
BEFORE UPDATE ON order_items
FOR EACH ROW
BEGIN
    IF OLD.quantity != NEW.quantity OR OLD.unit_price != NEW.unit_price THEN
        SET NEW.subtotal = NEW.quantity * NEW.unit_price;
    END IF;
END$$

-- 3. Update order total on INSERT
DROP TRIGGER IF EXISTS trg_order_items_update_order_total_insert;

CREATE TRIGGER trg_order_items_update_order_total_insert
AFTER INSERT ON order_items
FOR EACH ROW
BEGIN
    UPDATE orders
    SET total_amount = (
        SELECT COALESCE(SUM(subtotal), 0)
        FROM order_items
        WHERE order_id = NEW.order_id
    )
    WHERE order_id = NEW.order_id;
END$$

-- 4. Update order total on UPDATE
DROP TRIGGER IF EXISTS trg_order_items_update_order_total_update;

CREATE TRIGGER trg_order_items_update_order_total_update
AFTER UPDATE ON order_items
FOR EACH ROW
BEGIN
    UPDATE orders
    SET total_amount = (
        SELECT COALESCE(SUM(subtotal), 0)
        FROM order_items
        WHERE order_id = NEW.order_id
    )
    WHERE order_id = NEW.order_id;
END$$

-- 5. Update order total on DELETE
DROP TRIGGER IF EXISTS trg_order_items_update_order_total_delete;

CREATE TRIGGER trg_order_items_update_order_total_delete
AFTER DELETE ON order_items
FOR EACH ROW
BEGIN
    UPDATE orders
    SET total_amount = (
        SELECT COALESCE(SUM(subtotal), 0)
        FROM order_items
        WHERE order_id = OLD.order_id
    )
    WHERE order_id = OLD.order_id;
END$$

DELIMITER ;

-- ========================================
-- ORDERS TRIGGERS (3)
-- ========================================

DELIMITER $$

-- 6. Restore stock when order is cancelled
DROP TRIGGER IF EXISTS trg_orders_restore_stock_on_cancel;

CREATE TRIGGER trg_orders_restore_stock_on_cancel
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        UPDATE product_inventory pi
        INNER JOIN order_items oi ON pi.product_id = oi.product_id
        SET pi.stock_qty = pi.stock_qty + oi.quantity
        WHERE oi.order_id = NEW.order_id
        AND pi.branch_id = NEW.branch_id;
    END IF;
END$$

-- 7. Log order status changes
DROP TRIGGER IF EXISTS trg_orders_log_status_change;

CREATE TRIGGER trg_orders_log_status_change
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO transaction_log (
            entity,
            entity_id,
            action,
            meta,
            performed_by,
            created_at
        ) VALUES (
            'order',
            NEW.order_id,
            'status_change',
            JSON_OBJECT(
                'old_status', OLD.status,
                'new_status', NEW.status,
                'order_id', NEW.order_id,
                'total_amount', NEW.total_amount,
                'currency', NEW.currency
            ),
            COALESCE(@audit_user_id, NEW.user_id),
            NOW()
        );
    END IF;
END$$

-- 8. Lock currency rate on order creation
-- Note: This trigger should create a snapshot in order_currency_snapshots table
-- If order_currency_snapshots table exists, uncomment this trigger
DROP TRIGGER IF EXISTS trg_orders_lock_currency_rate;

CREATE TRIGGER trg_orders_lock_currency_rate
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
    -- Get current exchange rate for the order's currency
    DECLARE v_rate DECIMAL(10, 6);
    
    SELECT rate_to_php INTO v_rate
    FROM currencies
    WHERE code = NEW.currency AND is_active = 1
    LIMIT 1;
    
    -- If rate found, create snapshot
    IF v_rate IS NOT NULL THEN
        INSERT IGNORE INTO order_currency_snapshots (order_id, currency_code, rate_to_php)
        VALUES (NEW.order_id, NEW.currency, v_rate);
    END IF;
END$$

DELIMITER ;

-- ========================================
-- PAYMENTS TRIGGERS (4)
-- ========================================

DELIMITER $$

-- 9. Log payment creation
DROP TRIGGER IF EXISTS trg_payments_log_insert;

CREATE TRIGGER trg_payments_log_insert
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
    INSERT INTO transaction_log (
        entity,
        entity_id,
        action,
        meta,
        performed_by,
        created_at
    ) VALUES (
        'payment',
        NEW.payment_id,
        'payment_created',
        JSON_OBJECT(
            'order_id', NEW.order_id,
            'payment_method', NEW.payment_method,
            'payment_status', NEW.payment_status,
            'amount', NEW.amount,
            'currency', NEW.currency,
            'transaction_id', COALESCE(NEW.transaction_id, '')
        ),
        COALESCE(@audit_user_id, (SELECT user_id FROM orders WHERE order_id = NEW.order_id)),
        NOW()
    );
END$$

-- 10. Log payment updates
DROP TRIGGER IF EXISTS trg_payments_log_update;

CREATE TRIGGER trg_payments_log_update
AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
    IF OLD.payment_status != NEW.payment_status THEN
        INSERT INTO transaction_log (
            entity,
            entity_id,
            action,
            meta,
            performed_by,
            created_at
        ) VALUES (
            'payment',
            NEW.payment_id,
            'payment_status_change',
            JSON_OBJECT(
                'order_id', NEW.order_id,
                'old_status', OLD.payment_status,
                'new_status', NEW.payment_status,
                'payment_method', NEW.payment_method,
                'amount', NEW.amount,
                'currency', NEW.currency
            ),
            COALESCE(@audit_user_id, (SELECT user_id FROM orders WHERE order_id = NEW.order_id)),
            NOW()
        );
    END IF;
END$$

-- 11. Validate payment status changes
DROP TRIGGER IF EXISTS trg_payments_validate_status_change;

CREATE TRIGGER trg_payments_validate_status_change
BEFORE UPDATE ON payments
FOR EACH ROW
BEGIN
    IF OLD.payment_status = 'completed' AND NEW.payment_status = 'pending' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot change payment status from Completed to Pending';
    END IF;
    
    IF OLD.payment_status = 'completed' AND NEW.payment_status = 'failed' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot change payment status from Completed to Failed. Use Refunded instead.';
    END IF;
    
    IF OLD.payment_status = 'refunded' AND NEW.payment_status != 'refunded' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot change payment status from Refunded';
    END IF;
END$$

-- 12. Stock deduction on payment completion (placeholder)
DROP TRIGGER IF EXISTS trg_payment_completed_deduct_stock;

CREATE TRIGGER trg_payment_completed_deduct_stock
AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
    -- Stock deduction is handled in PHP code (create-order.php)
    -- This trigger serves as a placeholder
    IF NEW.payment_status = 'completed' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'completed') THEN
        SET @placeholder = 1; -- Dummy statement to make trigger valid
    END IF;
END$$

DELIMITER ;

-- ========================================
-- PRODUCTS TRIGGERS (6)
-- ========================================

DELIMITER $$

-- 13. Prevent negative price on INSERT
DROP TRIGGER IF EXISTS trg_products_prevent_negative_price;

CREATE TRIGGER trg_products_prevent_negative_price
BEFORE INSERT ON products
FOR EACH ROW
BEGIN
    IF NEW.price < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Product price cannot be negative';
    END IF;
END$$

-- 14. Prevent negative price on UPDATE
DROP TRIGGER IF EXISTS trg_products_prevent_negative_price_update;

CREATE TRIGGER trg_products_prevent_negative_price_update
BEFORE UPDATE ON products
FOR EACH ROW
BEGIN
    IF NEW.price < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Product price cannot be negative';
    END IF;
END$$

-- 15. Price validation before INSERT (if needed for additional processing)
-- Note: This trigger may exist in your database but not in code files
-- Uncomment if you need additional price processing
/*
DROP TRIGGER IF EXISTS trg_products_price_before_insert;

CREATE TRIGGER trg_products_price_before_insert
BEFORE INSERT ON products
FOR EACH ROW
BEGIN
    -- Additional price validation/formatting can be added here
    -- For now, this is a placeholder
    SET NEW.price = ROUND(NEW.price, 2);
END$$
*/

-- 16. Price validation before UPDATE (if needed for additional processing)
-- Note: This trigger may exist in your database but not in code files
-- Uncomment if you need additional price processing
/*
DROP TRIGGER IF EXISTS trg_products_price_before_update;

CREATE TRIGGER trg_products_price_before_update
BEFORE UPDATE ON products
FOR EACH ROW
BEGIN
    -- Additional price validation/formatting can be added here
    -- For now, this is a placeholder
    SET NEW.price = ROUND(NEW.price, 2);
END$$
*/

-- 17. Product create audit
DROP TRIGGER IF EXISTS trg_products_create_audit;

CREATE TRIGGER trg_products_create_audit
AFTER INSERT ON products
FOR EACH ROW
BEGIN
    INSERT INTO `audit_logs` (user_id, category, description)
    VALUES (
        @audit_user_id,
        'product',
        CONCAT('New product: ', COALESCE(NEW.product_name,'(no name)'), ' (ID=', NEW.product_id, ')')
    );
END$$

-- 18. Product update audit
DROP TRIGGER IF EXISTS trg_products_update_audit;

CREATE TRIGGER trg_products_update_audit
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
    DECLARE changed_fields TEXT DEFAULT '';

    IF NOT (OLD.category_id    <=> NEW.category_id)    THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'category_id');    END IF;
    IF NOT (OLD.product_name   <=> NEW.product_name)   THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'product_name');   END IF;
    IF NOT (OLD.brand          <=> NEW.brand)          THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'brand');          END IF;
    IF NOT (OLD.model          <=> NEW.model)          THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'model');          END IF;
    IF NOT (OLD.description    <=> NEW.description)    THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'description');    END IF;
    IF NOT (OLD.price          <=> NEW.price)          THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'price');          END IF;
    IF NOT (OLD.specifications <=> NEW.specifications) THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'specifications'); END IF;

    IF changed_fields <> '' THEN
        INSERT INTO `audit_logs` (user_id, category, description)
        VALUES (
            @audit_user_id, 
            'product',
            CONCAT('Product updated: ', COALESCE(NEW.product_name,'(no name)'),
                   ' (ID=', NEW.product_id, '); fields: ', changed_fields)
        );
    END IF;
END$$

-- 19. Product delete audit
DROP TRIGGER IF EXISTS trg_products_delete_audit;

CREATE TRIGGER trg_products_delete_audit
AFTER DELETE ON products
FOR EACH ROW
BEGIN
    INSERT INTO `audit_logs` (user_id, category, description)
    VALUES (
        @audit_user_id,
        'product',
        CONCAT('Product deleted: ', COALESCE(OLD.product_name,'(no name)'), ' (ID=', OLD.product_id, ')')
    );
END$$

DELIMITER ;

-- ========================================
-- PRODUCT INVENTORY TRIGGERS (4)
-- ========================================

DELIMITER $$

-- 20. Prevent negative stock
DROP TRIGGER IF EXISTS trg_product_inventory_prevent_negative_stock;

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

-- 21. Inventory insert audit
DROP TRIGGER IF EXISTS trg_product_inventory_insert_audit;

CREATE TRIGGER trg_product_inventory_insert_audit
AFTER INSERT ON product_inventory
FOR EACH ROW
BEGIN
    DECLARE product_name_val VARCHAR(200);
    
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
END$$

-- 22. Inventory update audit
DROP TRIGGER IF EXISTS trg_product_inventory_update_audit;

CREATE TRIGGER trg_product_inventory_update_audit
AFTER UPDATE ON product_inventory
FOR EACH ROW
BEGIN
    DECLARE product_name_val VARCHAR(200);
    DECLARE change_desc TEXT DEFAULT '';
    
    SELECT product_name INTO product_name_val
    FROM products
    WHERE product_id = NEW.product_id;
    
    IF OLD.stock_qty != NEW.stock_qty THEN
        SET change_desc = CONCAT('Stock: ', OLD.stock_qty, ' -> ', NEW.stock_qty);
    END IF;
    
    IF OLD.branch_id != NEW.branch_id THEN
        IF change_desc <> '' THEN
            SET change_desc = CONCAT(change_desc, ', ');
        END IF;
        SET change_desc = CONCAT(change_desc, 'Branch: ', OLD.branch_id, ' -> ', NEW.branch_id);
    END IF;
    
    IF change_desc <> '' THEN
        INSERT INTO `audit_logs` (user_id, category, description)
        VALUES (
            @audit_user_id,
            'product',
            CONCAT('Inventory updated: Product "', COALESCE(product_name_val, '(unknown)'), 
                   '" (ID=', NEW.product_id, ') - ', change_desc)
        );
    END IF;
END$$

-- 23. Inventory delete audit
DROP TRIGGER IF EXISTS trg_product_inventory_delete_audit;

CREATE TRIGGER trg_product_inventory_delete_audit
AFTER DELETE ON product_inventory
FOR EACH ROW
BEGIN
    DECLARE product_name_val VARCHAR(200);
    
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
END$$

DELIMITER ;

-- ========================================
-- USERS TRIGGERS (4)
-- ========================================

DELIMITER $$

-- 24. User registration audit
DROP TRIGGER IF EXISTS trg_users_registration_audit;

CREATE TRIGGER trg_users_registration_audit
AFTER INSERT ON users
FOR EACH ROW
BEGIN
    INSERT INTO `audit_logs` (user_id, category, description)
    VALUES (NEW.user_id, 'user', CONCAT('New User: ', NEW.username));
END$$

-- 25. User status audit
-- Note: This trigger may exist in your database but not in code files
-- Uncomment and customize based on your needs
/*
DROP TRIGGER IF EXISTS trg_users_status_audit;

CREATE TRIGGER trg_users_status_audit
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO `audit_logs` (user_id, category, description)
        VALUES (
            NEW.user_id,
            'user',
            CONCAT('User status changed: ', OLD.status, ' -> ', NEW.status, ' (User: ', NEW.username, ')')
        );
    END IF;
END$$
*/

-- 26. User profile update audit
-- Note: This trigger may exist in your database but not in code files
-- Uncomment and customize based on your needs
/*
DROP TRIGGER IF EXISTS trg_users_profile_update_audit;

CREATE TRIGGER trg_users_profile_update_audit
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    DECLARE changed_fields TEXT DEFAULT '';
    
    IF OLD.first_name != NEW.first_name OR OLD.last_name != NEW.last_name THEN
        SET changed_fields = CONCAT_WS(', ', changed_fields, 'name');
    END IF;
    IF OLD.email != NEW.email THEN
        SET changed_fields = CONCAT_WS(', ', changed_fields, 'email');
    END IF;
    IF OLD.phone != NEW.phone THEN
        SET changed_fields = CONCAT_WS(', ', changed_fields, 'phone');
    END IF;
    IF OLD.address != NEW.address THEN
        SET changed_fields = CONCAT_WS(', ', changed_fields, 'address');
    END IF;
    
    IF changed_fields <> '' THEN
        INSERT INTO `audit_logs` (user_id, category, description)
        VALUES (
            NEW.user_id,
            'user',
            CONCAT('User profile updated (', changed_fields, '): ', NEW.username)
        );
    END IF;
END$$
*/

-- 27. User password change audit
-- Note: This trigger may exist in your database but not in code files
-- Uncomment and customize based on your needs
/*
DROP TRIGGER IF EXISTS trg_users_password_change_audit;

CREATE TRIGGER trg_users_password_change_audit
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    IF OLD.password_hash != NEW.password_hash THEN
        INSERT INTO `audit_logs` (user_id, category, description)
        VALUES (
            NEW.user_id,
            'user',
            CONCAT('Password changed for user: ', NEW.username)
        );
    END IF;
END$$
*/

DELIMITER ;

-- ========================================
-- CURRENCIES TRIGGERS (1)
-- ========================================

DELIMITER $$

-- 28. Currency rate change audit
-- Note: This trigger may exist in your database but not in code files
-- Uncomment if currencies table exists
/*
DROP TRIGGER IF EXISTS trg_currencies_rate_changed;

CREATE TRIGGER trg_currencies_rate_changed
AFTER UPDATE ON currencies
FOR EACH ROW
BEGIN
    IF OLD.rate_to_php != NEW.rate_to_php THEN
        INSERT INTO transaction_log (
            entity,
            entity_id,
            action,
            meta,
            performed_by,
            created_at
        ) VALUES (
            'currency',
            NEW.currency_id,
            'rate_changed',
            JSON_OBJECT(
                'currency_code', NEW.code,
                'old_rate', OLD.rate_to_php,
                'new_rate', NEW.rate_to_php
            ),
            @audit_user_id,
            NOW()
        );
    END IF;
END$$
*/

DELIMITER ;

-- ========================================
-- PART 2: STORED PROCEDURES (18 Total)
-- ========================================

-- ========================================
-- ORDER MANAGEMENT PROCEDURES (4)
-- ========================================

-- 1. Create order from cart
DROP PROCEDURE IF EXISTS sp_create_order_from_cart;

DELIMITER $$

CREATE PROCEDURE sp_create_order_from_cart(
    IN p_user_id INT,
    IN p_branch_id INT,
    IN p_currency VARCHAR(3),
    IN p_shipping_address TEXT,
    IN p_payment_method VARCHAR(50),
    IN p_user_id_for_audit INT
)
BEGIN
    DECLARE v_order_id INT;
    DECLARE v_total_amount DECIMAL(10, 2) DEFAULT 0;
    DECLARE v_cart_item_count INT DEFAULT 0;
    DECLARE v_product_id INT;
    DECLARE v_quantity INT;
    DECLARE v_unit_price DECIMAL(10, 2);
    DECLARE v_done INT DEFAULT 0;
    
    DECLARE cart_cursor CURSOR FOR
        SELECT c.product_id, c.quantity, p.price
        FROM cart c
        INNER JOIN products p ON c.product_id = p.product_id
        WHERE c.user_id = p_user_id AND c.branch_id = p_branch_id;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
    
    SET @audit_user_id = p_user_id_for_audit;
    
    START TRANSACTION;
    
    SELECT COUNT(*) INTO v_cart_item_count
    FROM cart
    WHERE user_id = p_user_id AND branch_id = p_branch_id;
    
    IF v_cart_item_count = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cart is empty';
    END IF;
    
    SELECT COALESCE(SUM(c.quantity * p.price), 0) INTO v_total_amount
    FROM cart c
    INNER JOIN products p ON c.product_id = p.product_id
    WHERE c.user_id = p_user_id AND c.branch_id = p_branch_id;
    
    INSERT INTO orders (user_id, total_amount, currency, status, shipping_address, branch_id)
    VALUES (p_user_id, v_total_amount, p_currency, 'pending', p_shipping_address, p_branch_id);
    
    SET v_order_id = LAST_INSERT_ID();
    
    OPEN cart_cursor;
    
    read_loop: LOOP
        FETCH cart_cursor INTO v_product_id, v_quantity, v_unit_price;
        IF v_done THEN
            LEAVE read_loop;
        END IF;
        
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
        VALUES (v_order_id, v_product_id, v_quantity, v_unit_price, v_quantity * v_unit_price);
    END LOOP;
    
    CLOSE cart_cursor;
    
    INSERT INTO payments (order_id, payment_method, payment_status, amount, currency)
    VALUES (v_order_id, p_payment_method, 'pending', v_total_amount, p_currency);
    
    COMMIT;
    
    SELECT v_order_id AS order_id, 'Order created successfully' AS message;
END$$

DELIMITER ;

-- 2. Add product to order
DROP PROCEDURE IF EXISTS sp_add_product_to_order;

DELIMITER $$

CREATE PROCEDURE sp_add_product_to_order(
    IN p_order_id INT,
    IN p_product_id INT,
    IN p_quantity INT,
    IN p_unit_price DECIMAL(10, 2),
    IN p_user_id INT
)
BEGIN
    DECLARE v_order_status VARCHAR(20);
    DECLARE v_existing_item_id INT;
    DECLARE v_error_message VARCHAR(255);
    
    SET @audit_user_id = p_user_id;
    
    SELECT status INTO v_order_status
    FROM orders
    WHERE order_id = p_order_id;
    
    IF v_order_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Order not found';
    END IF;
    
    IF v_order_status IN ('shipped', 'delivered', 'cancelled') THEN
        SET v_error_message = CONCAT('Cannot modify order with status: ', v_order_status);
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = v_error_message;
    END IF;
    
    SELECT order_item_id INTO v_existing_item_id
    FROM order_items
    WHERE order_id = p_order_id AND product_id = p_product_id
    LIMIT 1;
    
    IF v_existing_item_id IS NOT NULL THEN
        UPDATE order_items
        SET quantity = quantity + p_quantity
        WHERE order_item_id = v_existing_item_id;
    ELSE
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
        VALUES (p_order_id, p_product_id, p_quantity, p_unit_price, p_quantity * p_unit_price);
    END IF;
    
    SELECT 'Product added to order successfully' AS message;
END$$

DELIMITER ;

-- 3. Update order status
DROP PROCEDURE IF EXISTS sp_update_order_status;

DELIMITER $$

CREATE PROCEDURE sp_update_order_status(
    IN p_order_id INT,
    IN p_new_status VARCHAR(20),
    IN p_user_id INT
)
BEGIN
    DECLARE v_current_status VARCHAR(20);
    DECLARE v_payment_status VARCHAR(20);
    
    SET @audit_user_id = p_user_id;
    
    SELECT status INTO v_current_status
    FROM orders
    WHERE order_id = p_order_id;
    
    IF v_current_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Order not found';
    END IF;
    
    IF v_current_status = 'cancelled' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot change status of cancelled order';
    END IF;
    
    IF v_current_status = 'delivered' AND p_new_status != 'delivered' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot change status of delivered order';
    END IF;
    
    IF v_current_status = 'pending' AND p_new_status NOT IN ('processing', 'cancelled') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Pending orders can only move to Processing or Cancelled';
    END IF;
    
    IF v_current_status = 'processing' AND p_new_status NOT IN ('shipped', 'cancelled') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Processing orders can only move to Shipped or Cancelled';
    END IF;
    
    IF v_current_status = 'shipped' AND p_new_status NOT IN ('delivered', 'cancelled') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Shipped orders can only move to Delivered or Cancelled';
    END IF;
    
    IF p_new_status = 'processing' THEN
        SELECT payment_status INTO v_payment_status
        FROM payments
        WHERE order_id = p_order_id;
        
        IF v_payment_status != 'completed' THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Order cannot be processed until payment is completed';
        END IF;
    END IF;
    
    UPDATE orders
    SET status = p_new_status,
        updated_at = NOW()
    WHERE order_id = p_order_id;
    
    SELECT 'Order status updated successfully' AS message;
END$$

DELIMITER ;

-- 4. Cancel order
DROP PROCEDURE IF EXISTS sp_cancel_order;

DELIMITER $$

CREATE PROCEDURE sp_cancel_order(
    IN p_order_id INT,
    IN p_user_id INT
)
BEGIN
    DECLARE v_order_status VARCHAR(20);
    DECLARE v_branch_id INT;
    
    SELECT status INTO v_order_status
    FROM orders
    WHERE order_id = p_order_id;
    
    IF v_order_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Order not found';
    END IF;
    
    IF v_order_status = 'cancelled' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Order is already cancelled';
    END IF;
    
    IF v_order_status = 'delivered' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot cancel a delivered order';
    END IF;
    
    SELECT branch_id INTO v_branch_id
    FROM orders
    WHERE order_id = p_order_id;
    
    IF v_branch_id IS NULL THEN
        SET v_branch_id = 1;
    END IF;
    
    SET @audit_user_id = p_user_id;
    
    START TRANSACTION;
    
    UPDATE product_inventory pi
    INNER JOIN order_items oi ON pi.product_id = oi.product_id
    SET pi.stock_qty = pi.stock_qty + oi.quantity
    WHERE oi.order_id = p_order_id
    AND pi.branch_id = v_branch_id;
    
    UPDATE orders
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE order_id = p_order_id;
    
    UPDATE payments
    SET payment_status = 'refunded',
        payment_date = NOW()
    WHERE order_id = p_order_id
    AND payment_status = 'completed';
    
    COMMIT;
    
    SELECT 'Order cancelled successfully' AS message;
END$$

DELIMITER ;

-- ========================================
-- PAYMENT MANAGEMENT PROCEDURES (1)
-- ========================================

-- 5. Record payment
DROP PROCEDURE IF EXISTS sp_record_payment;

DELIMITER $$

CREATE PROCEDURE sp_record_payment(
    IN p_order_id INT,
    IN p_payment_method VARCHAR(50),
    IN p_amount DECIMAL(10, 2),
    IN p_currency VARCHAR(3),
    IN p_transaction_id VARCHAR(100),
    IN p_user_id INT
)
BEGIN
    DECLARE v_payment_exists INT;
    
    SET @audit_user_id = p_user_id;
    
    SELECT COUNT(*) INTO v_payment_exists
    FROM payments
    WHERE order_id = p_order_id;
    
    IF v_payment_exists > 0 THEN
        UPDATE payments
        SET payment_method = p_payment_method,
            amount = p_amount,
            currency = p_currency,
            transaction_id = p_transaction_id,
            payment_status = 'completed',
            payment_date = NOW()
        WHERE order_id = p_order_id;
    ELSE
        INSERT INTO payments (order_id, payment_method, payment_status, amount, currency, transaction_id, payment_date)
        VALUES (p_order_id, p_payment_method, 'completed', p_amount, p_currency, p_transaction_id, NOW());
    END IF;
    
    UPDATE orders
    SET status = 'processing'
    WHERE order_id = p_order_id;
    
    SELECT 'Payment recorded successfully' AS message;
END$$

DELIMITER ;

-- ========================================
-- INVENTORY MANAGEMENT PROCEDURES (4)
-- ========================================

-- 6. Add stock to branch
DROP PROCEDURE IF EXISTS sp_add_stock_to_branch;

DELIMITER $$

CREATE PROCEDURE sp_add_stock_to_branch(
    IN p_product_id INT,
    IN p_branch_id INT,
    IN p_quantity INT,
    IN p_user_id INT
)
BEGIN
    DECLARE v_existing_stock INT;
    
    SET @audit_user_id = p_user_id;
    
    IF p_quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Quantity must be greater than zero';
    END IF;
    
    SELECT stock_qty INTO v_existing_stock
    FROM product_inventory
    WHERE product_id = p_product_id AND branch_id = p_branch_id;
    
    IF v_existing_stock IS NULL THEN
        INSERT INTO product_inventory (product_id, branch_id, stock_qty)
        VALUES (p_product_id, p_branch_id, p_quantity);
    ELSE
        UPDATE product_inventory
        SET stock_qty = stock_qty + p_quantity
        WHERE product_id = p_product_id AND branch_id = p_branch_id;
    END IF;
    
    INSERT INTO transaction_log (
        entity,
        entity_id,
        action,
        meta,
        performed_by,
        created_at
    ) VALUES (
        'inventory',
        p_product_id,
        'stock_added',
        JSON_OBJECT(
            'product_id', p_product_id,
            'branch_id', p_branch_id,
            'quantity_added', p_quantity,
            'new_total', v_existing_stock + p_quantity
        ),
        p_user_id,
        NOW()
    );
    
    SELECT 'Stock added successfully' AS message;
END$$

DELIMITER ;

-- 7. Adjust branch inventory
DROP PROCEDURE IF EXISTS sp_adjust_branch_inventory;

DELIMITER $$

CREATE PROCEDURE sp_adjust_branch_inventory(
    IN p_product_id INT,
    IN p_branch_id INT,
    IN p_adjustment_quantity INT,
    IN p_reason VARCHAR(255),
    IN p_user_id INT
)
BEGIN
    DECLARE v_current_stock INT;
    DECLARE v_new_stock INT;
    DECLARE v_error_message VARCHAR(255);
    
    SET @audit_user_id = p_user_id;
    
    SELECT COALESCE(stock_qty, 0) INTO v_current_stock
    FROM product_inventory
    WHERE product_id = p_product_id AND branch_id = p_branch_id;
    
    IF v_current_stock IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Inventory entry not found for this product and branch';
    END IF;
    
    SET v_new_stock = v_current_stock + p_adjustment_quantity;
    
    IF v_new_stock < 0 THEN
        SET v_error_message = CONCAT('Adjustment would result in negative stock. Current: ', v_current_stock, ', Adjustment: ', p_adjustment_quantity);
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = v_error_message;
    END IF;
    
    UPDATE product_inventory
    SET stock_qty = v_new_stock
    WHERE product_id = p_product_id AND branch_id = p_branch_id;
    
    INSERT INTO transaction_log (
        entity,
        entity_id,
        action,
        meta,
        performed_by,
        created_at
    ) VALUES (
        'inventory',
        p_product_id,
        'stock_adjusted',
        JSON_OBJECT(
            'product_id', p_product_id,
            'branch_id', p_branch_id,
            'old_stock', v_current_stock,
            'adjustment', p_adjustment_quantity,
            'new_stock', v_new_stock,
            'reason', p_reason
        ),
        p_user_id,
        NOW()
    );
    
    SELECT 'Inventory adjusted successfully' AS message;
END$$

DELIMITER ;

-- 8. Transfer stock
DROP PROCEDURE IF EXISTS sp_transfer_stock;

DELIMITER $$

CREATE PROCEDURE sp_transfer_stock(
    IN p_product_id INT,
    IN p_from_branch_id INT,
    IN p_to_branch_id INT,
    IN p_quantity INT,
    IN p_user_id INT
)
BEGIN
    DECLARE v_available_stock INT;
    DECLARE v_error_message VARCHAR(255);
    
    IF p_quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Transfer quantity must be greater than zero';
    END IF;
    
    IF p_from_branch_id = p_to_branch_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Source and destination branches must be different';
    END IF;
    
    SELECT COALESCE(stock_qty, 0) INTO v_available_stock
    FROM product_inventory
    WHERE product_id = p_product_id
    AND branch_id = p_from_branch_id;
    
    IF v_available_stock < p_quantity THEN
        SET v_error_message = CONCAT('Insufficient stock. Available: ', v_available_stock, ', Requested: ', p_quantity);
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = v_error_message;
    END IF;
    
    SET @audit_user_id = p_user_id;
    
    START TRANSACTION;
    
    UPDATE product_inventory
    SET stock_qty = stock_qty - p_quantity
    WHERE product_id = p_product_id
    AND branch_id = p_from_branch_id;
    
    INSERT INTO product_inventory (product_id, branch_id, stock_qty)
    VALUES (p_product_id, p_to_branch_id, p_quantity)
    ON DUPLICATE KEY UPDATE stock_qty = stock_qty + p_quantity;
    
    INSERT INTO transaction_log (
        entity,
        entity_id,
        action,
        meta,
        performed_by,
        created_at
    ) VALUES (
        'inventory',
        p_product_id,
        'stock_transfer',
        JSON_OBJECT(
            'product_id', p_product_id,
            'from_branch_id', p_from_branch_id,
            'to_branch_id', p_to_branch_id,
            'quantity', p_quantity
        ),
        p_user_id,
        NOW()
    );
    
    COMMIT;
    
    SELECT 'Stock transferred successfully' AS message;
END$$

DELIMITER ;

-- 9. Get low stock products
DROP PROCEDURE IF EXISTS sp_get_low_stock_products;

DELIMITER $$

CREATE PROCEDURE sp_get_low_stock_products(
    IN p_threshold INT,
    IN p_branch_id INT
)
BEGIN
    SELECT 
        p.product_id,
        p.product_name,
        p.brand,
        p.model,
        c.category_name,
        b.branch_id,
        b.branch_name,
        COALESCE(pi.stock_qty, 0) AS stock_quantity,
        p_threshold AS threshold
    FROM products p
    INNER JOIN categories c ON p.category_id = c.category_id
    LEFT JOIN product_inventory pi ON p.product_id = pi.product_id
    LEFT JOIN branches b ON pi.branch_id = b.branch_id
    WHERE (p_branch_id IS NULL OR pi.branch_id = p_branch_id)
    AND COALESCE(pi.stock_qty, 0) < p_threshold
    ORDER BY pi.stock_qty ASC, b.branch_name, p.product_name;
END$$

DELIMITER ;

-- ========================================
-- ORDER ITEM MANAGEMENT PROCEDURES (1)
-- ========================================

-- 10. Update order item quantity
DROP PROCEDURE IF EXISTS sp_update_order_item_quantity;

DELIMITER $$

CREATE PROCEDURE sp_update_order_item_quantity(
    IN p_order_item_id INT,
    IN p_new_quantity INT,
    IN p_user_id INT
)
BEGIN
    DECLARE v_order_id INT;
    DECLARE v_order_status VARCHAR(20);
    DECLARE v_current_quantity INT;
    DECLARE v_unit_price DECIMAL(10, 2);
    DECLARE v_error_message VARCHAR(255);
    
    IF p_new_quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Quantity must be greater than zero';
    END IF;
    
    SELECT order_id, quantity, unit_price INTO v_order_id, v_current_quantity, v_unit_price
    FROM order_items
    WHERE order_item_id = p_order_item_id;
    
    IF v_order_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Order item not found';
    END IF;
    
    SELECT status INTO v_order_status
    FROM orders
    WHERE order_id = v_order_id;
    
    IF v_order_status IN ('shipped', 'delivered', 'cancelled') THEN
        SET v_error_message = CONCAT('Cannot modify items in order with status: ', v_order_status);
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = v_error_message;
    END IF;
    
    SET @audit_user_id = p_user_id;
    
    UPDATE order_items
    SET quantity = p_new_quantity
    WHERE order_item_id = p_order_item_id;
    
    SELECT 'Order item quantity updated successfully' AS message;
END$$

DELIMITER ;

-- ========================================
-- REPORTING PROCEDURES (5)
-- ========================================

-- 11. Get top selling products
DROP PROCEDURE IF EXISTS sp_get_top_selling_products;

DELIMITER $$

CREATE PROCEDURE sp_get_top_selling_products(
    IN p_start_date DATE,
    IN p_end_date DATE,
    IN p_limit INT
)
BEGIN
    SELECT 
        p.product_id,
        p.product_name,
        p.brand,
        p.model,
        c.category_name,
        SUM(oi.quantity) AS total_quantity_sold,
        COUNT(DISTINCT o.order_id) AS total_orders,
        SUM(oi.subtotal) AS total_revenue,
        o.currency AS currency
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.order_id
    INNER JOIN products p ON oi.product_id = p.product_id
    INNER JOIN categories c ON p.category_id = c.category_id
    INNER JOIN payments pay ON o.order_id = pay.order_id
    WHERE pay.payment_status = 'completed'
    AND o.status != 'cancelled'
    AND DATE(o.order_date) BETWEEN p_start_date AND p_end_date
    GROUP BY p.product_id, p.product_name, p.brand, p.model, c.category_name, o.currency
    ORDER BY total_quantity_sold DESC
    LIMIT p_limit;
END$$

DELIMITER ;

-- 12. Get monthly sales
DROP PROCEDURE IF EXISTS sp_get_monthly_sales;

DELIMITER $$

CREATE PROCEDURE sp_get_monthly_sales(
    IN p_year INT,
    IN p_month INT
)
BEGIN
    SELECT 
        DATE_FORMAT(o.order_date, '%Y-%m') AS month,
        COUNT(DISTINCT o.order_id) AS total_orders,
        COUNT(DISTINCT o.user_id) AS total_customers,
        SUM(o.total_amount) AS total_revenue,
        o.currency AS currency,
        AVG(o.total_amount) AS average_order_value
    FROM orders o
    INNER JOIN payments pay ON o.order_id = pay.order_id
    WHERE pay.payment_status = 'completed'
    AND o.status != 'cancelled'
    AND YEAR(o.order_date) = p_year
    AND MONTH(o.order_date) = p_month
    GROUP BY DATE_FORMAT(o.order_date, '%Y-%m'), o.currency
    ORDER BY o.currency;
END$$

DELIMITER ;

-- 13. Get monthly sales by branch
DROP PROCEDURE IF EXISTS sp_get_monthly_sales_by_branch;

DELIMITER $$

CREATE PROCEDURE sp_get_monthly_sales_by_branch(
    IN p_year INT,
    IN p_month INT
)
BEGIN
    SELECT 
        b.branch_id,
        b.branch_name,
        DATE_FORMAT(o.order_date, '%Y-%m') AS month,
        COUNT(DISTINCT o.order_id) AS total_orders,
        COUNT(DISTINCT o.user_id) AS total_customers,
        SUM(o.total_amount) AS total_revenue,
        o.currency AS currency,
        AVG(o.total_amount) AS average_order_value
    FROM orders o
    INNER JOIN payments pay ON o.order_id = pay.order_id
    INNER JOIN branches b ON o.branch_id = b.branch_id
    WHERE pay.payment_status = 'completed'
    AND o.status != 'cancelled'
    AND YEAR(o.order_date) = p_year
    AND MONTH(o.order_date) = p_month
    GROUP BY b.branch_id, b.branch_name, DATE_FORMAT(o.order_date, '%Y-%m'), o.currency
    ORDER BY b.branch_name, o.currency;
END$$

DELIMITER ;

-- 14. Get revenue by currency
DROP PROCEDURE IF EXISTS sp_get_revenue_by_currency;

DELIMITER $$

CREATE PROCEDURE sp_get_revenue_by_currency(
    IN p_start_date DATE,
    IN p_end_date DATE
)
BEGIN
    SELECT 
        o.currency,
        COUNT(DISTINCT o.order_id) AS total_orders,
        COUNT(DISTINCT o.user_id) AS total_customers,
        SUM(o.total_amount) AS total_revenue,
        AVG(o.total_amount) AS average_order_value,
        MIN(o.total_amount) AS min_order_value,
        MAX(o.total_amount) AS max_order_value
    FROM orders o
    INNER JOIN payments pay ON o.order_id = pay.order_id
    WHERE pay.payment_status = 'completed'
    AND o.status != 'cancelled'
    AND DATE(o.order_date) BETWEEN p_start_date AND p_end_date
    GROUP BY o.currency
    ORDER BY total_revenue DESC;
END$$

DELIMITER ;

-- 15. Get customer purchase history
DROP PROCEDURE IF EXISTS sp_get_customer_purchase_history;

DELIMITER $$

CREATE PROCEDURE sp_get_customer_purchase_history(
    IN p_user_id INT,
    IN p_start_date DATE,
    IN p_end_date DATE
)
BEGIN
    SELECT 
        o.order_id,
        o.order_date,
        o.status,
        o.total_amount,
        o.currency,
        o.shipping_address,
        pay.payment_method,
        pay.payment_status,
        pay.payment_date,
        oi.order_item_id,
        oi.product_id,
        p.product_name,
        p.brand,
        p.model,
        oi.quantity,
        oi.unit_price,
        oi.subtotal
    FROM orders o
    LEFT JOIN payments pay ON o.order_id = pay.order_id
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.product_id
    WHERE o.user_id = p_user_id
    AND DATE(o.order_date) BETWEEN p_start_date AND p_end_date
    ORDER BY o.order_date DESC, o.order_id, oi.order_item_id;
END$$

DELIMITER ;

-- ========================================
-- PRODUCT MANAGEMENT PROCEDURES (2)
-- ========================================

-- 16. Search products advanced
DROP PROCEDURE IF EXISTS sp_search_products_advanced;

DELIMITER $$

CREATE PROCEDURE sp_search_products_advanced(
    IN p_currency    VARCHAR(3),
    IN p_branch_id   INT,
    IN p_q           VARCHAR(255),
    IN p_genre_id    INT,
    IN p_year        INT,
    IN p_month       INT,
    IN p_price_min   DECIMAL(10,2),
    IN p_price_max   DECIMAL(10,2),
    IN p_in_stock    TINYINT,
    IN p_sort        VARCHAR(20),
    IN p_limit       INT,
    IN p_offset      INT
)
BEGIN
    DECLARE v_rate DECIMAL(18,8);
    DECLARE v_currency VARCHAR(3);

    SET v_currency = IFNULL(p_currency, 'PHP');

    SELECT rate_to_php INTO v_rate
    FROM currencies
    WHERE code = v_currency AND is_active = 1
    LIMIT 1;

    IF v_rate IS NULL THEN
        SET v_currency = 'PHP';
        SET v_rate = 1;
    END IF;

    -- 1) TOTAL COUNT (for pagination)
    IF p_branch_id IS NOT NULL THEN
        SELECT COUNT(DISTINCT p.product_id) AS total
        FROM product_inventory pi
        INNER JOIN products p ON pi.product_id = p.product_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        WHERE pi.branch_id = p_branch_id
          AND (
            p_q IS NULL OR p_q = '' OR
            p.product_name LIKE CONCAT('%', p_q, '%') OR
            p.brand        LIKE CONCAT('%', p_q, '%') OR
            p.model        LIKE CONCAT('%', p_q, '%') OR
            p.description  LIKE CONCAT('%', p_q, '%')
          )
          AND (p_genre_id IS NULL OR p.category_id = p_genre_id)
          AND (p_year  IS NULL OR (p.release_date IS NULL OR YEAR(p.release_date) = p_year))
          AND (p_month IS NULL OR (p.release_date IS NULL OR MONTH(p.release_date) = p_month))
          AND (p_price_min IS NULL OR p.price >= p_price_min)
          AND (p_price_max IS NULL OR p.price <= p_price_max)
          AND (
            p_in_stock IS NULL OR p_in_stock = 0 OR
            pi.stock_qty > 0
          );
    ELSE
        SELECT COUNT(DISTINCT p.product_id) AS total
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
        WHERE
          NOT EXISTS (SELECT 1 FROM product_inventory pi WHERE pi.product_id = p.product_id)
          AND (
            p_q IS NULL OR p_q = '' OR
            p.product_name LIKE CONCAT('%', p_q, '%') OR
            p.brand        LIKE CONCAT('%', p_q, '%') OR
            p.model        LIKE CONCAT('%', p_q, '%') OR
            p.description  LIKE CONCAT('%', p_q, '%')
          )
          AND (p_genre_id IS NULL OR p.category_id = p_genre_id)
          AND (p_year  IS NULL OR (p.release_date IS NULL OR YEAR(p.release_date) = p_year))
          AND (p_month IS NULL OR (p.release_date IS NULL OR MONTH(p.release_date) = p_month))
          AND (p_price_min IS NULL OR p.price >= p_price_min)
          AND (p_price_max IS NULL OR p.price <= p_price_max)
          AND (p_in_stock IS NULL OR p_in_stock = 0);
    END IF;

    -- 2) ACTUAL ROWS (products)
    IF p_branch_id IS NOT NULL THEN
        SELECT
          p.product_id,
          p.product_name,
          p.brand,
          p.model,
          p.price                                  AS price,
          p.price                                  AS price_php,
          CASE 
            WHEN v_currency = 'PHP' THEN p.price
            ELSE ROUND(p.price * v_rate, 2)
          END                                      AS display_price,
          v_currency                               AS currency,
          c.category_name,
          pi.stock_qty                             AS stock_quantity,
          (
            SELECT image_url
            FROM product_images
            WHERE product_id = p.product_id
              AND is_primary = 1
            ORDER BY sort_order ASC, created_at ASC
            LIMIT 1
          )                                        AS primary_image_url,
          p.created_at
        FROM product_inventory pi
        INNER JOIN products p ON pi.product_id = p.product_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        WHERE pi.branch_id = p_branch_id
          AND (
            p_q IS NULL OR p_q = '' OR
            p.product_name LIKE CONCAT('%', p_q, '%') OR
            p.brand        LIKE CONCAT('%', p_q, '%') OR
            p.model        LIKE CONCAT('%', p_q, '%') OR
            p.description  LIKE CONCAT('%', p_q, '%')
          )
          AND (p_genre_id IS NULL OR p.category_id = p_genre_id)
          AND (p_year  IS NULL OR (p.release_date IS NULL OR YEAR(p.release_date) = p_year))
          AND (p_month IS NULL OR (p.release_date IS NULL OR MONTH(p.release_date) = p_month))
          AND (p_price_min IS NULL OR p.price >= p_price_min)
          AND (p_price_max IS NULL OR p.price <= p_price_max)
          AND (
            p_in_stock IS NULL OR p_in_stock = 0 OR
            pi.stock_qty > 0
          )
        ORDER BY
          CASE 
            WHEN p_sort = 'price_asc'  THEN CASE WHEN v_currency='PHP' THEN p.price ELSE ROUND(p.price * v_rate,2) END
            ELSE NULL
          END ASC,
          CASE 
            WHEN p_sort = 'price_desc' THEN CASE WHEN v_currency='PHP' THEN p.price ELSE ROUND(p.price * v_rate,2) END
            ELSE NULL
          END DESC,
          CASE 
            WHEN p_sort = 'name_asc' THEN p.product_name
            ELSE NULL
          END ASC,
          CASE 
            WHEN p_sort = 'name_desc' THEN p.product_name
            ELSE NULL
          END DESC,
          p.created_at DESC,
          p.product_id DESC
        LIMIT p_limit OFFSET p_offset;
    ELSE
        SELECT
          p.product_id,
          p.product_name,
          p.brand,
          p.model,
          p.price                                  AS price,
          p.price                                  AS price_php,
          CASE 
            WHEN v_currency = 'PHP' THEN p.price
            ELSE ROUND(p.price * v_rate, 2)
          END                                      AS display_price,
          v_currency                               AS currency,
          c.category_name,
          0                                        AS stock_quantity,
          (
            SELECT image_url
            FROM product_images
            WHERE product_id = p.product_id
              AND is_primary = 1
            ORDER BY sort_order ASC, created_at ASC
            LIMIT 1
          )                                        AS primary_image_url,
          p.created_at
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
        WHERE
          NOT EXISTS (SELECT 1 FROM product_inventory pi WHERE pi.product_id = p.product_id)
          AND (
            p_q IS NULL OR p_q = '' OR
            p.product_name LIKE CONCAT('%', p_q, '%') OR
            p.brand        LIKE CONCAT('%', p_q, '%') OR
            p.model        LIKE CONCAT('%', p_q, '%') OR
            p.description  LIKE CONCAT('%', p_q, '%')
          )
          AND (p_genre_id IS NULL OR p.category_id = p_genre_id)
          AND (p_year  IS NULL OR (p.release_date IS NULL OR YEAR(p.release_date) = p_year))
          AND (p_month IS NULL OR (p.release_date IS NULL OR MONTH(p.release_date) = p_month))
          AND (p_price_min IS NULL OR p.price >= p_price_min)
          AND (p_price_max IS NULL OR p.price <= p_price_max)
          AND (p_in_stock IS NULL OR p_in_stock = 0)
        ORDER BY
          CASE 
            WHEN p_sort = 'price_asc'  THEN CASE WHEN v_currency='PHP' THEN p.price ELSE ROUND(p.price * v_rate,2) END
            ELSE NULL
          END ASC,
          CASE 
            WHEN p_sort = 'price_desc' THEN CASE WHEN v_currency='PHP' THEN p.price ELSE ROUND(p.price * v_rate,2) END
            ELSE NULL
          END DESC,
          CASE 
            WHEN p_sort = 'name_asc' THEN p.product_name
            ELSE NULL
          END ASC,
          CASE 
            WHEN p_sort = 'name_desc' THEN p.product_name
            ELSE NULL
          END DESC,
          p.created_at DESC,
          p.product_id DESC
        LIMIT p_limit OFFSET p_offset;
    END IF;
END$$

DELIMITER ;

-- 17. Upsert product review
DROP PROCEDURE IF EXISTS sp_upsert_product_review;

DELIMITER $$

CREATE PROCEDURE sp_upsert_product_review(
    IN p_user_id INT,
    IN p_product_id INT,
    IN p_rating INT,
    IN p_comment TEXT
)
BEGIN
    DECLARE v_review_id INT;
    DECLARE v_existing_review INT;
    
    IF p_rating < 1 OR p_rating > 5 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Rating must be between 1 and 5';
    END IF;
    
    SELECT review_id INTO v_existing_review
    FROM reviews
    WHERE user_id = p_user_id AND product_id = p_product_id
    LIMIT 1;
    
    IF v_existing_review IS NOT NULL THEN
        UPDATE reviews
        SET rating = p_rating,
            comment = p_comment,
            created_at = NOW()
        WHERE review_id = v_existing_review;
        
        SET v_review_id = v_existing_review;
    ELSE
        INSERT INTO reviews (user_id, product_id, rating, comment)
        VALUES (p_user_id, p_product_id, p_rating, p_comment);
        
        SET v_review_id = LAST_INSERT_ID();
    END IF;
    
    SELECT v_review_id AS review_id, 'Review saved successfully' AS message;
END$$

DELIMITER ;

-- ========================================
-- UTILITY PROCEDURES (1)
-- ========================================

-- 18. Export all CREATE TABLE statements
DROP PROCEDURE IF EXISTS sp_export_all_create_tables;

DELIMITER $$

CREATE PROCEDURE sp_export_all_create_tables()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_table_name VARCHAR(255);
    DECLARE v_create_stmt TEXT;
    
    DECLARE table_cursor CURSOR FOR
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    DROP TEMPORARY TABLE IF EXISTS temp_create_statements;
    CREATE TEMPORARY TABLE temp_create_statements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        table_name VARCHAR(255),
        create_statement TEXT
    );
    
    OPEN table_cursor;
    
    read_loop: LOOP
        FETCH table_cursor INTO v_table_name;
        
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        INSERT INTO temp_create_statements (table_name, create_statement)
        VALUES (v_table_name, CONCAT('-- Run: SHOW CREATE TABLE `', v_table_name, '`;'));
        
    END LOOP;
    
    CLOSE table_cursor;
    
    SELECT table_name, create_statement
    FROM temp_create_statements
    ORDER BY id;
    
    DROP TEMPORARY TABLE temp_create_statements;
    
END$$

DELIMITER ;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- List all triggers
SELECT 
    TRIGGER_NAME AS 'Trigger Name',
    EVENT_MANIPULATION AS 'Event',
    EVENT_OBJECT_TABLE AS 'Table',
    ACTION_TIMING AS 'Timing'
FROM INFORMATION_SCHEMA.TRIGGERS
WHERE TRIGGER_SCHEMA = 'electronics_store'
ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME;

-- Count triggers
SELECT COUNT(*) AS total_triggers 
FROM INFORMATION_SCHEMA.TRIGGERS 
WHERE TRIGGER_SCHEMA = 'electronics_store';

-- List all stored procedures
SELECT 
    ROUTINE_NAME AS 'Procedure Name',
    ROUTINE_TYPE AS 'Type'
FROM INFORMATION_SCHEMA.ROUTINES
WHERE ROUTINE_SCHEMA = 'electronics_store'
AND ROUTINE_TYPE = 'PROCEDURE'
ORDER BY ROUTINE_NAME;

-- Count stored procedures
SELECT COUNT(*) AS total_procedures 
FROM INFORMATION_SCHEMA.ROUTINES 
WHERE ROUTINE_SCHEMA = 'electronics_store' 
AND ROUTINE_TYPE = 'PROCEDURE';

SELECT 'All triggers and stored procedures created successfully!' AS Status;

