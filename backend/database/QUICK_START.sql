-- ========================================
-- QUICK START: Run All Missing Implementation Scripts
-- ========================================
-- This script runs all the missing triggers, stored procedures, and views
-- Run this after your base schema is set up

USE electronics_store;

-- Show current status
SELECT 'Starting implementation of missing triggers, procedures, and views...' AS Status;

-- Run triggers
SOURCE create_missing_triggers.sql;

-- Run stored procedures
SOURCE create_missing_stored_procedures.sql;

-- Run views
SOURCE create_missing_views.sql;

-- Verify everything was created
SELECT '=== VERIFICATION ===' AS Status;

-- Count triggers
SELECT COUNT(*) AS total_triggers FROM information_schema.triggers WHERE trigger_schema = 'electronics_store';

-- Count stored procedures
SELECT COUNT(*) AS total_procedures FROM information_schema.routines WHERE routine_schema = 'electronics_store' AND routine_type = 'PROCEDURE';

-- Count views
SELECT COUNT(*) AS total_views FROM information_schema.views WHERE table_schema = 'electronics_store';

SELECT 'Implementation complete! Check the counts above to verify.' AS Status;



