-- ========================================
-- SQL QUERIES: Connecting Sold Items, Orders, Customers, and Reviews
-- ========================================

-- 1. SOLD ITEMS WITH ORDER AND CUSTOMER INFORMATION
-- Shows what was sold, which order it came from, and who bought it
-- ========================================
SELECT 
    oi.order_item_id,
    oi.product_id,
    p.product_name,
    oi.quantity AS sold_quantity,
    oi.unit_price,
    oi.subtotal,
    o.order_id,
    o.order_date,
    o.status AS order_status,
    o.total_amount AS order_total,
    u.user_id,
    u.username,
    u.email,
    u.first_name,
    u.last_name,
    pay.payment_status,
    pay.payment_method
FROM order_items oi
INNER JOIN orders o ON oi.order_id = o.order_id
INNER JOIN users u ON o.user_id = u.user_id
INNER JOIN products p ON oi.product_id = p.product_id
LEFT JOIN payments pay ON pay.order_id = o.order_id
WHERE pay.payment_status = 'completed'  -- Only count completed sales
ORDER BY o.order_date DESC;


-- 2. PRODUCT SALES SUMMARY WITH CUSTOMER COUNT
-- Shows total sold per product and how many unique customers bought it
-- ========================================
SELECT 
    p.product_id,
    p.product_name,
    p.brand,
    SUM(oi.quantity) AS total_sold,
    COUNT(DISTINCT o.user_id) AS unique_customers,
    COUNT(DISTINCT o.order_id) AS total_orders,
    SUM(oi.subtotal) AS total_revenue,
    AVG(oi.unit_price) AS avg_selling_price
FROM order_items oi
INNER JOIN orders o ON oi.order_id = o.order_id
INNER JOIN products p ON oi.product_id = p.product_id
INNER JOIN payments pay ON pay.order_id = o.order_id
WHERE pay.payment_status = 'completed'
GROUP BY p.product_id, p.product_name, p.brand
ORDER BY total_sold DESC;


-- 3. CUSTOMERS WHO BOUGHT AND REVIEWED THE SAME PRODUCT
-- Shows the connection between purchases and reviews
-- ========================================
SELECT 
    u.user_id,
    u.username,
    u.email,
    u.first_name,
    u.last_name,
    p.product_id,
    p.product_name,
    -- Purchase information
    o.order_id,
    o.order_date,
    oi.quantity AS purchased_quantity,
    oi.unit_price AS purchase_price,
    -- Review information
    r.review_id,
    r.rating,
    r.comment,
    r.created_at AS review_date,
    -- Time difference between purchase and review
    DATEDIFF(r.created_at, o.order_date) AS days_between_purchase_and_review
FROM users u
INNER JOIN orders o ON u.user_id = o.user_id
INNER JOIN order_items oi ON o.order_id = oi.order_id
INNER JOIN products p ON oi.product_id = p.product_id
INNER JOIN reviews r ON r.user_id = u.user_id AND r.product_id = p.product_id
INNER JOIN payments pay ON pay.order_id = o.order_id
WHERE pay.payment_status = 'completed'
ORDER BY u.user_id, p.product_id, o.order_date DESC;


-- 4. PRODUCTS WITH SALES, REVIEWS, AND CUSTOMER STATS
-- Comprehensive view connecting all entities
-- ========================================
SELECT 
    p.product_id,
    p.product_name,
    p.brand,
    p.price AS current_price,
    -- Sales statistics
    COALESCE(sales.total_sold, 0) AS total_sold,
    COALESCE(sales.total_revenue, 0) AS total_revenue,
    COALESCE(sales.unique_customers, 0) AS unique_customers,
    COALESCE(sales.total_orders, 0) AS total_orders,
    -- Review statistics
    COALESCE(rev.total_reviews, 0) AS total_reviews,
    COALESCE(rev.average_rating, 0) AS average_rating,
    COALESCE(rev.reviewing_customers, 0) AS reviewing_customers,
    -- Current inventory
    COALESCE(inv.total_stock, 0) AS total_stock
FROM products p
-- Sales subquery
LEFT JOIN (
    SELECT 
        oi.product_id,
        SUM(oi.quantity) AS total_sold,
        SUM(oi.subtotal) AS total_revenue,
        COUNT(DISTINCT o.user_id) AS unique_customers,
        COUNT(DISTINCT o.order_id) AS total_orders
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.order_id
    INNER JOIN payments pay ON pay.order_id = o.order_id
    WHERE pay.payment_status = 'completed'
    GROUP BY oi.product_id
) sales ON sales.product_id = p.product_id
-- Reviews subquery
LEFT JOIN (
    SELECT 
        product_id,
        COUNT(*) AS total_reviews,
        AVG(rating) AS average_rating,
        COUNT(DISTINCT user_id) AS reviewing_customers
    FROM reviews
    GROUP BY product_id
) rev ON rev.product_id = p.product_id
-- Inventory subquery
LEFT JOIN (
    SELECT 
        product_id,
        SUM(stock_qty) AS total_stock
    FROM product_inventory
    GROUP BY product_id
) inv ON inv.product_id = p.product_id
ORDER BY total_sold DESC, average_rating DESC;


