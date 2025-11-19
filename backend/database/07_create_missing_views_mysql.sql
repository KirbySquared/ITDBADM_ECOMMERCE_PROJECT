-- ========================================
-- CREATE MISSING DATABASE VIEWS
-- ========================================
-- This script creates the missing views from requirements
-- Compatible with MySQL Workbench
-- Run this script in MySQL Workbench

USE electronics_store;

-- ========================================
-- 1. MULTI-CURRENCY PRODUCT PRICES VIEW
-- ========================================
-- Shows product prices in multiple currencies (PHP, USD, KRW) using the latest exchange rates
-- Note: This view shows base PHP prices. Actual currency conversion is handled dynamically in PHP via API
-- This view is for reference only - real-time rates come from the currency API
DROP VIEW IF EXISTS v_product_prices_multi_currency;

CREATE VIEW v_product_prices_multi_currency AS
SELECT 
    p.product_id,
    p.product_name,
    p.brand,
    p.model,
    c.category_name,
    p.price AS price_php,
    'PHP' AS currency_php,
    -- Note: Actual currency conversion happens in PHP using real-time API rates
    -- These are placeholder columns showing the base PHP price
    p.price AS base_price_php,
    COALESCE(SUM(pi.stock_qty), 0) AS total_stock_quantity,
    COUNT(DISTINCT pi.branch_id) AS branches_with_stock
FROM products p
INNER JOIN categories c ON p.category_id = c.category_id
LEFT JOIN product_inventory pi ON p.product_id = pi.product_id
GROUP BY 
    p.product_id, 
    p.product_name, 
    p.brand, 
    p.model, 
    c.category_name,
    p.price
ORDER BY p.product_name;

-- ========================================
-- 2. ORDER STATUS TIMELINE VIEW
-- ========================================
-- Shows a timeline of status changes for each order (used for tracking)
-- Note: This view uses transaction_log to track order status changes
-- If order_status_history table exists, use that instead
DROP VIEW IF EXISTS v_order_status_timeline;

CREATE VIEW v_order_status_timeline AS
SELECT 
    o.order_id,
    o.user_id,
    u.first_name,
    u.last_name,
    u.email,
    o.order_date,
    o.status AS current_status,
    o.total_amount,
    o.currency,
    -- Get status change history from transaction_log
    tl.created_at AS status_change_date,
    JSON_EXTRACT(tl.meta, '$.old_status') AS old_status,
    JSON_EXTRACT(tl.meta, '$.new_status') AS new_status,
    tl.performed_by AS changed_by_user_id,
    u2.username AS changed_by_username,
    tl.action AS change_action
FROM orders o
INNER JOIN users u ON o.user_id = u.user_id
LEFT JOIN transaction_log tl ON tl.entity = 'order' AND tl.entity_id = o.order_id 
    AND (tl.action = 'status_changed' OR tl.action LIKE '%status%')
LEFT JOIN users u2 ON tl.performed_by = u2.user_id
ORDER BY o.order_id, tl.created_at DESC;

-- Alternative: If you have a dedicated order_status_history table, use this instead:
/*
CREATE VIEW v_order_status_timeline AS
SELECT 
    o.order_id,
    o.user_id,
    u.first_name,
    u.last_name,
    u.email,
    o.order_date,
    o.status AS current_status,
    o.total_amount,
    o.currency,
    osh.status AS status_at_time,
    osh.changed_at,
    osh.changed_by,
    u2.username AS changed_by_username,
    osh.notes
FROM orders o
INNER JOIN users u ON o.user_id = u.user_id
LEFT JOIN order_status_history osh ON o.order_id = osh.order_id
LEFT JOIN users u2 ON osh.changed_by = u2.user_id
ORDER BY o.order_id, osh.changed_at DESC;
*/

-- ========================================
-- 3. ORDERS WITH PAYMENT DETAILS VIEW
-- ========================================
-- Displays all orders with their payment details and payment completion status
-- This is a more focused view than v_order_dashboard, specifically for payment tracking
DROP VIEW IF EXISTS v_orders_with_payment_details;

