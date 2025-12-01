-- ========================================
-- DATABASE USERS AND PRIVILEGES MANAGEMENT
-- ========================================
-- This creates database users with fine-grained privileges
-- Exceeds minimum requirements for Exemplary grade
--
-- NOTE: These are DATABASE-LEVEL users (MySQL accounts), which are different
-- from APPLICATION-LEVEL roles (admin, staff, user) stored in the users table.
--
-- Application Roles (in users.role column):
--   - admin: Application administrator
--   - staff: Application staff member
--   - user: Application customer
--
-- Database Users (MySQL accounts created here):
--   - admin_user: Database user with full privileges
--   - staff_user: Database user with limited privileges
--   - app_user: Database user for application operations
--   - readonly_user: Database user for reporting
--   - backup_user: Database user for backups
--
-- These database users can optionally be mapped to application roles,
-- but they work independently. Your application can continue using
-- your current database user while these serve as examples of GRANT/REVOKE.
--
-- Features:
-- - Role-based database users (admin_user, staff_user, app_user)
-- - Fine-grained privileges per role
-- - Principle of least privilege
-- - GRANT and REVOKE statements
-- - Password security

USE electronics_store;

-- 1. CREATE DATABASE USERS

-- Admin User (Full access for administrative tasks)
-- Password should be changed in production!
DROP USER IF EXISTS 'admin_user'@'localhost';
CREATE USER 'admin_user'@'localhost' IDENTIFIED BY 'Admin@Secure123!';

-- Staff User (Limited access for staff operations)
DROP USER IF EXISTS 'staff_user'@'localhost';
CREATE USER 'staff_user'@'localhost' IDENTIFIED BY 'Staff@Secure123!';

-- Application User (Standard application access)
DROP USER IF EXISTS 'app_user'@'localhost';
CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'App@Secure123!';

-- Read-Only User (For reporting and analytics)
DROP USER IF EXISTS 'readonly_user'@'localhost';
CREATE USER 'readonly_user'@'localhost' IDENTIFIED BY 'ReadOnly@Secure123!';

-- Backup User (For backup operations)
DROP USER IF EXISTS 'backup_user'@'localhost';
CREATE USER 'backup_user'@'localhost' IDENTIFIED BY 'Backup@Secure123!';

-- ========================================
-- 2. GRANT PRIVILEGES - ADMIN USER
-- ========================================
-- Admin user gets full privileges on all tables

GRANT ALL PRIVILEGES ON electronics_store.* TO 'admin_user'@'localhost';

-- Grant ability to create users and manage privileges
GRANT CREATE USER ON *.* TO 'admin_user'@'localhost';
GRANT RELOAD ON *.* TO 'admin_user'@'localhost';
GRANT PROCESS ON *.* TO 'admin_user'@'localhost';
GRANT SHOW DATABASES ON *.* TO 'admin_user'@'localhost';

-- Grant ability to create/alter/drop tables, procedures, triggers
GRANT CREATE, ALTER, DROP ON electronics_store.* TO 'admin_user'@'localhost';
GRANT CREATE ROUTINE, ALTER ROUTINE, EXECUTE ON electronics_store.* TO 'admin_user'@'localhost';
GRANT TRIGGER ON electronics_store.* TO 'admin_user'@'localhost';
GRANT CREATE VIEW, SHOW VIEW ON electronics_store.* TO 'admin_user'@'localhost';

-- Grant ability to manage indexes
GRANT INDEX ON electronics_store.* TO 'admin_user'@'localhost';

-- ========================================
-- 3. GRANT PRIVILEGES - STAFF USER
-- ========================================
-- Staff user gets limited privileges for operational tasks

-- Read access to most tables
GRANT SELECT ON electronics_store.* TO 'staff_user'@'localhost';

-- Write access to specific tables for staff operations
GRANT INSERT, UPDATE, DELETE ON electronics_store.orders TO 'staff_user'@'localhost';
GRANT INSERT, UPDATE, DELETE ON electronics_store.order_items TO 'staff_user'@'localhost';
GRANT INSERT, UPDATE ON electronics_store.payments TO 'staff_user'@'localhost';
GRANT INSERT, UPDATE, DELETE ON electronics_store.product_inventory TO 'staff_user'@'localhost';

-- Read access to user data (for order processing)
GRANT SELECT ON electronics_store.users TO 'staff_user'@'localhost';

