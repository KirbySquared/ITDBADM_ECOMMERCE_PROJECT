-- ========================================
-- ADD CURRENCY SUPPORT MIGRATION
-- ========================================
-- Run this script to add currency support to existing tables

USE electronics_store;

-- Add currency column to products table
ALTER TABLE products 
ADD COLUMN currency ENUM('USD', 'PHP', 'KRW', 'JPY', 'EUR', 'GBP', 'CAD', 'AUD') DEFAULT 'USD';

-- Add currency column to payments table
ALTER TABLE payments 
ADD COLUMN currency ENUM('USD', 'PHP', 'KRW', 'JPY', 'EUR', 'GBP', 'CAD', 'AUD') DEFAULT 'USD';

-- Update existing products to have USD as default currency
UPDATE products SET currency = 'USD' WHERE currency IS NULL;

-- Update existing payments to have USD as default currency
UPDATE payments SET currency = 'USD' WHERE currency IS NULL;

-- Verify the changes
SELECT 'Products table updated with currency support' AS Status;
SELECT product_id, product_name, price, currency FROM products LIMIT 5;

SELECT 'Payments table updated with currency support' AS Status;
SELECT payment_id, amount, currency FROM payments LIMIT 5;

SELECT 'Currency support migration completed successfully!' AS Status;