CREATE VIEW v_orders_with_payment_details AS
SELECT 
    o.order_id,
    o.order_date,
    o.status AS order_status,
    o.total_amount AS order_total,
    o.currency,
    o.shipping_address,
    -- Customer Info
    u.user_id,
    u.username,
    u.first_name,
    u.last_name,
    u.email,
    u.phone,
    -- Payment Details
    pay.payment_id,
    pay.payment_method,
    pay.payment_status,
    pay.amount AS payment_amount,
    pay.currency AS payment_currency,
    pay.transaction_id,
    pay.payment_date,
    -- Payment Status Indicators
    CASE 
        WHEN pay.payment_status = 'completed' THEN 'Paid'
        WHEN pay.payment_status = 'pending' THEN 'Pending Payment'
        WHEN pay.payment_status = 'failed' THEN 'Payment Failed'
        WHEN pay.payment_status = 'refunded' THEN 'Refunded'
        ELSE 'No Payment Record'
    END AS payment_status_display,
    -- Order Statistics
    COUNT(DISTINCT oi.order_item_id) AS item_count,
    SUM(oi.quantity) AS total_quantity,
    -- Branch Info
    b.branch_id,
    b.branch_name,
    -- Timestamps
    o.created_at,
    o.updated_at
FROM orders o
INNER JOIN users u ON o.user_id = u.user_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN payments pay ON o.order_id = pay.order_id
LEFT JOIN branches b ON o.branch_id = b.branch_id
GROUP BY 
    o.order_id, 
    o.order_date, 
    o.status, 
    o.total_amount, 
    o.currency, 
    o.shipping_address,
    u.user_id, 
    u.username, 
    u.first_name, 
    u.last_name, 
    u.email, 
    u.phone,
    pay.payment_id, 
    pay.payment_method, 
    pay.payment_status, 
    pay.amount, 
    pay.currency, 
    pay.transaction_id, 
    pay.payment_date,
    b.branch_id, 
    b.branch_name,
    o.created_at, 
    o.updated_at
ORDER BY o.order_date DESC;

-- ========================================
-- 4. SHOPPING CART VIEW
-- ========================================
-- Lists all items currently in customers' shopping carts with product details
-- Useful for analytics, abandoned cart reports, and cart management
DROP VIEW IF EXISTS v_shopping_cart_details;

CREATE VIEW v_shopping_cart_details AS
SELECT 
    c.cart_id,
    c.user_id,
    u.username,
    u.first_name,
    u.last_name,
    u.email,
    c.product_id,
    p.product_name,
    p.brand,
    p.model,
    c.quantity AS cart_quantity,
    c.branch_id,
    b.branch_name,
    p.price AS price_php,
    (c.quantity * p.price) AS line_total_php,
    c.added_at AS added_to_cart_date,
    -- Stock Information
    COALESCE(pi.stock_qty, 0) AS available_stock,
    CASE 
        WHEN COALESCE(pi.stock_qty, 0) = 0 THEN 'Out of Stock'
        WHEN COALESCE(pi.stock_qty, 0) < c.quantity THEN 'Insufficient Stock'
        ELSE 'In Stock'
    END AS stock_status,
    -- Product Category
    cat.category_name,
    -- Days in cart
    DATEDIFF(NOW(), c.added_at) AS days_in_cart,
    -- Primary product image
    (SELECT image_url 
     FROM product_images 
     WHERE product_id = p.product_id AND is_primary = TRUE 
     ORDER BY sort_order, created_at LIMIT 1) AS primary_image_url
FROM cart c
INNER JOIN users u ON c.user_id = u.user_id
INNER JOIN products p ON c.product_id = p.product_id
LEFT JOIN categories cat ON p.category_id = cat.category_id
LEFT JOIN branches b ON c.branch_id = b.branch_id
LEFT JOIN product_inventory pi ON p.product_id = pi.product_id AND pi.branch_id = c.branch_id
ORDER BY c.added_at DESC, u.user_id, c.cart_id;

