-- ========================================
-- REMOVE IMAGE_URL COLUMN FROM PRODUCTS TABLE
-- ========================================
-- This migration removes the image_url column from products table
-- since we're now using the product_images table for multiple images

USE electronics_store;

-- Remove the image_url column from products table
ALTER TABLE products DROP COLUMN image_url;

-- Verify the change
DESCRIBE products;

-- Show that product_images table still exists
DESCRIBE product_images;

SELECT 'image_url column successfully removed from products table!' AS Status;