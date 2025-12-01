
-- CREATE MISSING TRIGGERS FROM PROPOSAL

-- This script creates all missing triggers required by the proposal
-- Compatible with MySQL Workbench
-- Run this script in MySQL Workbench

USE electronics_store;


-- 1. AUTO-CALCULATE ORDER ITEM SUBTOTAL

-- Automatically calculates subtotal (quantity × unit_price) when order item is added/modified
DROP TRIGGER IF EXISTS trg_order_items_calculate_subtotal;
DROP TRIGGER IF EXISTS trg_order_items_update_subtotal;

DELIMITER $$

CREATE TRIGGER trg_order_items_calculate_subtotal
BEFORE INSERT ON order_items
FOR EACH ROW
BEGIN
    -- Calculate subtotal if not provided or if quantity/unit_price changed
    IF NEW.subtotal IS NULL OR NEW.subtotal = 0 THEN
        SET NEW.subtotal = NEW.quantity * NEW.unit_price;
    END IF;
END$$

CREATE TRIGGER trg_order_items_update_subtotal
BEFORE UPDATE ON order_items
FOR EACH ROW
BEGIN
    -- Recalculate subtotal if quantity or unit_price changed
    IF OLD.quantity != NEW.quantity OR OLD.unit_price != NEW.unit_price THEN
        SET NEW.subtotal = NEW.quantity * NEW.unit_price;
    END IF;
END$$

DELIMITER ;


-- 2. AUTO-UPDATE ORDER TOTAL WHEN ITEMS CHANGE

-- Automatically recalculates order total_amount when order_items are added, updated, or deleted
DROP TRIGGER IF EXISTS trg_order_items_update_order_total_insert;
DROP TRIGGER IF EXISTS trg_order_items_update_order_total_update;
DROP TRIGGER IF EXISTS trg_order_items_update_order_total_delete;

DELIMITER $$

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


-- 3. RESTORE STOCK WHEN ORDER IS CANCELLED

-- Automatically restores stock to inventory when order status changes to 'cancelled'
DROP TRIGGER IF EXISTS trg_orders_restore_stock_on_cancel;

DELIMITER $$

CREATE TRIGGER trg_orders_restore_stock_on_cancel
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    -- Only process when status changes to 'cancelled' from a non-cancelled state
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        -- Restore stock for each item in the cancelled order
        -- Use branch_id from orders table
        UPDATE product_inventory pi
        INNER JOIN order_items oi ON pi.product_id = oi.product_id
        SET pi.stock_qty = pi.stock_qty + oi.quantity
        WHERE oi.order_id = NEW.order_id
        AND pi.branch_id = NEW.branch_id;
    END IF;
END$$

DELIMITER ;


-- 4. LOG ORDER STATUS CHANGES TO TRANSACTION_LOG

-- Records every order status change (Pending → Processing → Shipped → Delivered) in transaction_log
DROP TRIGGER IF EXISTS trg_orders_log_status_change;

DELIMITER $$

CREATE TRIGGER trg_orders_log_status_change
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    -- Only log if status actually changed
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

DELIMITER ;


-- 5. LOG PAYMENT ACTIVITIES TO TRANSACTION_LOG

-- Records all payment operations (create, update) in transaction_log
DROP TRIGGER IF EXISTS trg_payments_log_insert;
DROP TRIGGER IF EXISTS trg_payments_log_update;

DELIMITER $$

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

CREATE TRIGGER trg_payments_log_update
AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
    -- Log status changes
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

DELIMITER ;


-- 6. PREVENT INVALID PAYMENT STATUS CHANGES

-- Prevents invalid transitions (e.g., Completed → Pending)
DROP TRIGGER IF EXISTS trg_payments_validate_status_change;

DELIMITER $$

CREATE TRIGGER trg_payments_validate_status_change
BEFORE UPDATE ON payments
FOR EACH ROW
BEGIN
    -- Prevent moving from Completed back to Pending
    IF OLD.payment_status = 'completed' AND NEW.payment_status = 'pending' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot change payment status from Completed to Pending';
    END IF;
    
    -- Prevent moving from Completed to Failed (should use Refunded instead)
    IF OLD.payment_status = 'completed' AND NEW.payment_status = 'failed' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot change payment status from Completed to Failed. Use Refunded instead.';
    END IF;
    
    -- Prevent moving from Refunded to any other status
    IF OLD.payment_status = 'refunded' AND NEW.payment_status != 'refunded' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot change payment status from Refunded';
    END IF;
END$$

DELIMITER ;


-- 7. PREVENT INVALID CURRENCY EXCHANGE RATES

-- Prevents zero or negative exchange rates
-- Note: Only create if currencies table exists
-- If currencies table doesn't exist, comment out or skip these triggers

DROP TRIGGER IF EXISTS trg_currencies_validate_rate;
DROP TRIGGER IF EXISTS trg_currencies_validate_rate_update;

-- Uncomment the following if you have a currencies table:
/*
DELIMITER $$

CREATE TRIGGER trg_currencies_validate_rate
BEFORE INSERT ON currencies
FOR EACH ROW
BEGIN
    IF NEW.rate_to_php <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Exchange rate must be greater than zero';
    END IF;
END$$

CREATE TRIGGER trg_currencies_validate_rate_update
BEFORE UPDATE ON currencies
FOR EACH ROW
BEGIN
    IF NEW.rate_to_php <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Exchange rate must be greater than zero';
    END IF;
END$$

DELIMITER ;
*/


-- 8. PREVENT NEGATIVE PRICES (Additional Check)

-- Additional trigger to prevent negative prices (backup to CHECK constraint)
DROP TRIGGER IF EXISTS trg_products_prevent_negative_price;
DROP TRIGGER IF EXISTS trg_products_prevent_negative_price_update;

DELIMITER $$

CREATE TRIGGER trg_products_prevent_negative_price
BEFORE INSERT ON products
FOR EACH ROW
BEGIN
    IF NEW.price < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Product price cannot be negative';
    END IF;
END$$

CREATE TRIGGER trg_products_prevent_negative_price_update
BEFORE UPDATE ON products
FOR EACH ROW
BEGIN
    IF NEW.price < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Product price cannot be negative';
    END IF;
END$$

DELIMITER ;


-- VERIFY TRIGGERS

SELECT 'Triggers created successfully!' AS Status;
SELECT COUNT(*) AS total_triggers 
FROM information_schema.triggers 
WHERE trigger_schema = 'electronics_store';

