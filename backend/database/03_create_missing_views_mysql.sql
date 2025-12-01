
-- CREATE MISSING DATABASE VIEWS FROM PROPOSAL

-- This script creates all missing database views required by the proposal
-- Compatible with MySQL Workbench
-- Run this script in MySQL Workbench

USE electronics_store;


-- 1. PRODUCT CATALOG VIEW

-- Displays all products with category name, price, and available stock
DROP VIEW IF EXISTS v_product_catalog;

CREATE VIEW v_product_catalog AS
SELECT 
    p.product_id,
    p.product_name,
    p.brand,
    p.model,
    p.description,
    p.price AS price_php,
    c.category_id,
    c.category_name,
    g.genre_id,
    g.genre_name,
    COALESCE(SUM(pi.stock_qty), 0) AS total_stock_quantity,
    COUNT(DISTINCT pi.branch_id) AS branches_with_stock,
    p.specifications,
    p.created_at,
    p.updated_at
FROM products p
INNER JOIN categories c ON p.category_id = c.category_id
LEFT JOIN genres g ON p.genre_id = g.genre_id
LEFT JOIN product_inventory pi ON p.product_id = pi.product_id
GROUP BY 
    p.product_id, 
    p.product_name, 
    p.brand, 
    p.model, 
    p.description, 
    p.price, 
    c.category_id, 
    c.category_name,
    g.genre_id,
    g.genre_name,
    p.specifications,
    p.created_at,
    p.updated_at;


-- 2. PRODUCT AVAILABILITY PER BRANCH VIEW

-- Lists product availability per branch (e.g., Makati vs Cebu)
DROP VIEW IF EXISTS v_product_availability_by_branch;

CREATE VIEW v_product_availability_by_branch AS
SELECT 
    p.product_id,
    p.product_name,
    p.brand,
    p.model,
    c.category_name,
    b.branch_id,
    b.branch_name,
    b.address AS branch_address,
    COALESCE(pi.stock_qty, 0) AS stock_quantity,
    CASE 
        WHEN COALESCE(pi.stock_qty, 0) = 0 THEN 'Out of Stock'
        WHEN COALESCE(pi.stock_qty, 0) < 3 THEN 'Low Stock'
        ELSE 'In Stock'
    END AS availability_status,
    p.price AS price_php
FROM products p
INNER JOIN categories c ON p.category_id = c.category_id
CROSS JOIN branches b
LEFT JOIN product_inventory pi ON p.product_id = pi.product_id AND pi.branch_id = b.branch_id
ORDER BY p.product_name, b.branch_name;


-- 3. BRANCH INVENTORY LEVELS VIEW

-- Provides real-time branch inventory levels and highlights low-stock items
DROP VIEW IF EXISTS v_branch_inventory_levels;

CREATE VIEW v_branch_inventory_levels AS
SELECT 
    b.branch_id,
    b.branch_name,
    b.address AS branch_address,
    p.product_id,
    p.product_name,
    p.brand,
    p.model,
    c.category_name,
    COALESCE(pi.stock_qty, 0) AS stock_quantity,
    CASE 
        WHEN COALESCE(pi.stock_qty, 0) = 0 THEN 'Out of Stock'
        WHEN COALESCE(pi.stock_qty, 0) < 3 THEN 'Low Stock'
        WHEN COALESCE(pi.stock_qty, 0) < 10 THEN 'Medium Stock'
        ELSE 'Well Stocked'
    END AS stock_status,
    p.price AS price_php,
    COALESCE(SUM(oi.quantity), 0) AS total_sold,
    COUNT(DISTINCT o.order_id) AS total_orders
FROM branches b
CROSS JOIN products p
LEFT JOIN product_inventory pi ON p.product_id = pi.product_id AND pi.branch_id = b.branch_id
LEFT JOIN categories c ON p.category_id = c.category_id
LEFT JOIN order_items oi ON p.product_id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.order_id AND o.status != 'cancelled'
LEFT JOIN payments pay ON o.order_id = pay.order_id AND pay.payment_status = 'completed'
GROUP BY 
    b.branch_id, 
    b.branch_name, 
    b.address,
    p.product_id, 
    p.product_name, 
    p.brand, 
    p.model, 
    c.category_name,
    pi.stock_qty,
    p.price
ORDER BY b.branch_name, p.product_name;


-- 4. DAILY SALES TOTALS VIEW

-- Shows daily sales totals per branch and per currency for reporting
DROP VIEW IF EXISTS v_daily_sales_totals;

