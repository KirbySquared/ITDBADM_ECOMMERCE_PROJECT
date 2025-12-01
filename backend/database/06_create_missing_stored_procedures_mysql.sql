
-- CREATE MISSING STORED PROCEDURES

-- This script creates the missing stored procedures from requirements
-- Compatible with MySQL Workbench
-- Run this script in MySQL Workbench

USE electronics_store;


-- 1. CREATE ORDER FROM CART

-- Creates a new order from the user's cart and saves all related items
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
    
    -- Cursor to iterate through cart items
    DECLARE cart_cursor CURSOR FOR
        SELECT c.product_id, c.quantity, p.price
        FROM cart c
        INNER JOIN products p ON c.product_id = p.product_id
        WHERE c.user_id = p_user_id AND c.branch_id = p_branch_id;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
    
    -- Set audit user for triggers
    SET @audit_user_id = p_user_id_for_audit;
    
    -- Start transaction
    START TRANSACTION;
    
    -- Check if cart has items
    SELECT COUNT(*) INTO v_cart_item_count
    FROM cart
    WHERE user_id = p_user_id AND branch_id = p_branch_id;
    
    IF v_cart_item_count = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cart is empty';
    END IF;
    
    -- Calculate total amount
    SELECT COALESCE(SUM(c.quantity * p.price), 0) INTO v_total_amount
    FROM cart c
    INNER JOIN products p ON c.product_id = p.product_id
    WHERE c.user_id = p_user_id AND c.branch_id = p_branch_id;
    
    -- Create order
    INSERT INTO orders (user_id, total_amount, currency, status, shipping_address, branch_id)
    VALUES (p_user_id, v_total_amount, p_currency, 'pending', p_shipping_address, p_branch_id);
    
    SET v_order_id = LAST_INSERT_ID();
    
    -- Add order items from cart
    OPEN cart_cursor;
    
    read_loop: LOOP
        FETCH cart_cursor INTO v_product_id, v_quantity, v_unit_price;
        IF v_done THEN
            LEAVE read_loop;
        END IF;
        
        -- Insert order item (triggers will calculate subtotal and update order total)
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
        VALUES (v_order_id, v_product_id, v_quantity, v_unit_price, v_quantity * v_unit_price);
    END LOOP;
    
    CLOSE cart_cursor;
    
    -- Create payment record
    INSERT INTO payments (order_id, payment_method, payment_status, amount, currency)
    VALUES (v_order_id, p_payment_method, 'pending', v_total_amount, p_currency);
    
    -- Clear cart (optional - you might want to keep items until payment is confirmed)
    -- DELETE FROM cart WHERE user_id = p_user_id AND branch_id = p_branch_id;
    
    COMMIT;
    
    SELECT v_order_id AS order_id, 'Order created successfully' AS message;
END$$

DELIMITER ;


-- 2. ADD PRODUCT TO ORDER

-- Adds a specific product to an existing order and recalculates totals
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
    
    -- Set audit user for triggers
    SET @audit_user_id = p_user_id;
    
    -- Check if order exists and can be modified
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
    
    -- Check if product already exists in order
    SELECT order_item_id INTO v_existing_item_id
    FROM order_items
    WHERE order_id = p_order_id AND product_id = p_product_id
    LIMIT 1;
    
    IF v_existing_item_id IS NOT NULL THEN
        -- Update existing item quantity
        UPDATE order_items
        SET quantity = quantity + p_quantity
        WHERE order_item_id = v_existing_item_id;
    ELSE
        -- Add new item (triggers will calculate subtotal and update order total)
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
        VALUES (p_order_id, p_product_id, p_quantity, p_unit_price, p_quantity * p_unit_price);
    END IF;
    
    SELECT 'Product added to order successfully' AS message;
END$$

DELIMITER ;


-- 3. RECORD CUSTOMER PAYMENT

-- Records a customer payment and updates the order's payment status
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
    
    -- Set audit user for triggers
    SET @audit_user_id = p_user_id;
    
    -- Check if payment already exists
    SELECT COUNT(*) INTO v_payment_exists
    FROM payments
    WHERE order_id = p_order_id;
    
    IF v_payment_exists > 0 THEN
        -- Update existing payment
        UPDATE payments
        SET payment_method = p_payment_method,
            amount = p_amount,
            currency = p_currency,
            transaction_id = p_transaction_id,
            payment_status = 'completed',
            payment_date = NOW()
        WHERE order_id = p_order_id;
    ELSE
        -- Create new payment record
        INSERT INTO payments (order_id, payment_method, payment_status, amount, currency, transaction_id, payment_date)
        VALUES (p_order_id, p_payment_method, 'completed', p_amount, p_currency, p_transaction_id, NOW());
    END IF;
    
    -- Update order status to processing
    UPDATE orders
    SET status = 'processing'
    WHERE order_id = p_order_id;
    
    SELECT 'Payment recorded successfully' AS message;
END$$

DELIMITER ;


-- 4. VALIDATE AND UPDATE ORDER STATUS

