
-- CREATE MISSING STORED PROCEDURES FROM PROPOSAL

-- This script creates all missing stored procedures required by the proposal
-- Compatible with MySQL Workbench
-- Run this script in MySQL Workbench

USE electronics_store;


-- 1. TOP-SELLING PRODUCTS REPORT

-- Generates a report of top-selling products for a specific period
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


-- 2. MONTHLY SALES TOTALS

-- Calculates total sales and revenue for a selected month
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


-- 3. MONTHLY SALES COMPARISON PER BRANCH

-- Produces a monthly sales comparison report per branch
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


-- 4. TOTAL REVENUE BY CURRENCY

-- Calculates total revenue grouped by currency used
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


-- 5. CANCEL ORDER AND RESTORE STOCK

-- Cancels an order and automatically restores stock
DROP PROCEDURE IF EXISTS sp_cancel_order;

DELIMITER $$

CREATE PROCEDURE sp_cancel_order(
    IN p_order_id INT,
    IN p_user_id INT
)
BEGIN
    DECLARE v_order_status VARCHAR(20);
    DECLARE v_branch_id INT;
    
    -- Get current order status
    SELECT status INTO v_order_status
    FROM orders
    WHERE order_id = p_order_id;
    
    -- Check if order can be cancelled
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
    
    -- Get branch_id from orders table
    SELECT branch_id INTO v_branch_id
    FROM orders
    WHERE order_id = p_order_id;
    
    -- If branch_id is NULL, default to 1 (or handle as needed)
    IF v_branch_id IS NULL THEN
        SET v_branch_id = 1;
    END IF;
    
    -- Set audit user for triggers
    SET @audit_user_id = p_user_id;
    
    -- Start transaction
    START TRANSACTION;
    
    -- Restore stock for each item
    UPDATE product_inventory pi
    INNER JOIN order_items oi ON pi.product_id = oi.product_id
    SET pi.stock_qty = pi.stock_qty + oi.quantity
    WHERE oi.order_id = p_order_id
    AND pi.branch_id = v_branch_id;
    
    -- Update order status to cancelled
    UPDATE orders
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE order_id = p_order_id;
    
    -- Update payment status if exists
    UPDATE payments
    SET payment_status = 'refunded',
        payment_date = NOW()
    WHERE order_id = p_order_id
    AND payment_status = 'completed';
    
    COMMIT;
    
    SELECT 'Order cancelled successfully' AS message;
END$$

DELIMITER ;


-- 6. TRANSFER STOCK BETWEEN BRANCHES

-- Transfers product stock from one branch to another
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
    
    -- Validate inputs
    IF p_quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Transfer quantity must be greater than zero';
    END IF;
    
    IF p_from_branch_id = p_to_branch_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Source and destination branches must be different';
    END IF;
    
    -- Check available stock
    SELECT COALESCE(stock_qty, 0) INTO v_available_stock
    FROM product_inventory
    WHERE product_id = p_product_id
    AND branch_id = p_from_branch_id;
    
    IF v_available_stock < p_quantity THEN
        SET v_error_message = CONCAT('Insufficient stock. Available: ', v_available_stock, ', Requested: ', p_quantity);
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = v_error_message;
    END IF;
    
    -- Set audit user for triggers
    SET @audit_user_id = p_user_id;
    
    -- Start transaction
    START TRANSACTION;
    
    -- Deduct from source branch
    UPDATE product_inventory
    SET stock_qty = stock_qty - p_quantity
    WHERE product_id = p_product_id
    AND branch_id = p_from_branch_id;
    
    -- Add to destination branch (insert if doesn't exist)
    INSERT INTO product_inventory (product_id, branch_id, stock_qty)
    VALUES (p_product_id, p_to_branch_id, p_quantity)
    ON DUPLICATE KEY UPDATE stock_qty = stock_qty + p_quantity;
    
    -- Log the transfer
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


-- 7. UPDATE ORDER ITEM QUANTITY

-- Updates order item quantity and recalculates subtotal
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
    
    -- Validate quantity
    IF p_new_quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Quantity must be greater than zero';
    END IF;
    
    -- Get order item details
    SELECT order_id, quantity, unit_price INTO v_order_id, v_current_quantity, v_unit_price
    FROM order_items
    WHERE order_item_id = p_order_item_id;
    
    IF v_order_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Order item not found';
    END IF;
    
    -- Check if order can be modified
    SELECT status INTO v_order_status
    FROM orders
    WHERE order_id = v_order_id;
    
    IF v_order_status IN ('shipped', 'delivered', 'cancelled') THEN
        SET v_error_message = CONCAT('Cannot modify items in order with status: ', v_order_status);
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = v_error_message;
    END IF;
    
    -- Set audit user for triggers
    SET @audit_user_id = p_user_id;
    
    -- Update quantity (triggers will recalculate subtotal and order total)
    UPDATE order_items
    SET quantity = p_new_quantity
    WHERE order_item_id = p_order_item_id;
    
    SELECT 'Order item quantity updated successfully' AS message;
END$$

DELIMITER ;


-- 8. GET LOW STOCK PRODUCTS

-- Lists all products below a certain stock level threshold
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


-- VERIFY STORED PROCEDURES

SELECT 'Stored procedures created successfully!' AS Status;
SELECT COUNT(*) AS total_procedures 
FROM information_schema.routines 
WHERE routine_schema = 'electronics_store' 
AND routine_type = 'PROCEDURE';