-- 5. CUSTOMER PURCHASE AND REVIEW BEHAVIOR
-- Shows which customers buy and review products
-- ========================================
SELECT 
    u.user_id,
    u.username,
    u.email,
    u.first_name,
    u.last_name,
    -- Purchase statistics
    COUNT(DISTINCT o.order_id) AS total_orders,
    COUNT(DISTINCT oi.product_id) AS unique_products_purchased,
    SUM(oi.quantity) AS total_items_purchased,
    SUM(o.total_amount) AS total_spent,
    -- Review statistics
    COUNT(DISTINCT r.review_id) AS total_reviews_written,
    COUNT(DISTINCT r.product_id) AS unique_products_reviewed,
    AVG(r.rating) AS average_rating_given,
    -- Products purchased but not reviewed
    COUNT(DISTINCT oi.product_id) - COUNT(DISTINCT r.product_id) AS products_purchased_not_reviewed
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN payments pay ON pay.order_id = o.order_id AND pay.payment_status = 'completed'
LEFT JOIN reviews r ON r.user_id = u.user_id
GROUP BY u.user_id, u.username, u.email, u.first_name, u.last_name
HAVING total_orders > 0 OR total_reviews_written > 0
ORDER BY total_spent DESC, total_reviews_written DESC;


-- 6. PRODUCTS WITH HIGH SALES BUT NO REVIEWS
-- Identifies products that sell well but lack customer feedback
-- ========================================
SELECT 
    p.product_id,
    p.product_name,
    p.brand,
    sales.total_sold,
    sales.unique_customers,
    sales.total_orders,
    COALESCE(rev.total_reviews, 0) AS total_reviews,
    CASE 
        WHEN rev.total_reviews = 0 THEN 'No reviews'
        ELSE CONCAT('Only ', rev.total_reviews, ' review(s)')
    END AS review_status
FROM products p
INNER JOIN (
    SELECT 
        oi.product_id,
        SUM(oi.quantity) AS total_sold,
        COUNT(DISTINCT o.user_id) AS unique_customers,
        COUNT(DISTINCT o.order_id) AS total_orders
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.order_id
    INNER JOIN payments pay ON pay.order_id = o.order_id
    WHERE pay.payment_status = 'completed'
    GROUP BY oi.product_id
    HAVING SUM(oi.quantity) > 0
) sales ON sales.product_id = p.product_id
LEFT JOIN (
    SELECT 
        product_id,
        COUNT(*) AS total_reviews
    FROM reviews
    GROUP BY product_id
) rev ON rev.product_id = p.product_id
WHERE rev.total_reviews IS NULL OR rev.total_reviews = 0
ORDER BY sales.total_sold DESC;


-- 7. DETAILED VIEW: Order → Customer → Products → Reviews
-- Complete relationship chain
-- ========================================
SELECT 
    -- Order information
    o.order_id,
    o.order_date,
    o.status AS order_status,
    o.total_amount,
    o.currency,
    -- Customer information
    u.user_id,
    u.username,
    u.email,
    CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
    -- Product information
    p.product_id,
    p.product_name,
    p.brand,
    oi.quantity AS order_quantity,
    oi.unit_price,
    oi.subtotal,
    -- Payment information
    pay.payment_status,
    pay.payment_method,
    -- Review information (if customer reviewed this product)
    r.review_id,
    r.rating,
    r.comment AS review_comment,
    r.created_at AS review_date,
    CASE 
        WHEN r.review_id IS NOT NULL THEN 'Yes'
        ELSE 'No'
    END AS has_reviewed
FROM orders o
INNER JOIN users u ON o.user_id = u.user_id
INNER JOIN order_items oi ON o.order_id = oi.order_id
INNER JOIN products p ON oi.product_id = p.product_id
LEFT JOIN payments pay ON pay.order_id = o.order_id
LEFT JOIN reviews r ON r.user_id = u.user_id AND r.product_id = p.product_id
WHERE pay.payment_status = 'completed'
ORDER BY o.order_date DESC, o.order_id, p.product_name;


-- 8. PRODUCT PERFORMANCE: Sales vs Reviews Correlation
-- Shows if products with more sales get more reviews
-- ========================================
SELECT 
    p.product_id,
    p.product_name,
    p.brand,
    -- Sales metrics
    COALESCE(sales.total_sold, 0) AS total_sold,
    COALESCE(sales.unique_customers, 0) AS unique_customers,
    -- Review metrics
    COALESCE(rev.total_reviews, 0) AS total_reviews,
    COALESCE(rev.average_rating, 0) AS average_rating,
    -- Review rate (reviews per 100 sales)
    CASE 
        WHEN COALESCE(sales.total_sold, 0) > 0 
        THEN ROUND((COALESCE(rev.total_reviews, 0) / sales.total_sold) * 100, 2)
        ELSE 0
    END AS review_rate_percentage,
    -- Customer review rate (reviewing customers / total customers)
    CASE 
        WHEN COALESCE(sales.unique_customers, 0) > 0 
        THEN ROUND((COALESCE(rev.reviewing_customers, 0) / sales.unique_customers) * 100, 2)
        ELSE 0
    END AS customer_review_rate_percentage
FROM products p
LEFT JOIN (
    SELECT 
        oi.product_id,
        SUM(oi.quantity) AS total_sold,
        COUNT(DISTINCT o.user_id) AS unique_customers
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.order_id
    INNER JOIN payments pay ON pay.order_id = o.order_id
    WHERE pay.payment_status = 'completed'
    GROUP BY oi.product_id
) sales ON sales.product_id = p.product_id
LEFT JOIN (
    SELECT 
        product_id,
        COUNT(*) AS total_reviews,
        AVG(rating) AS average_rating,
        COUNT(DISTINCT user_id) AS reviewing_customers
    FROM reviews
    GROUP BY product_id
) rev ON rev.product_id = p.product_id
WHERE COALESCE(sales.total_sold, 0) > 0
ORDER BY total_sold DESC, average_rating DESC;