-- Validates and updates the order status step-by-step (Pending → Processing → Shipped → Delivered)
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
    
    -- Set audit user for triggers
    SET @audit_user_id = p_user_id;
    
    -- Get current order status
    SELECT status INTO v_current_status
    FROM orders
    WHERE order_id = p_order_id;
    
    IF v_current_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Order not found';
    END IF;
    
    -- Validate status transition
    IF v_current_status = 'cancelled' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot change status of cancelled order';
    END IF;
    
    IF v_current_status = 'delivered' AND p_new_status != 'delivered' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot change status of delivered order';
    END IF;
    
    -- Validate status progression
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
    
    -- Check payment status for processing
    IF p_new_status = 'processing' THEN
        SELECT payment_status INTO v_payment_status
        FROM payments
        WHERE order_id = p_order_id;
        
        IF v_payment_status != 'completed' THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Order cannot be processed until payment is completed';
        END IF;
    END IF;
    
    -- Update order status (trigger will log the change)
    UPDATE orders
    SET status = p_new_status,
        updated_at = NOW()
    WHERE order_id = p_order_id;
    
    SELECT 'Order status updated successfully' AS message;
END$$

DELIMITER ;


-- 5. ADD STOCK TO BRANCH

-- Adds new product stock to a specific branch (e.g., for restocking or new shipment)
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
    
    -- Set audit user for triggers
    SET @audit_user_id = p_user_id;
    
    -- Validate inputs
    IF p_quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Quantity must be greater than zero';
    END IF;
    
    -- Check if inventory entry exists
    SELECT stock_qty INTO v_existing_stock
    FROM product_inventory
    WHERE product_id = p_product_id AND branch_id = p_branch_id;
    
    IF v_existing_stock IS NULL THEN
        -- Create new inventory entry
        INSERT INTO product_inventory (product_id, branch_id, stock_qty)
        VALUES (p_product_id, p_branch_id, p_quantity);
    ELSE
        -- Update existing inventory
        UPDATE product_inventory
        SET stock_qty = stock_qty + p_quantity
        WHERE product_id = p_product_id AND branch_id = p_branch_id;
    END IF;
    
    -- Log the addition
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


-- 6. ADJUST BRANCH INVENTORY

-- Adjusts branch inventory levels for reasons like damaged or missing items
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
    
    -- Set audit user for triggers
    SET @audit_user_id = p_user_id;
    
    -- Get current stock
    SELECT COALESCE(stock_qty, 0) INTO v_current_stock
    FROM product_inventory
    WHERE product_id = p_product_id AND branch_id = p_branch_id;
    
    IF v_current_stock IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Inventory entry not found for this product and branch';
    END IF;
    
    -- Calculate new stock
    SET v_new_stock = v_current_stock + p_adjustment_quantity;
    
    -- Validate new stock is not negative
    IF v_new_stock < 0 THEN
        SET v_error_message = CONCAT('Adjustment would result in negative stock. Current: ', v_current_stock, ', Adjustment: ', p_adjustment_quantity);
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = v_error_message;
    END IF;
    
    -- Update inventory
    UPDATE product_inventory
    SET stock_qty = v_new_stock
    WHERE product_id = p_product_id AND branch_id = p_branch_id;
    
    -- Log the adjustment
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


-- 7. GET CUSTOMER PURCHASE HISTORY

-- Displays all orders and items purchased by a particular customer within a date range
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


-- 8. INSERT OR UPDATE PRODUCT REVIEW

-- Inserts or updates a product review made by a customer
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
    
    -- Validate rating
    IF p_rating < 1 OR p_rating > 5 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Rating must be between 1 and 5';
    END IF;
    
    -- Check if review already exists (UNIQUE constraint should prevent this, but we check anyway)
    SELECT review_id INTO v_existing_review
    FROM reviews
    WHERE user_id = p_user_id AND product_id = p_product_id
    LIMIT 1;
    
    IF v_existing_review IS NOT NULL THEN
        -- Update existing review
        UPDATE reviews
        SET rating = p_rating,
            comment = p_comment,
            created_at = NOW()
        WHERE review_id = v_existing_review;
        
        SET v_review_id = v_existing_review;
    ELSE
        -- Insert new review
        INSERT INTO reviews (user_id, product_id, rating, comment)
        VALUES (p_user_id, p_product_id, p_rating, p_comment);
        
        SET v_review_id = LAST_INSERT_ID();
    END IF;
    
    SELECT v_review_id AS review_id, 'Review saved successfully' AS message;
END$$

DELIMITER ;


-- VERIFY STORED PROCEDURES

SELECT 'All missing stored procedures created successfully!' AS Status;

SELECT 
    ROUTINE_NAME AS 'Procedure Name',
    ROUTINE_TYPE AS 'Type'
FROM INFORMATION_SCHEMA.ROUTINES
WHERE ROUTINE_SCHEMA = 'electronics_store'
AND ROUTINE_TYPE = 'PROCEDURE'
ORDER BY ROUTINE_NAME;

SELECT COUNT(*) AS total_procedures 
FROM INFORMATION_SCHEMA.ROUTINES 
WHERE ROUTINE_SCHEMA = 'electronics_store' 
AND ROUTINE_TYPE = 'PROCEDURE';