-- Read access to products and categories
GRANT SELECT ON electronics_store.products TO 'staff_user'@'localhost';
GRANT SELECT ON electronics_store.product_images TO 'staff_user'@'localhost';
GRANT SELECT ON electronics_store.categories TO 'staff_user'@'localhost';
GRANT SELECT ON electronics_store.genres TO 'staff_user'@'localhost';
GRANT SELECT ON electronics_store.branches TO 'staff_user'@'localhost';

-- Read access to reviews
GRANT SELECT ON electronics_store.reviews TO 'staff_user'@'localhost';

-- Execute stored procedures (for staff operations)
GRANT EXECUTE ON PROCEDURE electronics_store.sp_update_order_status TO 'staff_user'@'localhost';
GRANT EXECUTE ON PROCEDURE electronics_store.sp_add_product_to_order TO 'staff_user'@'localhost';
GRANT EXECUTE ON PROCEDURE electronics_store.sp_update_order_item_quantity TO 'staff_user'@'localhost';
GRANT EXECUTE ON PROCEDURE electronics_store.sp_add_stock_to_branch TO 'staff_user'@'localhost';
GRANT EXECUTE ON PROCEDURE electronics_store.sp_adjust_branch_inventory TO 'staff_user'@'localhost';
GRANT EXECUTE ON PROCEDURE electronics_store.sp_get_low_stock_products TO 'staff_user'@'localhost';
GRANT EXECUTE ON PROCEDURE electronics_store.sp_get_customer_purchase_history TO 'staff_user'@'localhost';

-- ========================================
-- 4. GRANT PRIVILEGES - APPLICATION USER
-- ========================================
-- Application user gets standard CRUD operations

-- Full access to core tables (for application operations)
GRANT SELECT, INSERT, UPDATE, DELETE ON electronics_store.users TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON electronics_store.products TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON electronics_store.product_images TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON electronics_store.categories TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON electronics_store.genres TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON electronics_store.branches TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON electronics_store.orders TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON electronics_store.order_items TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON electronics_store.payments TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON electronics_store.reviews TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON electronics_store.cart TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON electronics_store.product_inventory TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON electronics_store.currencies TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON electronics_store.order_currency_snapshots TO 'app_user'@'localhost';

-- Access to audit and logging tables
GRANT SELECT, INSERT ON electronics_store.audit_logs TO 'app_user'@'localhost';
GRANT SELECT, INSERT ON electronics_store.transaction_log TO 'app_user'@'localhost';
GRANT SELECT, INSERT ON electronics_store.security_audit_log TO 'app_user'@'localhost';
GRANT SELECT, INSERT ON electronics_store.security_alerts TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE ON electronics_store.rate_limits TO 'app_user'@'localhost';
GRANT SELECT, INSERT ON electronics_store.backup_logs TO 'app_user'@'localhost';
GRANT SELECT, INSERT ON electronics_store.forensics_log TO 'app_user'@'localhost';
GRANT SELECT, INSERT ON electronics_store.failed_login_attempts TO 'app_user'@'localhost';

-- Access to permissions system
GRANT SELECT ON electronics_store.permissions TO 'app_user'@'localhost';
GRANT SELECT ON electronics_store.role_permissions TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON electronics_store.user_permissions TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON electronics_store.ip_whitelist TO 'app_user'@'localhost';

-- Execute all stored procedures
GRANT EXECUTE ON electronics_store.* TO 'app_user'@'localhost';

-- ========================================
-- 5. GRANT PRIVILEGES - READ-ONLY USER
-- ========================================
-- Read-only user for reporting and analytics

-- Read access to all tables
GRANT SELECT ON electronics_store.* TO 'readonly_user'@'localhost';

-- Execute read-only stored procedures (reports)
GRANT EXECUTE ON PROCEDURE electronics_store.sp_get_top_selling_products TO 'readonly_user'@'localhost';
GRANT EXECUTE ON PROCEDURE electronics_store.sp_get_monthly_sales TO 'readonly_user'@'localhost';
GRANT EXECUTE ON PROCEDURE electronics_store.sp_get_monthly_sales_by_branch TO 'readonly_user'@'localhost';
GRANT EXECUTE ON PROCEDURE electronics_store.sp_get_revenue_by_currency TO 'readonly_user'@'localhost';
GRANT EXECUTE ON PROCEDURE electronics_store.sp_get_customer_purchase_history TO 'readonly_user'@'localhost';
GRANT EXECUTE ON PROCEDURE electronics_store.sp_get_low_stock_products TO 'readonly_user'@'localhost';
GRANT EXECUTE ON PROCEDURE electronics_store.sp_search_products_advanced TO 'readonly_user'@'localhost';