CREATE VIEW v_daily_sales_totals AS
SELECT 
    DATE(o.order_date) AS sale_date,
    b.branch_id,
    b.branch_name,
    o.currency,
    COUNT(DISTINCT o.order_id) AS total_orders,
    COUNT(DISTINCT o.user_id) AS total_customers,
    SUM(o.total_amount) AS total_revenue,
    AVG(o.total_amount) AS average_order_value,
    MIN(o.total_amount) AS min_order_value,
    MAX(o.total_amount) AS max_order_value,
    SUM(oi.quantity) AS total_items_sold
FROM orders o
INNER JOIN payments pay ON o.order_id = pay.order_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN branches b ON o.branch_id = b.branch_id
WHERE pay.payment_status = 'completed'
AND o.status != 'cancelled'
GROUP BY 
    DATE(o.order_date), 
    b.branch_id, 
    b.branch_name, 
    o.currency
ORDER BY sale_date DESC, b.branch_name, o.currency;


-- 5. ORDER SUMMARY VIEW

-- Provides a summarized view of each order, including total items, total amount, and customer information
DROP VIEW IF EXISTS v_order_summary;

CREATE VIEW v_order_summary AS
SELECT 
    o.order_id,
    o.user_id,
    u.username,
    u.first_name,
    u.last_name,
    u.email,
    u.phone,
    o.order_date,
    o.total_amount,
    o.currency,
    o.status AS order_status,
    o.shipping_address,
    COUNT(DISTINCT oi.order_item_id) AS total_items,
    SUM(oi.quantity) AS total_quantity,
    pay.payment_method,
    pay.payment_status,
    pay.amount AS payment_amount,
    pay.payment_date,
    b.branch_id,
    b.branch_name,
    o.created_at,
    o.updated_at
FROM orders o
INNER JOIN users u ON o.user_id = u.user_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN payments pay ON o.order_id = pay.order_id
LEFT JOIN branches b ON o.branch_id = b.branch_id
GROUP BY 
    o.order_id, 
    o.user_id, 
    u.username, 
    u.first_name, 
    u.last_name, 
    u.email, 
    u.phone,
    o.order_date, 
    o.total_amount, 
    o.currency, 
    o.status, 
    o.shipping_address,
    pay.payment_method, 
    pay.payment_status, 
    pay.amount, 
    pay.payment_date,
    b.branch_id, 
    b.branch_name,
    o.created_at, 
    o.updated_at
ORDER BY o.order_date DESC;


-- 6. ORDER DETAILS VIEW

-- Displays detailed order lines including product names, quantities, and subtotals
DROP VIEW IF EXISTS v_order_details;

CREATE VIEW v_order_details AS
SELECT 
    o.order_id,
    o.order_date,
    o.status AS order_status,
    o.total_amount AS order_total,
    o.currency,
    oi.order_item_id,
    oi.product_id,
    p.product_name,
    p.brand,
    p.model,
    c.category_name,
    oi.quantity,
    oi.unit_price,
    oi.subtotal,
    u.user_id,
    u.first_name AS customer_first_name,
    u.last_name AS customer_last_name,
    u.email AS customer_email,
    b.branch_id,
    b.branch_name
FROM orders o
INNER JOIN order_items oi ON o.order_id = oi.order_id
INNER JOIN products p ON oi.product_id = p.product_id
INNER JOIN categories c ON p.category_id = c.category_id
INNER JOIN users u ON o.user_id = u.user_id
LEFT JOIN branches b ON o.branch_id = b.branch_id
ORDER BY o.order_date DESC, o.order_id, oi.order_item_id;


-- 7. ORDER DASHBOARD VIEW

-- Combines order, customer, branch, and payment data for admin dashboards
DROP VIEW IF EXISTS v_order_dashboard;

CREATE VIEW v_order_dashboard AS
SELECT 
    o.order_id,
    o.order_date,
    o.status AS order_status,
    o.total_amount,
    o.currency,
    o.shipping_address,
    -- Customer Info
    u.user_id,
    u.username,
    u.first_name,
    u.last_name,
    u.email,
    u.phone,
    -- Branch Info
    b.branch_id,
    b.branch_name,
    b.address AS branch_address,
    -- Payment Info
    pay.payment_id,
    pay.payment_method,
    pay.payment_status,
    pay.amount AS payment_amount,
    pay.transaction_id,
    pay.payment_date,
    -- Order Statistics
    COUNT(DISTINCT oi.order_item_id) AS item_count,
    SUM(oi.quantity) AS total_quantity,
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
    b.branch_id, 
    b.branch_name, 
    b.address,
    pay.payment_id, 
    pay.payment_method, 
    pay.payment_status, 
    pay.amount, 
    pay.transaction_id, 
    pay.payment_date,
    o.created_at, 
    o.updated_at
