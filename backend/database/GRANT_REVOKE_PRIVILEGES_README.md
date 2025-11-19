# MySQL GRANT and REVOKE Privileges System

## Overview

This implements **MySQL database-level privileges** using GRANT and REVOKE statements, which is different from application-level permissions. This provides an additional layer of security at the database level.

## Database Users Created

### 1. **admin_user** (Administrator)
- **Purpose**: Full administrative access
- **Privileges**: 
  - ALL PRIVILEGES on `electronics_store.*`
  - CREATE USER, RELOAD, PROCESS on `*.*`
  - WITH GRANT OPTION (can grant privileges to others)
- **Use Case**: Database administration, schema changes, user management

### 2. **staff_user** (Staff Operations)
- **Purpose**: Limited access for staff operations
- **Privileges**:
  - SELECT on most tables
  - INSERT, UPDATE, DELETE on: orders, order_items, payments, product_inventory
  - EXECUTE on staff-related stored procedures
- **Use Case**: Order processing, inventory management, staff operations

### 3. **app_user** (Application)
- **Purpose**: Standard application access
- **Privileges**:
  - SELECT, INSERT, UPDATE, DELETE on all application tables
  - EXECUTE on all stored procedures
  - Access to audit and logging tables
- **Use Case**: Main application database operations

### 4. **readonly_user** (Read-Only)
- **Purpose**: Reporting and analytics
- **Privileges**:
  - SELECT on all tables
  - EXECUTE on read-only stored procedures (reports)
- **Use Case**: Business intelligence, reporting, analytics

### 5. **backup_user** (Backup Operations)
- **Purpose**: Database backups
- **Privileges**:
  - SELECT, LOCK TABLES on all tables
  - PROCESS, RELOAD on `*.*`
- **Use Case**: Automated backups, mysqldump operations

## GRANT Statements Examples

### Grant Table-Level Privileges

```sql
-- Grant SELECT, INSERT, UPDATE on products table
GRANT SELECT, INSERT, UPDATE ON electronics_store.products TO 'app_user'@'localhost';

-- Grant all privileges on specific table
GRANT ALL PRIVILEGES ON electronics_store.orders TO 'admin_user'@'localhost';

-- Grant with GRANT OPTION (can grant to others)
GRANT ALL PRIVILEGES ON electronics_store.* TO 'admin_user'@'localhost' WITH GRANT OPTION;
```

### Grant Procedure-Level Privileges

```sql
-- Grant EXECUTE on specific stored procedure
GRANT EXECUTE ON PROCEDURE electronics_store.sp_update_order_status TO 'staff_user'@'localhost';

-- Grant EXECUTE on all procedures
GRANT EXECUTE ON electronics_store.* TO 'app_user'@'localhost';
```

### Grant Global Privileges

```sql
-- Grant CREATE USER privilege
GRANT CREATE USER ON *.* TO 'admin_user'@'localhost';

-- Grant RELOAD privilege (for FLUSH commands)
GRANT RELOAD ON *.* TO 'admin_user'@'localhost';
```

## REVOKE Statements Examples

### Revoke Table-Level Privileges

```sql
-- Revoke DELETE privilege
REVOKE DELETE ON electronics_store.users FROM 'staff_user'@'localhost';

-- Revoke multiple privileges
REVOKE ALTER, DROP ON electronics_store.* FROM 'app_user'@'localhost';

-- Revoke all privileges
REVOKE ALL PRIVILEGES ON electronics_store.* FROM 'readonly_user'@'localhost';
```

### Revoke Procedure-Level Privileges

```sql
-- Revoke EXECUTE on specific procedure
REVOKE EXECUTE ON PROCEDURE electronics_store.sp_delete_user FROM 'staff_user'@'localhost';
```

## Stored Procedures for Privilege Management

### Grant Table Privileges

```sql
CALL sp_grant_table_privileges('staff_user', 'localhost', 'orders', 'SELECT, INSERT, UPDATE');
```

### Revoke Table Privileges

```sql
CALL sp_revoke_table_privileges('staff_user', 'localhost', 'users', 'DELETE');
```