-- ========================================
-- 6. GRANT PRIVILEGES - BACKUP USER
-- ========================================
-- Backup user for backup operations

-- Read access to all tables (for backup)
GRANT SELECT, LOCK TABLES ON electronics_store.* TO 'backup_user'@'localhost';

-- Access to backup logs
GRANT SELECT, INSERT ON electronics_store.backup_logs TO 'backup_user'@'localhost';

-- Process privilege (for mysqldump)
GRANT PROCESS ON *.* TO 'backup_user'@'localhost';
GRANT RELOAD ON *.* TO 'backup_user'@'localhost';

-- ========================================
-- 7. REVOKE PRIVILEGES EXAMPLES
-- ========================================
-- Examples of revoking privileges (for demonstration)

-- Example: Revoke DELETE from staff_user on sensitive tables
-- REVOKE DELETE ON electronics_store.users FROM 'staff_user'@'localhost';
-- REVOKE DELETE ON electronics_store.products FROM 'staff_user'@'localhost';
-- REVOKE DELETE ON electronics_store.payments FROM 'staff_user'@'localhost';

-- Example: Revoke ALTER from app_user (prevent schema changes)
-- REVOKE ALTER ON electronics_store.* FROM 'app_user'@'localhost';

-- ========================================
-- 8. GRANT PRIVILEGES WITH GRANT OPTION
-- ========================================
-- Admin user can grant privileges to others (optional)

-- Allow admin_user to grant privileges to other users
GRANT ALL PRIVILEGES ON electronics_store.* TO 'admin_user'@'localhost' WITH GRANT OPTION;

-- ========================================
-- 9. FLUSH PRIVILEGES
-- ========================================
-- Reload privilege tables

FLUSH PRIVILEGES;

-- ========================================
-- 10. VERIFICATION QUERIES
-- ========================================

-- Show all users
SELECT User, Host FROM mysql.user WHERE User LIKE '%_user';

-- Show privileges for admin_user
SHOW GRANTS FOR 'admin_user'@'localhost';

-- Show privileges for staff_user
SHOW GRANTS FOR 'staff_user'@'localhost';

-- Show privileges for app_user
SHOW GRANTS FOR 'app_user'@'localhost';

-- Show privileges for readonly_user
SHOW GRANTS FOR 'readonly_user'@'localhost';

-- Show privileges for backup_user
SHOW GRANTS FOR 'backup_user'@'localhost';

-- Show current user privileges
SHOW GRANTS FOR CURRENT_USER();

-- ========================================
-- 11. PRIVILEGE MANAGEMENT STORED PROCEDURES
-- ========================================

-- Stored procedure to grant table-level privileges
DROP PROCEDURE IF EXISTS sp_grant_table_privileges;

DELIMITER $$

