-- ========================================
-- REMOVE/DISABLE OLD CURRENCY CONVERSION TABLE
-- ========================================
-- This script helps you clean up the old currencies table
-- since we now use API-based conversion
-- 
-- IMPORTANT NOTES:
-- - The order_currency_snapshots table is KEPT (stores historical rates for orders)
-- - The system now uses API first, database only as fallback
-- - You can safely disable or remove the currencies table

USE electronics_store;

-- ========================================
-- OPTION 1: Disable currencies (RECOMMENDED)
-- ========================================
-- This marks all currencies as inactive but keeps the table structure
-- This way you can still use it as a fallback if API fails

UPDATE currencies SET is_active = 0;

SELECT 'Currencies table disabled. System will use API only.' AS status;
SELECT code, rate_to_php, is_active FROM currencies;

-- ========================================
-- OPTION 2: Clear rates but keep structure
-- ========================================
-- Uncomment to clear all rates but keep table structure
-- UPDATE currencies SET rate_to_php = 0, is_active = 0;

-- ========================================
-- OPTION 3: Drop the entire table (ADVANCED)
-- ========================================
-- WARNING: Only do this if you're sure the API is working
-- and you don't want any database fallback
-- 
-- Uncomment the line below to completely remove the table:
-- DROP TABLE IF EXISTS currencies;

-- ========================================
-- VERIFY CHANGES
-- ========================================
-- Check currencies table status
SELECT 
    'Currencies table status' AS info,
    code,
    rate_to_php,
    is_active,
    updated_at
FROM currencies
ORDER BY code;

-- Check order_currency_snapshots (KEEP THIS - it's historical data)
SELECT 
    'Order currency snapshots (DO NOT DELETE)' AS info,
    COUNT(*) AS total_snapshots,
    MIN(created_at) AS oldest_snapshot,
    MAX(created_at) AS newest_snapshot
FROM order_currency_snapshots;

-- ========================================
-- NOTES
-- ========================================
-- 1. order_currency_snapshots table stores historical exchange rates
--    used at the time of order creation. This should NEVER be deleted.
--
-- 2. The currencies table is now only used as a fallback if the API fails.
--    Recommended: Keep it but mark as inactive (Option 1).
--
-- 3. If you drop the table, make sure:
--    - All endpoints are using currency_api.php
--    - The API is working correctly
--    - You have tested the system thoroughly
--
-- 4. The fallback code in currency_api.php will still try to use database
--    if API fails. If you remove the table, the fallback will return null.