-- ========================================
-- 5. TRANSACTION LOG ACTIVITIES VIEW
-- ========================================
-- Displays recent staff and admin activities recorded in the transaction log
-- Useful for audit trails and activity monitoring
DROP VIEW IF EXISTS v_transaction_log_activities;

CREATE VIEW v_transaction_log_activities AS
SELECT 
    tl.id AS log_id,
    tl.entity,
    tl.entity_id,
    tl.action,
    tl.meta,
    tl.performed_by,
    u.username AS performed_by_username,
    u.first_name AS performed_by_first_name,
    u.last_name AS performed_by_last_name,
    u.role AS performed_by_role,
    tl.created_at AS activity_date,
    -- Parse common meta fields
    JSON_EXTRACT(tl.meta, '$.description') AS activity_description,
    JSON_EXTRACT(tl.meta, '$.old_value') AS old_value,
    JSON_EXTRACT(tl.meta, '$.new_value') AS new_value,
    JSON_EXTRACT(tl.meta, '$.reason') AS reason,
    -- Activity type categorization
    CASE 
        WHEN tl.action LIKE '%create%' OR tl.action LIKE '%insert%' THEN 'Creation'
        WHEN tl.action LIKE '%update%' OR tl.action LIKE '%modify%' THEN 'Modification'
        WHEN tl.action LIKE '%delete%' OR tl.action LIKE '%remove%' THEN 'Deletion'
        WHEN tl.action LIKE '%status%' OR tl.action LIKE '%change%' THEN 'Status Change'
        WHEN tl.action LIKE '%transfer%' OR tl.action LIKE '%move%' THEN 'Transfer'
        WHEN tl.action LIKE '%payment%' OR tl.action LIKE '%transaction%' THEN 'Payment'
        ELSE 'Other'
    END AS activity_type,
    -- Time since activity
    TIMESTAMPDIFF(HOUR, tl.created_at, NOW()) AS hours_ago,
    TIMESTAMPDIFF(DAY, tl.created_at, NOW()) AS days_ago
FROM transaction_log tl
LEFT JOIN users u ON tl.performed_by = u.user_id
WHERE u.role IN ('admin', 'staff')  -- Only show staff/admin activities
ORDER BY tl.created_at DESC;

-- Alternative: If you have an audit_logs table instead, use this:
/*
CREATE VIEW v_transaction_log_activities AS
SELECT 
    al.log_id,
    al.user_id,
    u.username,
    u.first_name,
    u.last_name,
    u.role,
    al.category,
    al.description,
    al.created_at AS activity_date,
    TIMESTAMPDIFF(HOUR, al.created_at, NOW()) AS hours_ago,
    TIMESTAMPDIFF(DAY, al.created_at, NOW()) AS days_ago
FROM audit_logs al
INNER JOIN users u ON al.user_id = u.user_id
WHERE u.role IN ('admin', 'staff')
ORDER BY al.created_at DESC;
*/

-- ========================================
-- VERIFY VIEWS
-- ========================================
SELECT 'Missing views created successfully!' AS Status;

SELECT 
    TABLE_NAME AS 'View Name',
    VIEW_DEFINITION AS 'Definition'
FROM INFORMATION_SCHEMA.VIEWS
WHERE TABLE_SCHEMA = 'electronics_store'
AND TABLE_NAME IN (
    'v_product_prices_multi_currency',
    'v_order_status_timeline',
    'v_orders_with_payment_details',
    'v_shopping_cart_details',
    'v_transaction_log_activities'
)
ORDER BY TABLE_NAME;

SELECT COUNT(*) AS total_views 
FROM INFORMATION_SCHEMA.VIEWS 
WHERE TABLE_SCHEMA = 'electronics_store';