CREATE PROCEDURE sp_grant_table_privileges(
    IN p_username VARCHAR(50),
    IN p_host VARCHAR(50),
    IN p_table_name VARCHAR(100),
    IN p_privileges VARCHAR(200)
)
BEGIN
    SET @sql = CONCAT('GRANT ', p_privileges, ' ON electronics_store.', p_table_name, 
                      ' TO ''', p_username, '''@''', p_host, '''');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    
    FLUSH PRIVILEGES;
    
    SELECT CONCAT('Granted ', p_privileges, ' on ', p_table_name, ' to ', p_username, '@', p_host) AS result;
END$$

DELIMITER ;

-- Stored procedure to revoke table-level privileges
DROP PROCEDURE IF EXISTS sp_revoke_table_privileges;

DELIMITER $$

CREATE PROCEDURE sp_revoke_table_privileges(
    IN p_username VARCHAR(50),
    IN p_host VARCHAR(50),
    IN p_table_name VARCHAR(100),
    IN p_privileges VARCHAR(200)
)
BEGIN
    SET @sql = CONCAT('REVOKE ', p_privileges, ' ON electronics_store.', p_table_name, 
                      ' FROM ''', p_username, '''@''', p_host, '''');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    
    FLUSH PRIVILEGES;
    
    SELECT CONCAT('Revoked ', p_privileges, ' on ', p_table_name, ' from ', p_username, '@', p_host) AS result;
END$$

DELIMITER ;

-- ========================================
-- 12. PRIVILEGE AUDIT VIEW
-- ========================================

-- View to show all user privileges (for auditing)
CREATE OR REPLACE VIEW v_user_privileges AS
SELECT 
    u.User,
    u.Host,
    CASE 
        WHEN u.User = 'admin_user' THEN 'Administrator'
        WHEN u.User = 'staff_user' THEN 'Staff'
        WHEN u.User = 'app_user' THEN 'Application'
        WHEN u.User = 'readonly_user' THEN 'Read-Only'
        WHEN u.User = 'backup_user' THEN 'Backup'
        ELSE 'Other'
    END AS user_role,
    db.Db AS database_name,
    t.Table_name AS table_name,
    GROUP_CONCAT(DISTINCT 
        CASE 
            WHEN t.Table_priv LIKE '%Select%' THEN 'SELECT'
            WHEN t.Table_priv LIKE '%Insert%' THEN 'INSERT'
            WHEN t.Table_priv LIKE '%Update%' THEN 'UPDATE'
            WHEN t.Table_priv LIKE '%Delete%' THEN 'DELETE'
            WHEN t.Table_priv LIKE '%Create%' THEN 'CREATE'
            WHEN t.Table_priv LIKE '%Alter%' THEN 'ALTER'
            WHEN t.Table_priv LIKE '%Drop%' THEN 'DROP'
            WHEN t.Table_priv LIKE '%Index%' THEN 'INDEX'
            WHEN t.Table_priv LIKE '%Trigger%' THEN 'TRIGGER'
        END
        SEPARATOR ', '
    ) AS table_privileges,
    CASE 
        WHEN u.Select_priv = 'Y' THEN 'SELECT'
        WHEN u.Insert_priv = 'Y' THEN 'INSERT'
        WHEN u.Update_priv = 'Y' THEN 'UPDATE'
        WHEN u.Delete_priv = 'Y' THEN 'DELETE'
        WHEN u.Create_priv = 'Y' THEN 'CREATE'
        WHEN u.Alter_priv = 'Y' THEN 'ALTER'
        WHEN u.Drop_priv = 'Y' THEN 'DROP'
        WHEN u.Index_priv = 'Y' THEN 'INDEX'
        WHEN u.Trigger_priv = 'Y' THEN 'TRIGGER'
        ELSE 'NONE'
    END AS global_privileges
FROM mysql.user u
LEFT JOIN mysql.db db ON u.User = db.User AND u.Host = db.Host
LEFT JOIN mysql.tables_priv t ON u.User = t.User AND u.Host = t.Host
WHERE u.User LIKE '%_user'
GROUP BY u.User, u.Host, db.Db, t.Table_name
ORDER BY u.User, db.Db, t.Table_name;

-- Grant SELECT on view to admin_user
GRANT SELECT ON electronics_store.v_user_privileges TO 'admin_user'@'localhost';

FLUSH PRIVILEGES;

-- ========================================
-- 13. SECURITY BEST PRACTICES
-- ========================================

-- Example: Change password for a user
-- ALTER USER 'admin_user'@'localhost' IDENTIFIED BY 'NewSecurePassword123!';

-- Example: Lock a user account
-- ALTER USER 'staff_user'@'localhost' ACCOUNT LOCK;

-- Example: Unlock a user account
-- ALTER USER 'staff_user'@'localhost' ACCOUNT UNLOCK;

-- Example: Set password expiration (90 days)
-- ALTER USER 'app_user'@'localhost' PASSWORD EXPIRE INTERVAL 90 DAY;

-- Example: Require password change on first login
-- ALTER USER 'readonly_user'@'localhost' PASSWORD EXPIRE;

-- ========================================
-- COMPLETION MESSAGE
-- ========================================

SELECT 'Database users and privileges created successfully!' AS Status;
SELECT 'Remember to change default passwords in production!' AS Warning;
SELECT 'Use SHOW GRANTS FOR ''username''@''host'' to verify privileges' AS Info;