ORDER BY o.order_date DESC;


-- 8. TOP-RATED PRODUCTS VIEW

-- Lists top-rated products with average ratings and review counts
DROP VIEW IF EXISTS v_top_rated_products;

CREATE VIEW v_top_rated_products AS
SELECT 
    p.product_id,
    p.product_name,
    p.brand,
    p.model,
    c.category_name,
    AVG(r.rating) AS average_rating,
    COUNT(r.review_id) AS review_count,
    SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) AS five_star_count,
    SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) AS four_star_count,
    SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) AS three_star_count,
    SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) AS two_star_count,
    SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) AS one_star_count,
    p.price AS price_php,
    COALESCE(SUM(pi.stock_qty), 0) AS total_stock
FROM products p
INNER JOIN categories c ON p.category_id = c.category_id
LEFT JOIN reviews r ON p.product_id = r.product_id
LEFT JOIN product_inventory pi ON p.product_id = pi.product_id
GROUP BY 
    p.product_id, 
    p.product_name, 
    p.brand, 
    p.model, 
    c.category_name,
    p.price
HAVING review_count > 0
ORDER BY average_rating DESC, review_count DESC;


-- 9. LOW STOCK ALERTS VIEW

-- Highlights low-stock or out-of-stock products for quick monitoring
DROP VIEW IF EXISTS v_low_stock_alerts;

CREATE VIEW v_low_stock_alerts AS
SELECT 
    p.product_id,
    p.product_name,
    p.brand,
    p.model,
    c.category_name,
    b.branch_id,
    b.branch_name,
    COALESCE(pi.stock_qty, 0) AS stock_quantity,
    CASE 
        WHEN COALESCE(pi.stock_qty, 0) = 0 THEN 'Out of Stock'
        WHEN COALESCE(pi.stock_qty, 0) < 3 THEN 'Critical Low Stock'
        WHEN COALESCE(pi.stock_qty, 0) < 10 THEN 'Low Stock'
        ELSE 'Adequate Stock'
    END AS alert_level,
    p.price AS price_php,
    pi.updated_at AS last_updated
FROM products p
INNER JOIN categories c ON p.category_id = c.category_id
CROSS JOIN branches b
LEFT JOIN product_inventory pi ON p.product_id = pi.product_id AND pi.branch_id = b.branch_id
WHERE COALESCE(pi.stock_qty, 0) < 10
ORDER BY 
    CASE 
        WHEN COALESCE(pi.stock_qty, 0) = 0 THEN 1
        WHEN COALESCE(pi.stock_qty, 0) < 3 THEN 2
        ELSE 3
    END,
    b.branch_name,
    p.product_name;


-- 10. CUSTOMER PURCHASE SUMMARY VIEW

-- Shows each customer's lifetime purchase value and order history summary
DROP VIEW IF EXISTS v_customer_purchase_summary;

CREATE VIEW v_customer_purchase_summary AS
SELECT 
    u.user_id,
    u.username,
    u.first_name,
    u.last_name,
    u.email,
    u.phone,
    COUNT(DISTINCT o.order_id) AS total_orders,
    SUM(CASE WHEN pay.payment_status = 'completed' AND o.status != 'cancelled' THEN o.total_amount ELSE 0 END) AS total_spent,
    AVG(CASE WHEN pay.payment_status = 'completed' AND o.status != 'cancelled' THEN o.total_amount ELSE NULL END) AS average_order_value,
    MIN(o.order_date) AS first_order_date,
    MAX(o.order_date) AS last_order_date,
    COUNT(DISTINCT oi.product_id) AS unique_products_purchased,
    SUM(CASE WHEN pay.payment_status = 'completed' AND o.status != 'cancelled' THEN oi.quantity ELSE 0 END) AS total_items_purchased,
    u.created_at AS customer_since
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN payments pay ON o.order_id = pay.order_id
WHERE u.role = 'user'  -- Only customers, not staff/admin
GROUP BY 
    u.user_id, 
    u.username, 
    u.first_name, 
    u.last_name, 
    u.email, 
    u.phone,
    u.created_at
ORDER BY total_spent DESC;


-- VERIFY VIEWS

SELECT 'Views created successfully!' AS Status;
SELECT COUNT(*) AS total_views 
FROM information_schema.views 
WHERE table_schema = 'electronics_store';



