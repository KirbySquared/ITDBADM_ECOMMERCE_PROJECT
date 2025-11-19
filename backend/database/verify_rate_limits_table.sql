-- ========================================
-- VERIFY RATE_LIMITS TABLE EXISTS
-- ========================================
-- Run this to check if rate_limits table exists and create it if missing

USE electronics_store;

-- Check if table exists
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN 'Table rate_limits EXISTS'
        ELSE 'Table rate_limits DOES NOT EXIST - Creating it now...'
    END AS status
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
AND table_name = 'rate_limits';

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS rate_limits (
    limit_id INT PRIMARY KEY AUTO_INCREMENT,
    identifier VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    attempts INT NOT NULL DEFAULT 1,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_identifier_action (identifier, action),
    INDEX idx_expires_at (expires_at),
    INDEX idx_identifier_action (identifier, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify table structure
DESCRIBE rate_limits;

-- Show current rate limits (if any)
SELECT * FROM rate_limits ORDER BY created_at DESC LIMIT 10;

SELECT 'Rate limits table verified!' AS Status;