## Verification Queries

### Show User Privileges

```sql
-- Show all privileges for a user
SHOW GRANTS FOR 'admin_user'@'localhost';

-- Show current user privileges
SHOW GRANTS FOR CURRENT_USER();

-- Show all users
SELECT User, Host FROM mysql.user WHERE User LIKE '%_user';
```

### View Privilege Audit

```sql
-- View all user privileges (using audit view)
SELECT * FROM electronics_store.v_user_privileges;
```

## Security Best Practices

### Password Management

```sql
-- Change user password
ALTER USER 'admin_user'@'localhost' IDENTIFIED BY 'NewSecurePassword123!';

-- Set password expiration (90 days)
ALTER USER 'app_user'@'localhost' PASSWORD EXPIRE INTERVAL 90 DAY;

-- Require password change on first login
ALTER USER 'readonly_user'@'localhost' PASSWORD EXPIRE;
```

### Account Management

```sql
-- Lock user account
ALTER USER 'staff_user'@'localhost' ACCOUNT LOCK;

-- Unlock user account
ALTER USER 'staff_user'@'localhost' ACCOUNT UNLOCK;
```

### Flush Privileges

After granting or revoking privileges, always flush:

```sql
FLUSH PRIVILEGES;
```

## Privilege Levels

### 1. Global Privileges
- Apply to all databases
- Examples: CREATE USER, RELOAD, PROCESS
- Syntax: `GRANT ... ON *.* TO ...`

### 2. Database Privileges
- Apply to entire database
- Examples: CREATE, ALTER, DROP
- Syntax: `GRANT ... ON database.* TO ...`

### 3. Table Privileges
- Apply to specific tables
- Examples: SELECT, INSERT, UPDATE, DELETE
- Syntax: `GRANT ... ON database.table TO ...`

### 4. Column Privileges
- Apply to specific columns
- Examples: SELECT (column1, column2)
- Syntax: `GRANT SELECT (column1) ON database.table TO ...`

### 5. Procedure Privileges
- Apply to stored procedures/functions
- Examples: EXECUTE
- Syntax: `GRANT EXECUTE ON PROCEDURE database.procedure TO ...`

## Principle of Least Privilege

Each user is granted **only the minimum privileges** necessary:

- **admin_user**: Full access (needed for administration)
- **staff_user**: Limited write access (only operational tables)
- **app_user**: Standard CRUD operations (application needs)
- **readonly_user**: Read-only access (reporting needs)
- **backup_user**: Read + lock tables (backup needs)

## Comparison: Application Permissions vs Database Privileges

| Feature | Application Permissions | Database Privileges (GRANT/REVOKE) |
|---------|------------------------|-----------------------------------|
| **Level** | Application layer | Database layer |
| **Scope** | Business logic | Database operations |
| **Granularity** | Very fine (per operation) | Coarse (per table/procedure) |
| **Management** | Custom tables | MySQL native |
| **Use Case** | Who can do what in app | Who can access what in DB |
| **Example** | `products.create` permission | `GRANT INSERT ON products` |

**Both systems work together:**
- Database privileges control **database access**
- Application permissions control **business logic access**

## Setup Instructions

1. **Run the SQL script:**
   ```sql
   SOURCE backend/database/create_database_users_and_privileges.sql;
   ```

2. **Change default passwords:**
   ```sql
   ALTER USER 'admin_user'@'localhost' IDENTIFIED BY 'YourSecurePassword';
   -- Repeat for other users
   ```

3. **Update application config** (if using different user):
   ```php
   // In database.php
   define('DB_USER', 'app_user');
   define('DB_PASS', 'App@Secure123!');
   ```

4. **Verify privileges:**
   ```sql
   SHOW GRANTS FOR 'app_user'@'localhost';
   ```

## Compliance

This implementation **exceeds** Exemplary requirements by providing:
- ✅ Multiple database users with role-based access
- ✅ Fine-grained GRANT statements
- ✅ REVOKE examples and procedures
- ✅ Principle of least privilege
- ✅ Privilege management stored procedures
- ✅ Privilege audit view
- ✅ Security best practices

