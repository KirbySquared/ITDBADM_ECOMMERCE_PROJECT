-- ========================================
-- ADD CURRENCY SUPPORT TO ORDERS TABLE
-- ========================================
-- This migration adds currency support to the orders table
-- Run this script on existing databases to add currency column

USE electronics_store;

-- Add currency column to orders table
ALTER TABLE orders 
ADD COLUMN currency ENUM('USD', 'PHP', 'KRW', 'JPY', 'EUR', 'GBP', 'CAD', 'AUD') DEFAULT 'USD' 
AFTER total_amount;

-- Update existing orders to have USD as default currency
UPDATE orders SET currency = 'USD' WHERE currency IS NULL;

-- Verify the changes
DESCRIBE orders;

-- Show sample orders with currency
SELECT order_id, total_amount, currency, status, created_at 
FROM orders 
LIMIT 5;

SELECT 'Currency support successfully added to orders table!' AS Status;
